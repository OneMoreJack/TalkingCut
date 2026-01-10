/**
 * Download Manager Service
 * =========================
 * 
 * Handles resumable file downloads with progress reporting.
 * Memory-efficient streaming to disk.
 */

import { BrowserWindow } from 'electron';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { DownloadProgress, ModelFile, ModelInfo } from '../models/modelDefinitions';

interface DownloadState {
  modelId: string;
  currentFile: string;
  downloaded: number;
  total: number;
  startTime: number;
  aborted: boolean;
  request: http.ClientRequest | null;
}

export class DownloadManager {
  private modelsDir: string;
  private currentDownload: DownloadState | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor(modelsDir: string) {
    this.modelsDir = modelsDir;
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  /**
   * Download a model with all its files
   */
  async downloadModel(model: ModelInfo): Promise<void> {
    const modelDir = path.join(this.modelsDir, model.id);

    // Create model directory
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }

    // Check for partial download progress
    const progressPath = path.join(this.modelsDir, `${model.id}.progress`);
    let startFromFile = 0;

    if (fs.existsSync(progressPath)) {
      try {
        const savedProgress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
        startFromFile = savedProgress.fileIndex || 0;
        console.log(`[DownloadManager] Resuming from file ${startFromFile}`);
      } catch {
        // Start fresh
      }
    }

    // Download each file
    for (let i = startFromFile; i < model.files.length; i++) {
      const file = model.files[i];

      // Save progress for resume
      fs.writeFileSync(progressPath, JSON.stringify({ fileIndex: i }));

      await this.downloadFile(model.id, file, modelDir);

      if (this.currentDownload?.aborted) {
        throw new Error('Download cancelled');
      }
    }

    // Clean up progress file
    if (fs.existsSync(progressPath)) {
      fs.unlinkSync(progressPath);
    }

    // Emit final completion event for the WHOLE model
    this.emitProgress({
      modelId: model.id,
      fileName: 'all',
      downloaded: 0,
      total: 0,
      percent: 100,
      speed: 0,
      eta: 0,
      status: 'completed'
    });

    console.log(`[DownloadManager] Model ${model.id} download complete`);
  }

