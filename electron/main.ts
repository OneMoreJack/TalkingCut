/**
 * TalkingCut - Electron Main Process
 * ===================================
 * 
 * Handles:
 * - BrowserWindow creation
 * - IPC handlers for Python transcription and FFmpeg export
 * - Native file system access
 */

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { FFmpegBridge } from './services/ffmpegBridge';
import { FileManager } from './services/fileManager';
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

  // Load the Vite dev server in development, or the built files in production
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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

      // Run Python transcription
      const result = await pythonBridge.transcribe(audioPath, {
        model: options?.model || 'base',
        language: options?.language,
        onProgress: (progress, message) => {
          event.sender.send('transcribe:progress', {
            step: 'transcribing',
            progress,
            message
          });
        }
      });

      return { success: true, segments: result.segments };
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
