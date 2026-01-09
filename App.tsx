import {
    Download,
    FileVideo,
    Play,
    Redo2,
    Scissors,
    Search,
    Trash2,
    Undo2
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import WordEditor from './components/WordEditor';
import { useProject } from './hooks/useProject';

import Timeline from './components/Timeline';

const App: React.FC = () => {
  const {
    project,
    status,
    openVideo,
    saveProject,
    toggleWordDelete,
    deleteFillers,
    undo,
    redo,
    canUndo,
    canRedo,
    updateDuration
  } = useProject();

  const [currentTime, setCurrentTime] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const skipFlag = useRef(false);

  // ... (Virtual Preview and keyboard shortcuts logic remains same)

  // Filter segments for search
  const filteredSegments = useMemo(() => {
    if (!project) return [];
    if (!searchTerm) return project.segments;
    return project.segments.filter(s => 
      s.text.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [project, searchTerm]);

  // Handle word and timeline clicks
  const handleJumpToTime = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play();
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      updateDuration(videoRef.current.duration);
    }
  };

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Sidebar - Settings & File Info */}
      <aside className="w-80 border-r border-zinc-800 flex flex-col p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xl">
            <Scissors size={24} />
            <span>TalkingCut</span>
          </div>
          <div className="flex space-x-1">
             <button 
              disabled={!canUndo} 
              onClick={undo}
              className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 disabled:opacity-20"
            >
              <Undo2 size={16} />
            </button>
            <button 
              disabled={!canRedo} 
              onClick={redo}
              className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 disabled:opacity-20"
            >
              <Redo2 size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="block">
            <span className="text-xs uppercase font-semibold text-zinc-500 mb-2 block">Project</span>
            <div 
              onClick={openVideo}
              className="relative group cursor-pointer border-2 border-dashed border-zinc-700 rounded-xl p-6 hover:border-indigo-500 transition-colors flex flex-col items-center"
            >
              <FileVideo className="text-zinc-500 group-hover:text-indigo-400 mb-2" />
              <p className="text-xs text-center text-zinc-400">
                {project ? project.name : 'Open Video File'}
              </p>
            </div>
          </div>

          {project && (
            <>
              <div className="p-3 bg-zinc-900 rounded-lg space-y-2">
                <h3 className="text-xs uppercase font-semibold text-zinc-500">Project Settings</h3>
                <div className="flex justify-between items-center text-sm">
                  <span>Start Padding</span>
                  <input 
                    type="number" step="0.1" 
                    className="w-16 bg-zinc-800 rounded px-2 py-1 outline-none focus:ring-1 ring-indigo-500"
                    value={project.settings.paddingStart}
                    onChange={() => {}} 
                  />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>End Padding</span>
                  <input 
                    type="number" step="0.1" 
                    className="w-16 bg-zinc-800 rounded px-2 py-1 outline-none focus:ring-1 ring-indigo-500"
                    value={project.settings.paddingEnd}
                    onChange={() => {}} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <button 
                  onClick={deleteFillers}
                  className="w-full flex items-center justify-center space-x-2 bg-zinc-800 hover:bg-zinc-700 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Trash2 size={16} />
                  <span>Auto-Cut Silence & Fillers</span>
                </button>
                <button 
                  onClick={() => {/* TODO: Export UI */}}
                  className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download size={16} />
                  <span>Export Final Cut</span>
                </button>
              </div>
            </>
          )}
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-black">
        {/* Video Preview */}
        <div className="flex-1 flex flex-col bg-zinc-950">
          <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
            {project ? (
              <div className="w-full max-w-4xl aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl relative group">
                <video 
                  ref={videoRef}
                  src={`file://${project.videoPath}`}
                  className="w-full h-full object-contain"
                  onLoadedMetadata={handleLoadedMetadata}
                  onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
                />
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center space-x-4">
                      <button 
                        onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
                        className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform"
                      >
                        <Play size={20} fill="currentColor" />
                      </button>
                      <div className="flex-1 h-1 bg-zinc-600 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500" 
                          style={{ width: `${(currentTime / (project?.duration || 1)) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs tabular-nums text-white">
                        {currentTime.toFixed(1)} / {project.duration.toFixed(1)}s
                      </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-zinc-600">
                <FileVideo size={64} className="mb-4 opacity-20" />
                <p>Open a video file to start text-based editing</p>
              </div>
            )}
          </div>
          
          {project && (
            <Timeline 
              segments={project.segments}
              duration={project.duration}
              currentTime={currentTime}
              onTimeClick={handleJumpToTime}
            />
          )}
        </div>

        {/* Text-Based Editor Section */}
        <div className="h-1/2 bg-zinc-900 border-t border-zinc-800 flex flex-col">
          <div className="flex items-center justify-between px-8 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-400">Transcript</h2>
            <div className="flex items-center bg-zinc-800 rounded-md px-3 py-1.5 w-64">
              <Search size={14} className="text-zinc-500 mr-2" />
              <input 
                type="text" 
                placeholder="Search words..."
                className="bg-transparent border-none outline-none text-xs w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {project && (
              <WordEditor 
                segments={project.segments} 
                currentTime={currentTime}
                onToggleDelete={toggleWordDelete}
                onWordClick={handleJumpToTime}
                searchTerm={searchTerm}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;