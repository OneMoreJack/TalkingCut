/**
 * Model Manager Service
 * ======================
 * 
 * Manages local models: detection, symlinks, verification.
 */

import { app } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { LocalModelStatus, MODEL_DEFINITIONS, ModelInfo } from '../models/modelDefinitions';

export class ModelManager {
  private modelsDir: string;
  private huggingFaceCacheDir: string;
  private deletedModelsPath: string;

  constructor() {
    this.modelsDir = path.join(app.getPath('userData'), 'models');
    this.huggingFaceCacheDir = path.join(os.homedir(), '.cache', 'huggingface', 'hub');
    this.deletedModelsPath = path.join(app.getPath('userData'), 'deleted-models.json');

    // Ensure models directory exists
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }

    console.log(`[ModelManager] Models directory: ${this.modelsDir}`);
  }

  /**
   * Get the models directory path
   */
  getModelsDir(): string {
    return this.modelsDir;
  }

  /**
   * Get model directory for a specific model
   */
  getModelPath(modelId: string): string {
    return path.join(this.modelsDir, modelId);
  }

  /**
   * List all models with their installation status
   */
  async listModels(): Promise<LocalModelStatus[]> {
    const statuses: LocalModelStatus[] = [];

    for (const model of MODEL_DEFINITIONS) {
      const status = await this.getModelStatus(model);
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Get installation status for a specific model
   */
  async getModelStatus(model: ModelInfo): Promise<LocalModelStatus> {
    const modelPath = this.getModelPath(model.id);

    // 1. 优先级最高：物理文件检查
    // 如果本地目录存在且文件完整，强制返回已安装（覆盖任何删除标记）
    if (fs.existsSync(modelPath)) {
      const stats = fs.lstatSync(modelPath);
      const isSymlink = stats.isSymbolicLink();

      // Verify model files exist
      const isComplete = this.verifyModelFiles(model, modelPath);

      console.log(`[ModelManager] Physical check for ${model.id}: exists=${true}, isSymlink=${isSymlink}, isComplete=${isComplete}`);

      // 列出目录内容用于调试
      try {
        const files = fs.readdirSync(modelPath);
        console.log(`[ModelManager] Files in ${model.id}: ${files.join(', ')}`);
      } catch (e) {
        console.log(`[ModelManager] Could not read dir for ${model.id}`);
      }

      if (isComplete) {
        // 自动修复：既然文件存在且完整，就确保删除标记已清除
        this.clearDeletedMark(model.id);
        return {
          id: model.id,
          installed: true,
          source: isSymlink ? 'symlink' : 'downloaded',
          path: modelPath,
          sizeOnDisk: this.getDirectorySize(modelPath)
        };
      }
    }

    // 2. 检查删除标记：只有在本地物理文件不存在/不完整时，才看是否被用户明确删除
    if (this.isModelDeleted(model.id)) {
      console.log(`[ModelManager] ${model.id} is in deleted list, skipping cache check`);
      return {
        id: model.id,
        installed: false,
        source: 'none'
      };
    }

    // 3. 扫描 HuggingFace 缓存并尝试建立 Symlink
    const hfPath = this.findInHuggingFaceCache(model);
    if (hfPath) {
      // Create symlink to existing model
      try {
        await this.createSymlink(hfPath, modelPath);
        return {
          id: model.id,
          installed: true,
          source: 'symlink',
          path: modelPath,
          sizeOnDisk: 0 // Symlink doesn't use extra space
        };
      } catch (error) {
        console.warn(`[ModelManager] Failed to create symlink for ${model.id}:`, error);
      }
    }

    return {
      id: model.id,
      installed: false,
      source: 'none'
    };
  }

  /**
   * Find model in HuggingFace cache directory
   */
  private findInHuggingFaceCache(model: ModelInfo): string | null {
    // HuggingFace cache structure: ~/.cache/huggingface/hub/models--<org>--<name>/snapshots/<hash>/
    const repoName = model.huggingFaceRepo.replace('/', '--');
    const modelCacheDir = path.join(this.huggingFaceCacheDir, `models--${repoName}`);

    if (!fs.existsSync(modelCacheDir)) {
      return null;
    }

    const snapshotsDir = path.join(modelCacheDir, 'snapshots');
    if (!fs.existsSync(snapshotsDir)) {
      return null;
    }

    // Get the latest snapshot
    const snapshots = fs.readdirSync(snapshotsDir);
    if (snapshots.length === 0) {
      return null;
    }

    // Use the first snapshot (usually the latest)
    const snapshotPath = path.join(snapshotsDir, snapshots[0]);

    // Verify it has the required files
    if (this.verifyModelFiles(model, snapshotPath)) {
      console.log(`[ModelManager] Found ${model.id} in HuggingFace cache: ${snapshotPath}`);
      return snapshotPath;
    }

    return null;
  }

  /**
   * Create symlink to existing model
   */
  private async createSymlink(source: string, target: string): Promise<void> {
    // Remove existing target if it's a broken symlink or empty dir
    if (fs.existsSync(target)) {
      const stats = fs.lstatSync(target);
      if (stats.isSymbolicLink() || (stats.isDirectory() && fs.readdirSync(target).length === 0)) {
        fs.rmSync(target, { recursive: true });
      } else {
        throw new Error(`Target already exists and is not empty: ${target}`);
      }
    }

    fs.symlinkSync(source, target, 'dir');
    console.log(`[ModelManager] Created symlink: ${target} -> ${source}`);
  }

  /**
   * Verify that a model directory contains at least the main weights file
   */
  private verifyModelFiles(model: ModelInfo, modelPath: string): boolean {
    const modelBinPath = path.join(modelPath, 'model.bin');

    if (fs.existsSync(modelBinPath)) {
      const stats = fs.statSync(modelBinPath);
      // Main weights should be at least 10MB (Tiny is ~75MB)
      if (stats.size > 10 * 1024 * 1024) {
        console.log(`[ModelManager] Verified ${model.id}: model.bin exists (${stats.size} bytes)`);
        return true;
      }
    }

    console.log(`[ModelManager] ${model.id} not verified: model.bin missing or too small`);
    return false;
  }

  /**
   * Get total size of a directory
   */
  private getDirectorySize(dirPath: string): number {
    let size = 0;

    try {
      const stats = fs.lstatSync(dirPath);
      if (stats.isSymbolicLink()) {
        return 0; // Symlinks don't count towards size
      }

      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const fileStats = fs.statSync(filePath);
        size += fileStats.size;
      }
    } catch {
      // Ignore errors
    }

    return size;
  }

  /**
   * Delete a downloaded model
   */
  async deleteModel(modelId: string): Promise<void> {
    const modelPath = this.getModelPath(modelId);

    // Delete model directory
    if (fs.existsSync(modelPath)) {
      fs.rmSync(modelPath, { recursive: true });
      console.log(`[ModelManager] Deleted model directory: ${modelId}`);
    }

    // Clean up progress file (important for re-downloading)
    const progressPath = path.join(this.modelsDir, `${modelId}.progress`);
    if (fs.existsSync(progressPath)) {
      fs.unlinkSync(progressPath);
      console.log(`[ModelManager] Deleted progress file for: ${modelId}`);
    }

    // Clean up any partial files
    const partialPath = path.join(this.modelsDir, `${modelId}.partial`);
    if (fs.existsSync(partialPath)) {
      fs.rmSync(partialPath, { recursive: true });
      console.log(`[ModelManager] Deleted partial files for: ${modelId}`);
    }

    // Mark model as explicitly deleted to prevent auto-recreation
    this.markModelAsDeleted(modelId);
  }

  /**
   * Check if a partial download exists for a model
   */
  hasPartialDownload(modelId: string): boolean {
    const partialPath = path.join(this.modelsDir, `${modelId}.partial`);
    return fs.existsSync(partialPath);
  }

  /**
   * Get partial download info
   */
  getPartialDownloadInfo(modelId: string): { file: string; downloaded: number } | null {
    const progressPath = path.join(this.modelsDir, `${modelId}.progress`);

    if (!fs.existsSync(progressPath)) {
      return null;
    }

    try {
      const info = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
      return info;
    } catch {
      return null;
    }
  }

  /**
   * Check if a model was explicitly deleted by the user
   */
  private isModelDeleted(modelId: string): boolean {
    if (!fs.existsSync(this.deletedModelsPath)) {
      return false;
    }

    try {
      const deletedModels = JSON.parse(fs.readFileSync(this.deletedModelsPath, 'utf-8'));
      return deletedModels.includes(modelId);
    } catch {
      return false;
    }
  }

  /**
   * Mark a model as explicitly deleted
   */
  private markModelAsDeleted(modelId: string): void {
    let deletedModels: string[] = [];

    if (fs.existsSync(this.deletedModelsPath)) {
      try {
        deletedModels = JSON.parse(fs.readFileSync(this.deletedModelsPath, 'utf-8'));
      } catch {
        deletedModels = [];
      }
    }

    if (!deletedModels.includes(modelId)) {
      deletedModels.push(modelId);
      fs.writeFileSync(this.deletedModelsPath, JSON.stringify(deletedModels, null, 2));
      console.log(`[ModelManager] Marked ${modelId} as deleted`);
    }
  }

  /**
   * Clear the deleted mark for a model (called when re-downloading)
   */
  clearDeletedMark(modelId: string): void {
    if (!fs.existsSync(this.deletedModelsPath)) {
      return;
    }

    try {
      let deletedModels: string[] = JSON.parse(fs.readFileSync(this.deletedModelsPath, 'utf-8'));
      deletedModels = deletedModels.filter(id => id !== modelId);
      fs.writeFileSync(this.deletedModelsPath, JSON.stringify(deletedModels, null, 2));
      console.log(`[ModelManager] Cleared deleted mark for ${modelId}`);
    } catch (error) {
      console.warn(`[ModelManager] Failed to clear deleted mark for ${modelId}:`, error);
    }
  }
}
