import React, { useRef } from 'react';
import { WordSegment, WordType } from '../types/index';

interface TimelineProps {
  segments: WordSegment[];
  duration: number;
  currentTime: number;
  onTimeClick: (time: number) => void;
}

const Timeline: React.FC<TimelineProps> = ({ segments, duration, currentTime, onTimeClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    if (!containerRef.current || duration === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    onTimeClick(percentage * duration);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="px-8 py-6 bg-zinc-900 border-t border-zinc-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Timeline</span>
        <span className="text-[10px] font-mono text-zinc-400">
          Zoom: 1x
        </span>
      </div>
      
      <div 
        ref={containerRef}
        onClick={handleClick}
        className="h-12 bg-zinc-950 rounded-lg relative overflow-hidden cursor-crosshair border border-zinc-800"
      >
        {/* Playhead Progress Overlay */}
        <div 
          className="absolute inset-y-0 left-0 bg-indigo-500/10 border-r border-indigo-500 z-10 pointer-events-none"
          style={{ width: `${progress}%` }}
        />

        {/* Segments Visualization */}
        <div className="absolute inset-0 flex">
          {segments.map((s) => (
            <div
              key={s.id}
              className={`
                h-full transition-opacity
                ${s.deleted ? 'opacity-10' : 'opacity-100'}
                ${s.type === WordType.FILLER ? 'bg-yellow-500/40' : ''}
                ${s.type === WordType.SILENCE ? 'bg-zinc-700/30' : ''}
                ${s.type === WordType.WORD ? 'bg-indigo-400/20' : ''}
              `}
              style={{
                width: `${((s.end - s.start) / duration) * 100}%`,
                marginLeft: `${(s.start / duration) * 0}%` // Simplified calculation for relative segments
              }}
              title={`${s.text} (${s.start.toFixed(2)}s - ${s.end.toFixed(2)}s)`}
            />
          ))}
        </div>

        {/* Playhead Marker */}
        <div 
          className="absolute inset-y-0 w-[2px] bg-red-500 z-20 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
          style={{ left: `${progress}%` }}
        />
      </div>

      {/* Timeline Labels */}
      <div className="flex justify-between mt-2 px-1">
        <span className="text-[10px] text-zinc-600 font-mono">0.0s</span>
        <span className="text-[10px] text-zinc-600 font-mono">{(duration / 2).toFixed(1)}s</span>
        <span className="text-[10px] text-zinc-600 font-mono">{duration.toFixed(1)}s</span>
      </div>
    </div>
  );
};

export default Timeline;
