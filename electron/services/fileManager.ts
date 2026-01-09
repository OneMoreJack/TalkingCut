/**
 * File Manager Service
 * =====================
 * 
 * Manages temporary workspace, extracted audio cache,
 * and project JSON save/load operations.
 */

import { app } from 'electron';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export class FileManager {
  private workspacePath: string;

  constructor() {
    // Create a unique workspace in the temp directory
    this.workspacePath = path.join(
      os.tmpdir(),
      'TalkingCut',
      `session_${Date.now()}`
    );
    this.initWorkspace();
  }

  /**
   * Initialize the workspace directory
   */
  private async initWorkspace(): Promise<void> {
    try {
      await fs.mkdir(this.workspacePath, { recursive: true });
      console.log(`[FileManager] Workspace created: ${this.workspacePath}`);
    } catch (error) {
      console.error(`[FileManager] Failed to create workspace: ${error}`);
    }
  }

  /**
   * Get the workspace path
   */
  getWorkspacePath(): string {
    return this.workspacePath;
  }

  /**
   * Get the user data directory (for persistent storage)
   */
  getUserDataPath(): string {
    return app.getPath('userData');
  }

  /**
   * Save project data to a file
   */
  async saveProject(filePath: string, projectData: string): Promise<void> {
    await fs.writeFile(filePath, projectData, 'utf-8');
    console.log(`[FileManager] Project saved to: ${filePath}`);
  }

  /**
   * Load project data from a file
   */
  async loadProject(filePath: string): Promise<string> {
    const data = await fs.readFile(filePath, 'utf-8');
    console.log(`[FileManager] Project loaded from: ${filePath}`);
    return data;
  }

  /**
   * Create a cache file for extracted audio
   */
  async cacheAudio(sourceVideoPath: string, audioData: Buffer): Promise<string> {
    const hash = this.hashPath(sourceVideoPath);
    const cachePath = path.join(this.workspacePath, `audio_${hash}.wav`);
    await fs.writeFile(cachePath, audioData);
    return cachePath;
  }

  /**
   * Check if cached audio exists for a video
   */
  async getCachedAudio(sourceVideoPath: string): Promise<string | null> {
    const hash = this.hashPath(sourceVideoPath);
    const cachePath = path.join(this.workspacePath, `audio_${hash}.wav`);

    try {
      await fs.access(cachePath);
      return cachePath;
    } catch {
      return null;
    }
  }

  /**
   * Save a JSON snapshot of the project state
   */
  async saveSnapshot(snapshotId: string, data: object): Promise<string> {
    const snapshotPath = path.join(this.workspacePath, `snapshot_${snapshotId}.json`);
    await fs.writeFile(snapshotPath, JSON.stringify(data, null, 2), 'utf-8');
    return snapshotPath;
  }

  /**
   * Load a JSON snapshot
   */
  async loadSnapshot(snapshotId: string): Promise<object | null> {
    const snapshotPath = path.join(this.workspacePath, `snapshot_${snapshotId}.json`);

    try {
      const data = await fs.readFile(snapshotPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * List all snapshots in the workspace
   */
  async listSnapshots(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.workspacePath);
      return files
        .filter(f => f.startsWith('snapshot_') && f.endsWith('.json'))
        .map(f => f.replace('snapshot_', '').replace('.json', ''));
    } catch {
      return [];
    }
  }

  /**
   * Cleanup the workspace (remove all temp files)
   */
  async cleanupWorkspace(): Promise<void> {
    try {
      await fs.rm(this.workspacePath, { recursive: true, force: true });
      console.log(`[FileManager] Workspace cleaned: ${this.workspacePath}`);
    } catch (error) {
      console.error(`[FileManager] Cleanup failed: ${error}`);
    }
  }

  /**
   * Create a simple hash from a file path (for caching)
   */
  private hashPath(filePath: string): string {
    let hash = 0;
    for (let i = 0; i < filePath.length; i++) {
      const char = filePath.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get recent projects from user data
   */
  async getRecentProjects(): Promise<Array<{ path: string; name: string; date: string }>> {
    const recentPath = path.join(this.getUserDataPath(), 'recent_projects.json');

    try {
      const data = await fs.readFile(recentPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * Add a project to the recent projects list
   */
  async addRecentProject(projectPath: string, projectName: string): Promise<void> {
    const recentPath = path.join(this.getUserDataPath(), 'recent_projects.json');
    let recent = await this.getRecentProjects();

    // Remove if already exists
    recent = recent.filter(p => p.path !== projectPath);

    // Add to the front
    recent.unshift({
      path: projectPath,
      name: projectName,
      date: new Date().toISOString()
    });

    // Keep only last 10
    recent = recent.slice(0, 10);

    await fs.writeFile(recentPath, JSON.stringify(recent, null, 2), 'utf-8');
  }
}
