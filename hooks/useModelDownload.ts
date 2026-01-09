/**
 * useModelDownload Hook
 * ======================
 * 
 * React hook for managing model downloads with progress tracking.
 */

import { useCallback, useEffect, useState } from 'react';

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

export const useModelDownload = () => {
  const [models, setModels] = useState<ModelWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load model list on mount
  useEffect(() => {
    loadModels();
  }, []);

  // Listen for download progress
  useEffect(() => {
    if (!window.electronAPI) return;

    const removeListener = window.electronAPI.model.onDownloadProgress((progress) => {
      setDownloadProgress(progress);

      // If completed, refresh model list
      if (progress.status === 'completed') {
        setTimeout(() => {
          loadModels();
          setDownloadProgress(null);
        }, 500);
      }

      // If error, set error state
      if (progress.status === 'error') {
        setError(progress.error || 'Download failed');
      }
    });

    return () => removeListener();
  }, []);

  const loadModels = useCallback(async () => {
    if (!window.electronAPI) return;

    try {
      setLoading(true);
      const result = await window.electronAPI.model.list();

      const modelsWithStatus: ModelWithStatus[] = result.definitions.map((def: any) => {
        const status = result.statuses.find((s: any) => s.id === def.id) || {
          id: def.id,
          installed: false,
          source: 'none'
        };
        return { ...def, status };
      });

      setModels(modelsWithStatus);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

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
    } catch (err) {
      setError((err as Error).message);
      setDownloadProgress(null);
    }
  }, []);

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
        await loadModels();
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

  const isDownloading = downloadProgress !== null && downloadProgress.status === 'downloading';

  return {
    models,
    loading,
    error,
    downloadProgress,
    isDownloading,
    downloadModel,
    cancelDownload,
    deleteModel,
    refreshModels: loadModels,
    isModelInstalled
  };
};