  /**
   * Download a single file with resume support
   */
  private async downloadFile(modelId: string, file: ModelFile, targetDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const filePath = path.join(targetDir, file.name);
      const partialPath = `${filePath}.partial`;

      // Check for existing partial download
      let existingSize = 0;
      if (fs.existsSync(partialPath)) {
        existingSize = fs.statSync(partialPath).size;
        console.log(`[DownloadManager] Resuming ${file.name} from ${existingSize} bytes`);
      }

      // Check if file already complete
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size >= file.size * 0.9) {
          console.log(`[DownloadManager] ${file.name} already exists, skipping`);
          resolve();
          return;
        }
      }

      const url = new URL(file.url);
      const protocol = url.protocol === 'https:' ? https : http;

      const headers: Record<string, string> = {
        'User-Agent': 'TalkingCut/1.0'
      };

      // Add Range header for resume
      if (existingSize > 0) {
        headers['Range'] = `bytes=${existingSize}-`;
      }

      this.currentDownload = {
        modelId,
        currentFile: file.name,
        downloaded: existingSize,
        total: file.size,
        startTime: Date.now(),
        aborted: false,
        request: null
      };

      const request = protocol.get(url, { headers }, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            // Follow redirect
            this.downloadFileFromUrl(modelId, file, redirectUrl, partialPath, existingSize)
              .then(resolve)
              .catch(reject);
            return;
          }
        }

        // Check for successful response
        if (response.statusCode !== 200 && response.statusCode !== 206) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        // Get total size from Content-Range or Content-Length
        let totalSize = file.size;
        if (response.headers['content-range']) {
          const match = response.headers['content-range'].match(/\/(\d+)/);
          if (match) {
            totalSize = parseInt(match[1], 10);
          }
        } else if (response.headers['content-length']) {
          totalSize = existingSize + parseInt(response.headers['content-length'] as string, 10);
        }

        this.currentDownload!.total = totalSize;

        // Open file for writing (append mode if resuming)
        const writeStream = fs.createWriteStream(partialPath, {
          flags: existingSize > 0 ? 'a' : 'w'
        });

        let downloadedThisSession = 0;
        const startTime = Date.now();

        response.on('data', (chunk: Buffer) => {
          if (this.currentDownload?.aborted) {
            response.destroy();
            writeStream.close();
            return;
          }

          downloadedThisSession += chunk.length;
          this.currentDownload!.downloaded = existingSize + downloadedThisSession;

          // Calculate progress
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = downloadedThisSession / elapsed;
          const remaining = totalSize - this.currentDownload!.downloaded;
          const eta = speed > 0 ? remaining / speed : 0;

          this.emitProgress({
            modelId,
            fileName: file.name,
            downloaded: this.currentDownload!.downloaded,
            total: totalSize,
            percent: Math.round((this.currentDownload!.downloaded / totalSize) * 100),
            speed,
            eta,
            status: 'downloading'
          });
        });

        response.pipe(writeStream);

        writeStream.on('finish', () => {
          // Rename partial to final
          if (fs.existsSync(partialPath)) {
            fs.renameSync(partialPath, filePath);
          }

          this.emitProgress({
            modelId,
            fileName: file.name,
            downloaded: totalSize,
            total: totalSize,
            percent: 100,
            speed: 0,
            eta: 0,
            status: 'downloading' // Keep as downloading until last file is done
          });

          resolve();
        });

        writeStream.on('error', (error) => {
          reject(error);
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      this.currentDownload.request = request;
    });
  }

  /**
   * Download from a specific URL (for redirects)
   */
  private async downloadFileFromUrl(
    modelId: string,
    file: ModelFile,
    urlString: string,
    partialPath: string,
    existingSize: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlString);
      const protocol = url.protocol === 'https:' ? https : http;

      const headers: Record<string, string> = {
        'User-Agent': 'TalkingCut/1.0'
      };

      if (existingSize > 0) {
        headers['Range'] = `bytes=${existingSize}-`;
      }

      const request = protocol.get(url, { headers }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            this.downloadFileFromUrl(modelId, file, redirectUrl, partialPath, existingSize)
              .then(resolve)
              .catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200 && response.statusCode !== 206) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        let totalSize = file.size;
        if (response.headers['content-range']) {
          const match = response.headers['content-range'].match(/\/(\d+)/);
          if (match) totalSize = parseInt(match[1], 10);
        }

        const filePath = partialPath.replace('.partial', '');
        const writeStream = fs.createWriteStream(partialPath, {
          flags: existingSize > 0 ? 'a' : 'w'
        });

        let downloadedThisSession = 0;
        const startTime = Date.now();

        response.on('data', (chunk: Buffer) => {
          if (this.currentDownload?.aborted) {
            response.destroy();
            writeStream.close();
            return;
          }

          downloadedThisSession += chunk.length;
          const downloaded = existingSize + downloadedThisSession;

          const elapsed = (Date.now() - startTime) / 1000;
          const speed = downloadedThisSession / elapsed;
          const eta = speed > 0 ? (totalSize - downloaded) / speed : 0;

          this.emitProgress({
            modelId,
            fileName: file.name,
            downloaded,
            total: totalSize,
            percent: Math.round((downloaded / totalSize) * 100),
            speed,
            eta,
            status: 'downloading'
          });
        });

        response.pipe(writeStream);

        writeStream.on('finish', () => {
          if (fs.existsSync(partialPath)) {
            fs.renameSync(partialPath, filePath);
          }
          resolve();
        });

        writeStream.on('error', reject);
      });

      request.on('error', reject);
      this.currentDownload!.request = request;
    });
  }

  /**
   * Cancel the current download
   */
  cancelDownload(): void {
    if (this.currentDownload) {
      this.currentDownload.aborted = true;
      this.currentDownload.request?.destroy();

      this.emitProgress({
        modelId: this.currentDownload.modelId,
        fileName: this.currentDownload.currentFile,
        downloaded: this.currentDownload.downloaded,
        total: this.currentDownload.total,
        percent: Math.round((this.currentDownload.downloaded / this.currentDownload.total) * 100),
        speed: 0,
        eta: 0,
        status: 'paused'
      });

      this.currentDownload = null;
    }
  }

  /**
   * Emit download progress to renderer
   */
  private emitProgress(progress: DownloadProgress): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('model:downloadProgress', progress);
    }
  }

  /**
   * Check if a download is in progress
   */
  isDownloading(): boolean {
    return this.currentDownload !== null && !this.currentDownload.aborted;
  }
}
