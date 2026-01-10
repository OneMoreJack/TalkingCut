/**
 * TalkingCut - Electron Preload Script
 * =====================================
 * 
 * Exposes a secure, type-safe API to the renderer process.
 * Uses contextBridge to prevent direct access to Node.js APIs.
 */

import { contextBridge, ipcRenderer } from 'electron';

// ============================================================================
// Type Definitions
// ============================================================================

export interface TranscribeProgress {
  step: 'extracting' | 'transcribing';
  progress: number;
  message: string;
}

export interface ExportProgress {
  step: 'exporting';
  progress: number;
  message: string;
}

export interface WordSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
  type: 'word' | 'filler' | 'silence';
  deleted: boolean;
  segmentId?: string;
  isLastInSegment?: boolean;
  hasTrailingSpace?: boolean;
  duration?: number;
  language?: string;
}

export interface TranscribeResult {
  success: boolean;
  segments?: WordSegment[];
  error?: string;
}

export interface ExportResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

export interface ProjectResult {
  success: boolean;
  data?: string;
  path?: string;
  error?: string;
}

// ============================================================================
// API Definition
// ============================================================================

const electronAPI = {
  // ----- File Dialogs -----
  openVideoDialog: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openVideo'),

  saveVideoDialog: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveVideo'),

  readVideoFile: (videoPath: string): Promise<ArrayBuffer | null> =>
    ipcRenderer.invoke('file:readVideo', videoPath),

  // ----- Transcription -----
  transcribe: {
    start: (videoPath: string, options?: { model?: string; language?: string }): Promise<TranscribeResult> =>
      ipcRenderer.invoke('transcribe:start', videoPath, options),

    cancel: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('transcribe:cancel'),

    onProgress: (callback: (progress: TranscribeProgress) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: TranscribeProgress) => callback(data);
      ipcRenderer.on('transcribe:progress', handler);
      return () => ipcRenderer.removeListener('transcribe:progress', handler);
    }
  },

  // ----- Export -----
  export: {
    start: (params: { videoPath: string; outputPath: string; ffmpegCommand: string }): Promise<ExportResult> =>
      ipcRenderer.invoke('export:start', params),

    onProgress: (callback: (progress: ExportProgress) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: ExportProgress) => callback(data);
      ipcRenderer.on('export:progress', handler);
      return () => ipcRenderer.removeListener('export:progress', handler);
    }
  },

  // ----- Project Management -----
  project: {
    save: (data: string, filePath?: string): Promise<ProjectResult> =>
      ipcRenderer.invoke('project:save', data, filePath),

    load: (): Promise<ProjectResult> =>
      ipcRenderer.invoke('project:load')
  },

  // ----- Temp Files -----
  temp: {
    getWorkspace: (): Promise<string> =>
      ipcRenderer.invoke('temp:getWorkspace'),

    cleanup: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('temp:cleanup')
  },

  // ----- Model Management -----
  model: {
    list: (): Promise<{ definitions: any[]; statuses: any[] }> =>
      ipcRenderer.invoke('model:list'),

    download: (modelId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('model:download', modelId),

    cancel: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('model:cancel'),

    delete: (modelId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('model:delete', modelId),

    onDownloadProgress: (callback: (progress: {
      modelId: string;
      fileName: string;
      downloaded: number;
      total: number;
      percent: number;
      speed: number;
      eta: number;
      status: 'downloading' | 'paused' | 'completed' | 'error';
      error?: string;
    }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('model:downloadProgress', handler);
      return () => ipcRenderer.removeListener('model:downloadProgress', handler);
    }
  }
};

// ============================================================================
// Expose to Renderer
// ============================================================================

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for renderer process
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
