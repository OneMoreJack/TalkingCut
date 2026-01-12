import React, { useRef } from 'react';
import { WordSegment, WordType } from '../types/index';

interface TimelineProps {
  segments: WordSegment[];
  duration: number;
  currentTime: number;
  onTimeClick: (time: number) => void;
  zoom?: number;
}

const Timeline: React.FC<TimelineProps> = ({ segments, duration, currentTime, onTimeClick, zoom = 1.0 }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    if (!containerRef.current || duration === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const percentage = x / (rect.width * zoom);
    onTimeClick(percentage * duration);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-zinc-900 border-t border-zinc-800 overflow-hidden select-none">
      <div 
        ref={containerRef}
        onClick={handleClick}
        className="h-20 bg-zinc-950 relative cursor-crosshair overflow-x-auto scrollbar-hide"
      >
        <div 
          className="relative h-full"
          style={{ width: `${100 * zoom}%`, minWidth: '100%' }}
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
                  h-full border-r border-zinc-800/20 transition-opacity
                  ${s.deleted ? 'opacity-10' : 'opacity-100'}
                  ${s.type === WordType.FILLER ? 'bg-yellow-500/30' : ''}
                  ${s.type === WordType.SILENCE ? 'bg-zinc-700/30' : ''}
                  ${s.type === WordType.WORD ? 'bg-indigo-400/20' : ''}
                `}
                style={{
                  width: `${((s.end - s.start) / duration) * 100}%`
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
      </div>
    </div>
  );
};

export default Timeline;
