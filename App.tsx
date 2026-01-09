import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Scissors, 
  Trash2, 
  RotateCcw, 
  Play, 
  Settings, 
  FileVideo, 
  Download,
  AlertCircle,
  Clock
} from 'lucide-react';
import { WordSegment, VideoProject, WordType, ProcessingStatus } from './types';
import WordEditor from './components/WordEditor';

const App: React.FC = () => {
  const [project, setProject] = useState<VideoProject | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ step: 'idle', progress: 0, message: '' });
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Mock initial project for demonstration
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // In a real Electron app, this would trigger IPC to run Python transcribe.py
    setStatus({ step: 'transcribing', progress: 20, message: 'Running WhisperX (mps optimized)...' });
    
    setTimeout(() => {
      const mockSegments: WordSegment[] = [
        { id: '1', text: '大家好', start: 0.5, end: 1.2, confidence: 0.99, type: WordType.WORD, deleted: false },
        { id: '2', text: '那个', start: 1.2, end: 1.8, confidence: 0.85, type: WordType.FILLER, deleted: false },
        { id: '3', text: '今天', start: 1.8, end: 2.3, confidence: 0.98, type: WordType.WORD, deleted: false },
        { id: '4', text: '[静音]', start: 2.3, end: 3.5, confidence: 1.0, type: WordType.SILENCE, deleted: false },
        { id: '5', text: '我们', start: 3.5, end: 4.0, confidence: 0.99, type: WordType.WORD, deleted: false },
        { id: '6', text: '来', start: 4.0, end: 4.2, confidence: 0.97, type: WordType.WORD, deleted: false },
        { id: '7', text: '聊聊', start: 4.2, end: 4.8, confidence: 0.99, type: WordType.WORD, deleted: false },
        { id: '8', text: 'AI', start: 4.8, end: 5.2, confidence: 0.95, type: WordType.WORD, deleted: false },
        { id: '9', text: '剪辑', start: 5.2, end: 5.8, confidence: 0.98, type: WordType.WORD, deleted: false },
      ];

      setProject({
        id: 'p1',
        name: 'Demo Video',
        videoPath: 'https://www.w3schools.com/html/mov_bbb.mp4',
        duration: 10,
        segments: mockSegments,
        settings: { paddingStart: 0.1, paddingEnd: 0.1, minSilenceDuration: 0.5 }
      });
      setStatus({ step: 'idle', progress: 100, message: 'Done' });
    }, 2000);
  };

  const toggleWordDelete = (id: string) => {
    if (!project) return;
    setProject({
      ...project,
      segments: project.segments.map(s => s.id === id ? { ...s, deleted: !s.deleted } : s)
    });
  };

  const deleteFillers = () => {
    if (!project) return;
    setProject({
      ...project,
      segments: project.segments.map(s => 
        s.type === WordType.FILLER || (s.type === WordType.SILENCE && (s.end - s.start) > 0.5)
        ? { ...s, deleted: true } 
        : s
      )
    });
  };

  const handleWordClick = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play();
    }
  };

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Sidebar - Settings & File Info */}
      <aside className="w-80 border-r border-zinc-800 flex flex-col p-4 space-y-6">
        <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xl">
          <Scissors size={24} />
          <span>TalkingCut</span>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-xs uppercase font-semibold text-zinc-500 mb-2 block">Upload Video</span>
            <div className="relative group cursor-pointer border-2 border-dashed border-zinc-700 rounded-xl p-6 hover:border-indigo-500 transition-colors flex flex-col items-center">
              <FileVideo className="text-zinc-500 group-hover:text-indigo-400 mb-2" />
              <p className="text-xs text-center text-zinc-400">Drag or click to import MP4/MOV</p>
              <input type="file" accept="video/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} />
            </div>
          </label>

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
                    onChange={(e) => setProject({...project, settings: {...project.settings, paddingStart: parseFloat(e.target.value)}})}
                  />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>End Padding</span>
                  <input 
                    type="number" step="0.1" 
                    className="w-16 bg-zinc-800 rounded px-2 py-1 outline-none focus:ring-1 ring-indigo-500"
                    value={project.settings.paddingEnd}
                    onChange={(e) => setProject({...project, settings: {...project.settings, paddingEnd: parseFloat(e.target.value)}})}
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
                <button className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 py-2 rounded-lg text-sm font-medium transition-colors">
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
              <span>{status.message}</span>
              <span>{Math.round(status.progress)}%</span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${status.progress}%` }}></div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-black">
        {/* Video Preview */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden bg-zinc-950">
          {project ? (
            <div className="w-full max-w-4xl aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl relative group">
              <video 
                ref={videoRef}
                src={project.videoPath}
                className="w-full h-full object-contain"
                onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
              />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                 <div className="flex items-center space-x-4">
                    <button className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform">
                      <Play size={20} fill="currentColor" />
                    </button>
                    <div className="flex-1 h-1 bg-zinc-600 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500" 
                        style={{ width: `${(currentTime / (project?.duration || 1)) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs tabular-nums text-white">{currentTime.toFixed(1)} / {project.duration.toFixed(1)}s</span>
                 </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-zinc-600">
              <FileVideo size={64} className="mb-4 opacity-20" />
              <p>Upload a video to start text-based editing</p>
            </div>
          )}
        </div>

        {/* Text-Based Editor Section */}
        <div className="h-1/2 bg-zinc-900 border-t border-zinc-800 overflow-y-auto">
          {project && (
            <WordEditor 
              segments={project.segments} 
              currentTime={currentTime}
              onToggleDelete={toggleWordDelete}
              onWordClick={handleWordClick}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;