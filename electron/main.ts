/**
 * TalkingCut - Electron Main Process
 * ===================================
 * 
 * Handles:
 * - BrowserWindow creation
 * - IPC handlers for Python transcription and FFmpeg export
 * - Native file system access
 */

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getModelInfoWithUrls, MIRROR_CONFIG, MirrorSource, MODEL_DEFINITIONS } from './models/modelDefinitions';
import { DownloadManager } from './services/downloadManager';
import { FFmpegBridge } from './services/ffmpegBridge';
import { FileManager } from './services/fileManager';
import { ModelManager } from './services/modelManager';
import { PythonBridge } from './services/pythonBridge';

// ESM compatibility: create __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep a reference to prevent garbage collection
let mainWindow: BrowserWindow | null = null;

// Service instances
const pythonBridge = new PythonBridge();
const ffmpegBridge = new FFmpegBridge();
const fileManager = new FileManager();
const modelManager = new ModelManager();
const downloadManager = new DownloadManager(modelManager.getModelsDir());

// Simple persistent config
let mirrorSource: MirrorSource = 'huggingface';
const configPath = path.join(app.getPath('userData'), 'config.json');
try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.mirrorSource) mirrorSource = config.mirrorSource;
  }
} catch (e) {
  console.warn('[Main] Failed to load config:', e);
}

function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify({ mirrorSource }));
  } catch (e) {
    console.warn('[Main] Failed to save config:', e);
  }
}

// ============================================================================
// Window Management
// ============================================================================

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'TalkingCut',
    backgroundColor: '#09090b', // zinc-950
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for preload to access node modules path resolution
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
  });

  // Set main window reference for download progress events
  downloadManager.setMainWindow(mainWindow);

  // Load the Vite dev server in development, or the built files in production
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, use app.getAppPath() to get the correct base path
    const appPath = app.getAppPath();
    const indexPath = path.join(appPath, 'dist', 'index.html');
    console.log('[Main] Loading production build from:', indexPath);
    console.log('[Main] __dirname:', __dirname);
    console.log('[Main] app.getAppPath():', appPath);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================================
// IPC Handlers
// ============================================================================

function setupIpcHandlers(): void {
  // ----- File Dialog -----
  ipcMain.handle('dialog:openVideo', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm'] }
      ]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:saveVideo', async () => {
    const result = await dialog.showSaveDialog({
      filters: [
        { name: 'MP4 Video', extensions: ['mp4'] }
      ]
    });
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle('file:readVideo', async (_event, videoPath: string) => {
    try {
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(videoPath);
      // Convert Node Buffer to ArrayBuffer for IPC transfer
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch (error) {
      console.error('[Main] Failed to read video file:', error);
      return null;
    }
  });

  // ----- Transcription -----
  ipcMain.handle('transcribe:start', async (event, videoPath: string, options?: {
    model?: string;
    language?: string;
  }) => {
    try {
      // Extract audio first (if needed)
      const audioPath = await ffmpegBridge.extractAudio(videoPath, (progress) => {
        event.sender.send('transcribe:progress', {
          step: 'extracting',
          progress,
          message: 'Extracting audio...'
        });
      });

      // Notify UI that we are transitioning to transcription
      event.sender.send('transcribe:progress', {
        step: 'transcribing',
        progress: 0,
        message: 'Initializing AI engine (loading models)...'
      });

      // Run Python transcription
      const isInstalled = await modelManager.getModelStatus({ id: options?.model || 'base' } as any).then(s => s.installed);

      const result = await pythonBridge.transcribe(audioPath, {
        model: options?.model || 'base',
        language: options?.language,
        offline: isInstalled, // Force offline if model is already there
        mirror: MIRROR_CONFIG[mirrorSource],
        onProgress: (progress, message) => {
          event.sender.send('transcribe:progress', {
            step: 'transcribing',
            progress,
            message
          });
        }
      });

      return { success: true, segments: result.segments, audioPath };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('transcribe:cancel', () => {
    pythonBridge.cancel();
    return { success: true };
  });

  // ----- Export -----
  ipcMain.handle('export:start', async (event, params: {
    videoPath: string;
    outputPath: string;
    ffmpegCommand: string;
  }) => {
    try {
      await ffmpegBridge.executeCommand(params.ffmpegCommand, (progress) => {
        event.sender.send('export:progress', {
          step: 'exporting',
          progress,
          message: `Exporting... ${Math.round(progress)}%`
        });
      });

      return { success: true, outputPath: params.outputPath };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // ----- Project Management -----
  ipcMain.handle('project:save', async (_event, projectData: string, filePath?: string) => {
    try {
      const savePath = filePath || await dialog.showSaveDialog({
        filters: [{ name: 'TalkingCut Project', extensions: ['tcproj'] }]
      }).then(r => r.filePath);

      if (!savePath) return { success: false, error: 'Cancelled' };

      await fileManager.saveProject(savePath, projectData);
      return { success: true, path: savePath };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('project:load', async () => {
    try {
      const result = await dialog.showOpenDialog({
        filters: [{ name: 'TalkingCut Project', extensions: ['tcproj'] }]
      });

      if (result.canceled) return { success: false, error: 'Cancelled' };

      const data = await fileManager.loadProject(result.filePaths[0]);
      return { success: true, data, path: result.filePaths[0] };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // ----- Temp Files -----
  ipcMain.handle('temp:getWorkspace', () => {
    return fileManager.getWorkspacePath();
  });

  ipcMain.handle('temp:cleanup', async () => {
    await fileManager.cleanupWorkspace();
    return { success: true };
  });

  // ----- Model Management -----
  ipcMain.handle('model:list', async () => {
    const statuses = await modelManager.listModels();
    return {
      definitions: MODEL_DEFINITIONS,
      statuses,
      mirrorSource
    };
  });

  ipcMain.handle('model:setMirror', (_event, source: MirrorSource) => {
    mirrorSource = source;
    saveConfig();
    return { success: true };
  });

  ipcMain.handle('model:download', async (_event, modelId: string) => {
    const model = getModelInfoWithUrls(modelId, mirrorSource);
    if (!model) {
      return { success: false, error: 'Model not found' };
    }

    try {
      // Clear deleted mark BEFORE downloading so UI updates correctly on completion
      modelManager.clearDeletedMark(modelId);
      await downloadManager.downloadModel(model);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('model:cancel', () => {
    downloadManager.cancelDownload();
    return { success: true };
  });

  ipcMain.handle('model:delete', async (_event, modelId: string) => {
    try {
      await modelManager.deleteModel(modelId);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // ----- Shell & System -----
  ipcMain.handle('shell:showItemInFolder', (_event, fullPath: string) => {
    shell.showItemInFolder(fullPath);
    return { success: true };
  });

  ipcMain.handle('shell:openPath', async (_event, fullPath: string) => {
    const error = await shell.openPath(fullPath);
    return { success: error === '', error };
  });

  ipcMain.handle('app:getPlatform', () => {
    return process.platform;
  });
}

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', async () => {
  // Cleanup temp files on exit
  await fileManager.cleanupWorkspace();
});
