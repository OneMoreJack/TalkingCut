import { useCallback, useEffect, useState } from 'react';
import { ProcessingStatus, VideoProject, WordSegment, WordType } from '../types/index';

export const useProject = () => {
  const [project, setProject] = useState<VideoProject | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ step: 'idle', progress: 0, message: '' });
  const [history, setHistory] = useState<WordSegment[][]>([]);
  const [redoStack, setRedoStack] = useState<WordSegment[][]>([]);

  // 1. Electron IPC Listeners
  useEffect(() => {
    if (!window.electronAPI) return;

    const removeTranscribeListener = window.electronAPI.transcribe.onProgress((data) => {
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
    if (!window.electronAPI) return;

    const videoPath = await window.electronAPI.openVideoDialog();
    if (!videoPath) return;

    setStatus({ step: 'extracting', progress: 0, message: 'Starting transcription...' });

    const result = await window.electronAPI.transcribe.start(videoPath);

    if (result.success && result.segments) {
      const name = videoPath.split(/[\\/]/).pop() || 'Untitled';

      // We need duration from electron if possible, but for now we can estimate or wait for video load
      // Ideally transcribe:start should return duration too

      setProject({
        id: Math.random().toString(36).substr(2, 9),
        name,
        videoPath,
        duration: result.segments.length > 0 ? result.segments[result.segments.length - 1].end : 0,
        segments: result.segments as any,
        settings: { paddingStart: 0.1, paddingEnd: 0.1, minSilenceDuration: 0.5, crossfadeDuration: 0.02 }
      });
      setStatus({ step: 'idle', progress: 100, message: 'Done' });
      setHistory([]);
      setRedoStack([]);
    } else {
      setStatus({ step: 'idle', progress: 0, message: `Error: ${result.error}` });
    }
  }, []);

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

  const toggleWordDelete = useCallback((id: string) => {
    if (!project) return;

    // Save to history before change
    setHistory(prev => [...prev, project.segments]);
    setRedoStack([]);

    setProject({
      ...project,
      segments: project.segments.map(s => s.id === id ? { ...s, deleted: !s.deleted } : s)
    });
  }, [project]);

  const deleteFillers = useCallback(() => {
    if (!project) return;

    // Save to history before change
    setHistory(prev => [...prev, project.segments]);
    setRedoStack([]);

    setProject({
      ...project,
      segments: project.segments.map(s =>
        s.type === WordType.FILLER || (s.type === WordType.SILENCE && (s.end - s.start) > 0.5)
          ? { ...s, deleted: true }
          : s
      )
    });
  }, [project]);

  const undo = useCallback(() => {
    if (history.length === 0 || !project) return;

    const prevSegments = history[history.length - 1];
    setRedoStack(prev => [...prev, project.segments]);
    setHistory(prev => prev.slice(0, -1));

    setProject({
      ...project,
      segments: prevSegments
    });
  }, [history, project]);

  const redo = useCallback(() => {
    if (redoStack.length === 0 || !project) return;

    const nextSegments = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, project.segments]);
    setRedoStack(prev => prev.slice(0, -1));

    setProject({
      ...project,
      segments: nextSegments
    });
  }, [redoStack, project]);

  const updateDuration = useCallback((duration: number) => {
    if (!project) return;
    setProject(prev => prev ? { ...prev, duration } : null);
  }, [project]);

  return {
    project,
    status,
    openVideo,
    saveProject,
    toggleWordDelete,
    deleteFillers,
    undo,
    redo,
    canUndo: history.length > 0,
    canRedo: redoStack.length > 0,
    updateDuration,
    updateSettings
  };
};
