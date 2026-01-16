import { useCallback, useEffect, useState } from 'react';
import { ProcessingStatus, VideoProject, WordSegment, WordType } from '../types/index';

export type ModelSize = 'tiny' | 'base' | 'small' | 'medium' | 'large-v3-turbo';

export const useProject = () => {
  const [project, setProject] = useState<VideoProject | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ step: 'idle', progress: 0, message: '' });
  const [history, setHistory] = useState<{ segments: WordSegment[], cutRanges: any[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ segments: WordSegment[], cutRanges: any[] }[]>([]);

  // Persist modelSize
  const [modelSize, setModelSizeState] = useState<ModelSize>(() => {
    return (localStorage.getItem('talkingcut_model_size') as ModelSize) || 'base';
  });

  const setModelSize = useCallback((size: ModelSize) => {
    setModelSizeState(size);
    localStorage.setItem('talkingcut_model_size', size);
  }, []);

  // 1. Electron IPC Listeners
  useEffect(() => {
    if (!window.electronAPI) return;

    const removeTranscribeListener = window.electronAPI.transcribe.onProgress((data) => {
      console.log('[useProject] Progress:', data);
      setStatus({
        step: data.step as any,
        progress: data.progress,
        message: data.message
      });
    });

    const removeExportListener = window.electronAPI.export.onProgress((data) => {
      setStatus({
        step: 'exporting',
        progress: data.progress,
        message: data.message
      });
    });

    return () => {
      removeTranscribeListener();
      removeExportListener();
    };
  }, []);

  // 2. Project Actions
  const openVideo = useCallback(async () => {
    if (!window.electronAPI) {
      console.error('[useProject] electronAPI not available');
      return;
    }

    try {
      const videoPath = await window.electronAPI.openVideoDialog();
      if (!videoPath) return;

      console.log('[useProject] Starting transcription for:', videoPath);
      setStatus({ step: 'extracting', progress: 0, message: 'Starting transcription...' });

      const result = await window.electronAPI.transcribe.start(videoPath, {
        model: modelSize,
        language: undefined // Auto-detect
      });

      console.log('[useProject] Transcription result:', result);

      if (result.success && result.segments) {
        const name = videoPath.split(/[\\/]/).pop() || 'Untitled';

        setProject({
          id: Math.random().toString(36).substr(2, 9),
          name,
          videoPath,
          audioPath: result.audioPath,
          duration: result.segments.length > 0 ? result.segments[result.segments.length - 1].end : 0,
          segments: result.segments as any,
          cutRanges: [],
          settings: { paddingStart: 0.1, paddingEnd: 0.1, minSilenceDuration: 0.5, crossfadeDuration: 0.02, silenceThreshold: 1.0 }
        });
        setStatus({ step: 'idle', progress: 100, message: 'Done' });
        setHistory([]);
        setRedoStack([]);
      } else {
        console.error('[useProject] Transcription failed:', result.error);
        setStatus({ step: 'idle', progress: 0, message: `Error: ${result.error}` });
      }
    } catch (error) {
      console.error('[useProject] Exception during transcription:', error);
      setStatus({ step: 'idle', progress: 0, message: `Error: ${(error as Error).message}` });
    }
  }, [modelSize]);

  const updateSettings = useCallback((newSettings: Partial<VideoProject['settings']>) => {
    if (!project) return;
    setProject({
      ...project,
      settings: { ...project.settings, ...newSettings }
    });
  }, [project]);

  const saveProject = useCallback(async () => {
    if (!project || !window.electronAPI) return;
    const data = JSON.stringify(project);
    const result = await window.electronAPI.project.save(data);
    return result;
  }, [project]);

  const saveHistory = useCallback(() => {
    if (!project) return;
    setHistory(prev => [...prev.slice(-49), { segments: project.segments, cutRanges: project.cutRanges }]);
    setRedoStack([]);
  }, [project]);

  const updateCutRanges = useCallback((newRanges: { id: string, start: number, end: number }[]) => {
    if (!project) return;

    // Sync words deleted state based on ranges
    const syncedSegments = project.segments.map(s => {
      const mid = (s.start + s.end) / 2;
      const isDeleted = newRanges.some(r => mid >= r.start && mid <= r.end);
      return { ...s, deleted: isDeleted };
    });

    setProject({
      ...project,
      segments: syncedSegments,
      cutRanges: newRanges
    });
  }, [project]);

  const toggleWordDelete = useCallback((id: string) => {
    if (!project) return;
    saveHistory();

    const word = project.segments.find(s => s.id === id);
    if (!word) return;

    let newCutRanges = [...project.cutRanges];
    if (word.deleted) {
      // Remove ranges that cover this word
      newCutRanges = newCutRanges.filter(r => !((word.start + word.end) / 2 >= r.start && (word.start + word.end) / 2 <= r.end));
    } else {
      // Add a new cut range for this word
      newCutRanges.push({ id: Math.random().toString(36).substr(2, 9), start: word.start, end: word.end });
    }

    updateCutRanges(newCutRanges);
  }, [project, saveHistory, updateCutRanges]);

  const toggleWordsDelete = useCallback((ids: string[]) => {
    if (!project) return;
    saveHistory();

    const selectedWords = project.segments.filter(s => ids.includes(s.id));
    if (selectedWords.length === 0) return;

    const allAlreadyDeleted = selectedWords.every(w => w.deleted);
    let newCutRanges = [...project.cutRanges];

    if (allAlreadyDeleted) {
      // Restore: remove ranges that overlap with these words
      newCutRanges = newCutRanges.filter(r =>
        !selectedWords.some(w => (w.start + w.end) / 2 >= r.start && (w.start + w.end) / 2 <= r.end)
      );
    } else {
      // Delete: add a single range covering all selected words
      const start = Math.min(...selectedWords.map(w => w.start));
      const end = Math.max(...selectedWords.map(w => w.end));
      newCutRanges.push({ id: Math.random().toString(36).substr(2, 9), start, end });
    }

    updateCutRanges(newCutRanges);
  }, [project, saveHistory, updateCutRanges]);

  const deleteFillers = useCallback(() => {
    if (!project) return;
    saveHistory();

    const newRanges = [...project.cutRanges];
    project.segments.forEach(s => {
      if (s.type === WordType.FILLER || (s.type === WordType.SILENCE && (s.end - s.start) >= (project.settings.silenceThreshold ?? 1.0))) {
        if (!newRanges.some(r => s.start >= r.start && s.end <= r.end)) {
          newRanges.push({ id: Math.random().toString(36).substr(2, 9), start: s.start, end: s.end });
        }
      }
    });

    updateCutRanges(newRanges);
  }, [project, saveHistory, updateCutRanges]);

  const undo = useCallback(() => {
    if (history.length === 0 || !project) return;

    const prevState = history[history.length - 1];
    setRedoStack(prev => [...prev, { segments: project.segments, cutRanges: project.cutRanges }]);
    setHistory(prev => prev.slice(0, -1));

    setProject({
      ...project,
      segments: prevState.segments,
      cutRanges: prevState.cutRanges
    });
  }, [history, project]);

  const redo = useCallback(() => {
    if (redoStack.length === 0 || !project) return;

    const nextState = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, { segments: project.segments, cutRanges: project.cutRanges }]);
    setRedoStack(prev => prev.slice(0, -1));

    setProject({
      ...project,
      segments: nextState.segments,
      cutRanges: nextState.cutRanges
    });
  }, [redoStack, project]);

  const updateDuration = useCallback((duration: number) => {
    if (!project) return;
    setProject(prev => prev ? { ...prev, duration } : null);
  }, [project]);

  const cancelTranscribe = useCallback(async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.transcribe.cancel();
    setStatus({ step: 'idle', progress: 0, message: 'Cancelled' });
  }, []);

  return {
    project,
    status,
    openVideo,
    saveProject,
    toggleWordDelete,
    toggleWordsDelete,
    updateCutRanges,
    saveHistory,
    deleteFillers,
    undo,
    redo,
    canUndo: history.length > 0,
    canRedo: redoStack.length > 0,
    updateDuration,
    updateSettings,
    modelSize,
    setModelSize,
    cancelTranscribe
  };
};
