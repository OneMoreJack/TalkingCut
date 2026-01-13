import {
  Check,
  Download,
  FileVideo,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Redo2,
  Search,
  Trash2,
  Undo2,
  Zap
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ModelSelector from './components/ModelSelector';
import Timeline from './components/Timeline';
import WordEditor from './components/WordEditor';
import { useModelDownload } from './hooks/useModelDownload';
import { ModelSize, useProject } from './hooks/useProject';
import { generateCutList, generateFFmpegCommand } from './services/ffmpegService';

const App: React.FC = () => {
  const {
    project,
    status,
    openVideo,
    saveProject,
    toggleWordDelete,
    toggleWordsDelete,
    updateCutRanges,
    deleteFillers,
    undo,
    redo,
    canUndo,
    canRedo,
    updateDuration,
    updateSettings,
    modelSize,
    setModelSize
  } = useProject();

  const modelDownload = useModelDownload();

  const [currentTime, setCurrentTime] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const skipFlag = useRef(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [originalVideoSrc, setOriginalVideoSrc] = useState<string | null>(null);
  const [isPreviewProcessing, setIsPreviewProcessing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('talkingcut_sidebar_open');
    return saved !== null ? saved === 'true' : true;
  });
  const [showTimeline, setShowTimeline] = useState(() => {
    const saved = localStorage.getItem('talkingcut_show_timeline');
    return saved !== null ? saved === 'true' : true;
  });
  const [timelineZoom, setTimelineZoom] = useState(() => {
    const saved = localStorage.getItem('talkingcut_timeline_zoom');
    return saved !== null ? parseFloat(saved) : 1;
  });
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const [exportSuccessPath, setExportSuccessPath] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string>('darwin');

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getPlatform().then(setPlatform);
    }
  }, []);

  // Playhead Smoothing: Use requestAnimationFrame to poll video time for smoother UI
  useEffect(() => {
    let rafId: number;
    const updateTime = () => {
      if (videoRef.current && !videoRef.current.paused && !skipFlag.current) {
        setCurrentTime(videoRef.current.currentTime);
      }
      rafId = requestAnimationFrame(updateTime);
    };

    rafId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Persist UI settings
  useEffect(() => {
    localStorage.setItem('talkingcut_sidebar_open', String(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    localStorage.setItem('talkingcut_show_timeline', String(showTimeline));
  }, [showTimeline]);

  useEffect(() => {
    localStorage.setItem('talkingcut_timeline_zoom', String(timelineZoom));
  }, [timelineZoom]);

  // Sync isPlaying state with video events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);

    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
    };
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) videoRef.current.play();
      else videoRef.current.pause();
    }
  };

  // 1. Export Logic
  const handleExport = async () => {
    if (!project || !window.electronAPI) return;

    const outputPath = await window.electronAPI.saveVideoDialog();
    if (!outputPath) return;

    const ffmpegCommand = generateFFmpegCommand(project, outputPath);
    if (!ffmpegCommand) return;

    const res = await window.electronAPI.export.start({
      videoPath: project.videoPath,
      outputPath,
      ffmpegCommand
    });

    if (res.success) {
      setExportSuccessPath(outputPath);
      // Auto-hide after 10 seconds unless interacted with
      setTimeout(() => setExportSuccessPath(prev => prev === outputPath ? null : prev), 10000);
    }
  };

  const handleOpenExportFolder = () => {
    if (exportSuccessPath && window.electronAPI) {
      window.electronAPI.shell.showItemInFolder(exportSuccessPath);
    }
  };

  const handlePlayExportedVideo = () => {
    if (exportSuccessPath && window.electronAPI) {
      window.electronAPI.shell.openPath(exportSuccessPath);
    }
  };

  // Calculate the kept segments whenever project segments or settings change
  const activeCuts = useMemo(() => {
    if (!project) return [];
    return generateCutList(project);
  }, [project?.cutRanges, project?.settings.paddingStart, project?.settings.paddingEnd]);

  const handleApply = async () => {
    if (!project) return;
    
    // Always enable live preview and restart playback
    setIsPreviewMode(true);
    
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(e => console.warn('Play blocked:', e));
    }
    setCurrentTime(0);
  };

  const exitPreview = () => {
    setIsPreviewMode(false);
  };


  // ... (Virtual Preview and keyboard shortcuts logic remains same)

  // Filter segments for search
  const filteredSegments = useMemo(() => {
    if (!project) return [];
    if (!searchTerm) return project.segments;
    return project.segments.filter(s => 
      s.text.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [project, searchTerm]);

  // Video source state for Electron-safe playback
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  // Convert video file to Blob URL for safe playback in Electron
  useEffect(() => {
    if (!project) {
      setVideoSrc(null);
      return;
    }

    // Read the video file and create a Blob URL
    const loadVideo = async () => {
      try {
        const buffer = await window.electronAPI.readVideoFile(project.videoPath);
        if (!buffer) {
          throw new Error('Failed to read video file');
        }
        const blob = new Blob([buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        setVideoSrc(url);
      } catch (error) {
        console.error('[App] Failed to load video:', error);
        setVideoSrc(null);
      }
    };

    loadVideo();

    // Cleanup: revoke the Blob URL when component unmounts or project changes
    return () => {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [project?.id]);

  // Handle word and timeline clicks
  const handleJumpToTime = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setCurrentTime(time);
  };

  const handleSelectionChange = (range: { start: number; end: number } | null) => {
    setSelectionRange(range);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      updateDuration(videoRef.current.duration);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Global Top Header (CapCut Style) */}
      <header 
        className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/80 backdrop-blur-md z-50 flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        {/* Left: Traffic light area (reserved) */}
        <div className="w-20" />

        {/* Center: Project Name */}
        <div className="flex items-center space-x-2 text-zinc-400 select-none">
          <FileVideo size={16} className="text-indigo-400" />
          <span className="text-sm font-medium tracking-tight">
            {project ? project.name : 'TalkingCut - Video Editor'}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button 
            disabled={!project}
            onClick={handleExport}
            className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold transition-all disabled:opacity-50 shadow-md"
          >
            <Download size={14} />
            <span>Export Final Cut</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Settings & File Info */}
        <aside className={`border-r border-zinc-800 flex flex-col p-4 space-y-6 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-80' : 'w-0 p-0 overflow-hidden border-none'}`}>

        <div className="space-y-4">
          {/* Model Selector with Download Status */}
          <div className="block">
            <span className="text-xs uppercase font-semibold text-zinc-500 mb-2 block">AI Model</span>
            <div className="space-y-4">
              <ModelSelector
                currentModelId={modelSize}
                onSelect={(id) => setModelSize(id as ModelSize)}
                models={modelDownload.models}
                downloadProgress={modelDownload.downloadProgress}
                onDownload={modelDownload.downloadModel}
                onCancel={modelDownload.cancelDownload}
                onDelete={modelDownload.deleteModel}
                isDownloading={modelDownload.isDownloading}
              />
            </div>
          </div>

          {/* Open Video */}
          <div className="block">
            <span className="text-xs uppercase font-semibold text-zinc-500 mb-2 block">Project</span>
            <div 
              onClick={async () => {
                const isInstalled = modelDownload.isModelInstalled(modelSize);
                if (!isInstalled) {
                  // Automatically start download if not installed
                  if (!modelDownload.isDownloading) {
                    await modelDownload.downloadModel(modelSize);
                  }
                  return;
                }
                openVideo();
              }}
              className="relative group cursor-pointer border-2 border-dashed border-zinc-700 rounded-xl p-6 hover:border-indigo-500 transition-colors flex flex-col items-center"
            >
              <FileVideo className="text-zinc-500 group-hover:text-indigo-400 mb-2" />
              <p className="text-xs text-center text-zinc-400">
                {project ? project.name : 'Open Video File'}
              </p>
              {!modelDownload.isModelInstalled(modelSize) && (
                <div className="mt-2 px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-[10px] rounded-full animate-pulse font-medium">
                  {modelDownload.isDownloading ? 'Downloading model...' : 'Model download required'}
                </div>
              )}
            </div>
          </div>

          <div className="p-3 bg-zinc-900 rounded-lg space-y-2">
            <h3 className="text-xs uppercase font-semibold text-zinc-500">Project Settings</h3>
            <div className="flex justify-between items-center text-sm opacity-50 pointer-events-none">
               <span className="text-zinc-500 italic">Advanced settings hidden</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className={!project ? "text-zinc-600" : ""}>Crossfade</span>
              <div className="flex items-center bg-zinc-800 rounded px-2 py-0.5">
                <input 
                  disabled={!project}
                  type="number" step="0.01" min="0" max="1"
                  className="w-12 bg-transparent outline-none focus:ring-0 text-right disabled:opacity-50"
                  value={project?.settings.crossfadeDuration ?? 0.02}
                  onChange={(e) => updateSettings({ crossfadeDuration: parseFloat(e.target.value) || 0.02 })}
                />
                <span className="text-zinc-500 ml-1 text-xs">s</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className={!project ? "text-zinc-600" : ""}>Silence Threshold</span>
              <div className="flex items-center bg-zinc-800 rounded px-2 py-0.5">
                <input 
                  disabled={!project}
                  type="number" step="0.1" min="0.1" max="10"
                  className="w-12 bg-transparent outline-none focus:ring-0 text-right disabled:opacity-50"
                  value={project?.settings.silenceThreshold ?? 1.0}
                  onChange={(e) => updateSettings({ silenceThreshold: parseFloat(e.target.value) || 1.0 })}
                />
                <span className="text-zinc-500 ml-1 text-xs">s</span>
              </div>
            </div>
          </div>
        </div>

        {status.step !== 'idle' && (
          <div className="mt-auto space-y-2">
            <div className="flex justify-between text-xs text-zinc-400">
              <span className="capitalize">{status.step}: {status.message}</span>
              <span>{Math.round(status.progress)}%</span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-300" 
                style={{ width: `${status.progress}%` }}
              ></div>
            </div>
          </div>
        )}
      </aside>

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col bg-zinc-950 overflow-hidden relative">


        <div className="flex-1 flex flex-row overflow-hidden border-b border-zinc-800">
          {/* Transcript Section */}
          <div className="w-1/2 min-w-[400px] flex flex-col bg-zinc-900 border-r border-zinc-800">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 h-14">
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                  title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
                >
                  {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                </button>
                <div className="flex items-center space-x-3 bg-zinc-800/50 rounded-md px-3 py-1 border border-zinc-800">
                  <Search size={14} className="text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="Search transcript..."
                    className="bg-transparent border-none outline-none text-sm w-48 h-6"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button 
                  disabled={!canUndo} 
                  onClick={undo}
                  className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 disabled:opacity-20 transition-colors"
                  title="Undo"
                >
                  <Undo2 size={16} />
                </button>
                <button 
                  disabled={!canRedo} 
                  onClick={redo}
                  className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 disabled:opacity-20 transition-colors"
                  title="Redo"
                >
                  <Redo2 size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {project ? (
                <WordEditor 
                  segments={project.segments} 
                  currentTime={currentTime}
                  onToggleDelete={toggleWordDelete}
                  onToggleWordsDelete={toggleWordsDelete}
                  onWordClick={handleJumpToTime}
                  searchTerm={searchTerm}
                  breakGap={project.settings.silenceThreshold ?? 1.0}
                  selectionRange={selectionRange}
                  onSelectionChange={handleSelectionChange}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 p-8 text-center">
                  <FileVideo size={48} className="mb-4 opacity-10" />
                  <p className="text-sm">Wait for processing to complete or open a video file</p>
                </div>
              )}
            </div>
          </div>

          {/* Video Preview Section */}
          <div className="flex-1 flex items-center justify-center p-8 bg-black relative group">
            {project ? (
              <div className="relative w-full h-full max-w-4xl flex items-center justify-center">
                <video 
                  ref={videoRef}
                  src={videoSrc || undefined}
                  className="max-w-full max-h-full rounded-lg shadow-2xl"
                  onLoadedMetadata={handleLoadedMetadata}
                  onClick={togglePlay}
                  onTimeUpdate={(e) => {
                      const v = e.currentTarget;
                      const time = v.currentTime;
                      
                      if (!skipFlag.current) {
                        // Note: currentTime is also updated by the rAF loop for smoothness
                        // but we keep this as a fallback and to trigger immediate updates on pause/seek
                        setCurrentTime(time);
                      }

                      // Live Preview Skipping Logic
                      // Suspend skipping when dragging timeline to avoid jumping
                      if (isPreviewMode && !skipFlag.current && !isDraggingTimeline) {
                        const inCut = activeCuts.some(cut => time >= cut.start && time < cut.end);
                        if (!inCut) {
                          const nextCut = activeCuts.find(cut => cut.start > time);
                          if (nextCut) {
                            skipFlag.current = true;
                            v.currentTime = nextCut.start;
                            setTimeout(() => { skipFlag.current = false; }, 50);
                          } else if (activeCuts.length > 0) {
                            // Hit end of all cuts
                            v.pause();
                            const lastCut = activeCuts[activeCuts.length - 1];
                            v.currentTime = lastCut.end;
                          }
                        }
                      }
                  }}
                />
                
                {isPreviewMode && (
                  <div className="absolute top-4 right-4 px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full shadow-lg flex items-center space-x-1.5 animate-pulse">
                    <Check size={12} />
                    <span>PREVIEW MODE</span>
                  </div>
                )}
                
                  {isPreviewMode && (
                    <button 
                      onClick={exitPreview}
                      className="absolute top-4 left-4 px-3 py-1 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white rounded-full text-[10px] font-bold uppercase transition-all flex items-center space-x-1 border border-red-600/30"
                    >
                      <span>Exit Preview</span>
                    </button>
                  )}
                </div>
            ) : (
                <div className="flex flex-col items-center text-zinc-700">
                  <FileVideo size={64} className="mb-4 opacity-10" />
                  <p className="text-sm">Video area</p>
                </div>
            )}
          </div>
        </div>

        {/* Bottom Area: Controls & Timeline */}
        <div className="bg-zinc-900 flex flex-col">
          {/* Main Control Bar */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50">
            {/* Left: Transcription & Cut Actions */}
            <div className="flex items-center space-x-3 w-1/3">
              <button
                disabled={!project || isPreviewProcessing}
                onClick={handleApply}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-semibold transition-colors disabled:opacity-30 border border-indigo-500/20"
              >
                {isPreviewProcessing ? (
                  <div className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                ) : (
                  <Zap size={14} className="fill-current" />
                )}
                <span>Apply</span>
              </button>

              <button 
                disabled={!project}
                onClick={deleteFillers}
                className="flex items-center space-x-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
                <span>Auto-Cut Silence</span>
              </button>
            </div>

            {/* Center: Video Playback Controls */}
            <div className="flex items-center justify-center space-x-4 w-1/3">
              <button 
                onClick={togglePlay}
                className="p-2.5 bg-indigo-600 text-white rounded-full hover:scale-105 transition-transform flex items-center justify-center"
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              </button>
              <div className="flex items-center">
                <span className="text-sm font-mono tabular-nums text-white">
                  {currentTime.toFixed(1)} <span className="text-zinc-500 mx-1">/</span> {project?.duration.toFixed(1) || '0.0'}s
                </span>
              </div>
            </div>

            {/* Right: View & Zoom Controls */}
            <div className="flex items-center justify-end space-x-4 w-1/3">
              <div className="flex items-center space-x-2 bg-zinc-800 rounded-lg px-3 py-1.5">
                <Search size={14} className="text-zinc-500" />
                <input 
                  type="range" min="1" max="100" step="1"
                  value={timelineZoom * 10}
                  onChange={(e) => setTimelineZoom(parseInt(e.target.value) / 10)}
                  className="w-24 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="text-[10px] text-zinc-500 font-mono w-6">{timelineZoom.toFixed(1)}x</span>
              </div>
              <button 
                onClick={() => setShowTimeline(!showTimeline)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${showTimeline ? 'bg-zinc-800 text-zinc-400' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'}`}
              >
                {showTimeline ? <span>Hide Timeline</span> : <span>Show Timeline</span>}
              </button>
            </div>
          </div>

          {/* Timeline / Progress Bar Area */}
          <div className="relative">
            {showTimeline ? (
              project && (
                <Timeline 
                  segments={project.segments}
                  duration={project.duration}
                  currentTime={currentTime}
                  onTimeClick={handleJumpToTime}
                  zoom={timelineZoom}
                  audioPath={project.audioPath}
                  selectionRange={selectionRange}
                  onSelectionChange={handleSelectionChange}
                  cutRanges={project.cutRanges}
                  onUpdateCutRanges={updateCutRanges}
                  onStatusChange={(status) => setIsDraggingTimeline(status.isDragging)}
                  isPlaying={isPlaying}
                />
              )
            ) : (
              <div 
                className="h-1 bg-zinc-800 cursor-pointer overflow-hidden group"
                onClick={(e) => {
                  if (!project) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  handleJumpToTime((x / rect.width) * project.duration);
                }}
              >
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${(currentTime / (project?.duration || 1)) * 100}%` }}
                />
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100" />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
      {/* Export Success Notification */}
      {exportSuccessPath && (
        <div className="fixed bottom-24 right-8 z-[100] animate-in slide-in-from-right-8 duration-300">
          <div className="bg-zinc-800 border border-emerald-500/30 shadow-2xl shadow-emerald-500/10 rounded-xl p-4 min-w-[320px] backdrop-blur-xl">
            <div className="flex items-start space-x-4">
              <div className="bg-emerald-500/20 p-2 rounded-lg">
                <Check size={20} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-semibold text-sm mb-1">Export Successful</h4>
                <p className="text-zinc-400 text-xs truncate mb-3">{exportSuccessPath.split(/[\\/]/).pop()}</p>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={handlePlayExportedVideo}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <Play size={12} fill="currentColor" />
                    <span>Play Video</span>
                  </button>
                  <button 
                    onClick={handleOpenExportFolder}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg text-xs font-medium transition-colors"
                  >
                    <FolderOpen size={12} />
                    <span>{platform === 'darwin' ? 'Show in Finder' : 'Show in Explorer'}</span>
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setExportSuccessPath(null)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors pt-0.5"
              >
                <Zap size={14} className="rotate-45" /> {/* Close icon workaround with Zap rotated */}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;