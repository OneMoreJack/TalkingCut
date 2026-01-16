/**
 * Model Download Context
 * =======================
 * 
 * Provides shared state for model downloads across the application.
 * This ensures all components see the same model statuses and download progress.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { MirrorSource } from '../electron/models/modelDefinitions';

export interface ModelInfo {
  id: string;
  name: string;
  size: string;
  ramRequired: string;
  description: string;
  emoji: string;
  category: 'all' | 'en';
}

export interface LocalModelStatus {
  id: string;
  installed: boolean;
  source: 'downloaded' | 'symlink' | 'none';
  path?: string;
  sizeOnDisk?: number;
}

export interface DownloadProgress {
  modelId: string;
  fileName: string;
  downloaded: number;
  total: number;
  percent: number;
  speed: number;
  eta: number;
  status: 'downloading' | 'paused' | 'completed' | 'error';
  error?: string;
}

export interface ModelWithStatus extends ModelInfo {
  status: LocalModelStatus;
}

interface ModelDownloadContextType {
  models: ModelWithStatus[];
  loading: boolean;
  error: string | null;
  downloadProgress: DownloadProgress | null;
  isDownloading: boolean;
  mirror: MirrorSource;
  downloadModel: (modelId: string) => Promise<void>;
  setMirrorSource: (source: MirrorSource) => Promise<void>;
  cancelDownload: () => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
  refreshModels: (isSilent?: boolean) => Promise<any>;
  isModelInstalled: (modelId: string) => boolean;
}

const ModelDownloadContext = createContext<ModelDownloadContextType | null>(null);

export const ModelDownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [models, setModels] = useState<ModelWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mirror, setMirror] = useState<MirrorSource>('huggingface');

  const loadModels = useCallback(async (isSilent = false) => {
    if (!window.electronAPI) return;

    try {
      if (!isSilent) setLoading(true);
      const result = await window.electronAPI.model.list();
      
      if (result.mirrorSource) {
        setMirror(result.mirrorSource);
      }

      const modelsWithStatus: ModelWithStatus[] = result.definitions.map((def: any) => {
        const status = result.statuses.find((s: any) => s.id === def.id) || {
          id: def.id,
          installed: false,
          source: 'none'
        };
        return { ...def, status };
      });

      setModels(modelsWithStatus);
      return result;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Load model list on mount
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Listen for download progress
  useEffect(() => {
    if (!window.electronAPI) return;

    const removeListener = window.electronAPI.model.onDownloadProgress((progress) => {
      console.log('[ModelDownloadContext] Download progress:', progress.status, progress.percent);
      setDownloadProgress(progress);

      // If completed, refresh model list with a small delay to ensure files are flushed
      if (progress.status === 'completed') {
        console.log('[ModelDownloadContext] Download completed! Waiting 300ms before refreshing...');
        setTimeout(() => {
          console.log('[ModelDownloadContext] Calling loadModels()...');
          loadModels(true).then((result) => {
            console.log('[ModelDownloadContext] loadModels() returned:', result?.statuses?.map((s: any) => `${s.id}: ${s.installed}`));
            setDownloadProgress(null);
          });
        }, 300);
      }

      // If error, set error state
      if (progress.status === 'error') {
        setError(progress.error || 'Download failed');
        setDownloadProgress(null);
      }
    });

    return () => removeListener();
  }, [loadModels]);

  const downloadModel = useCallback(async (modelId: string) => {
    if (!window.electronAPI) return;

    setError(null);
    setDownloadProgress({
      modelId,
      fileName: '',
      downloaded: 0,
      total: 0,
      percent: 0,
      speed: 0,
      eta: 0,
      status: 'downloading'
    });

    try {
      const result = await window.electronAPI.model.download(modelId);
      if (!result.success) {
        setError(result.error || 'Download failed');
        setDownloadProgress(null);
      }
      // Note: completed status updates are handled by the progress listener
    } catch (err) {
      setError((err as Error).message);
      setDownloadProgress(null);
    }
  }, []);

  const setMirrorSource = useCallback(async (source: MirrorSource) => {
    if (!window.electronAPI) return;
    setMirror(source);
    await window.electronAPI.model.setMirror(source);
    await loadModels(true);
  }, [loadModels]);

  const cancelDownload = useCallback(async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.model.cancel();
    setDownloadProgress(null);
  }, []);

  const deleteModel = useCallback(async (modelId: string) => {
    if (!window.electronAPI) return;

    try {
      const result = await window.electronAPI.model.delete(modelId);
      if (result.success) {
        await loadModels(true);
      } else {
        setError(result.error || 'Delete failed');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [loadModels]);

  const isModelInstalled = useCallback((modelId: string) => {
    const model = models.find(m => m.id === modelId);
    return model?.status.installed ?? false;
  }, [models]);

  const isDownloading = downloadProgress !== null && 
                       (downloadProgress.status === 'downloading' || downloadProgress.status === 'completed');

  return (
    <ModelDownloadContext.Provider value={{
      models,
      loading,
      error,
      downloadProgress,
      isDownloading,
      mirror,
      downloadModel,
      setMirrorSource,
      cancelDownload,
      deleteModel,
      refreshModels: loadModels,
      isModelInstalled
    }}>
      {children}
    </ModelDownloadContext.Provider>
  );
};

export const useModelDownload = () => {
  const context = useContext(ModelDownloadContext);
  if (!context) {
    throw new Error('useModelDownload must be used within a ModelDownloadProvider');
  }
  return context;
};

// Re-export for convenience
export type { MirrorSource };

