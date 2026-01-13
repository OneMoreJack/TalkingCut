import React, { useEffect, useRef, useState } from 'react';
import { useWaveform } from '../hooks/useWaveform';
import { WordSegment, WordType } from '../types/index';

interface TimelineProps {
  segments: WordSegment[];
  duration: number;
  currentTime: number;
  onTimeClick: (time: number) => void;
  zoom?: number;
  audioPath?: string;
  selectionRange: { start: number; end: number } | null;
  onSelectionChange: (range: { start: number; end: number } | null) => void;
}

const Timeline: React.FC<TimelineProps> = ({ 
  segments, 
  duration, 
  currentTime, 
  onTimeClick, 
  zoom = 1.0,
  audioPath,
  selectionRange,
  onSelectionChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { peaks, isLoading } = useWaveform(audioPath || null);
  
  const [isDraggingHandle, setIsDraggingHandle] = useState<'left' | 'right' | null>(null);

  // Resize canvas for waveform
  useEffect(() => {
    if (!canvasRef.current || !peaks || !duration) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth * dpr;
    const height = canvas.clientHeight * dpr;
    
    canvas.width = width;
    canvas.height = height;
    ctx.scale(dpr, dpr); // Scale both axes for consistent DPR handling

    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    
    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.clientHeight / 2);
    ctx.lineTo(canvas.clientWidth, canvas.clientHeight / 2);
    ctx.stroke();

    ctx.fillStyle = '#bef264'; // Vibrant lime green

    const data = peaks.data;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    // Map data points to pixels proportionally to avoid truncation when zoomed
    const ratio = data.length / canvasWidth;
    const amp = canvasHeight * 0.7; // Use 70% of height for peaks

    for (let i = 0; i < canvasWidth; i++) {
        const dataIdx = Math.floor(i * ratio);
        const rawPeak = data[dataIdx] || 0;
        // Normalization boost
        const peak = Math.sqrt(rawPeak); 
        const h = Math.max(1.5, peak * amp);
        
        ctx.fillRect(i, (canvasHeight - h) / 2, 0.9, h);
    }
  }, [peaks, zoom, duration]);

  // Auto-scroll to keep playhead centered
  useEffect(() => {
    if (!containerRef.current || isDraggingHandle || duration === 0) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const totalWidth = rect.width * zoom;
    const playheadX = (currentTime / duration) * totalWidth;
    
    // Center the playhead
    const targetScroll = playheadX - rect.width / 2;
    container.scrollTo({
        left: targetScroll,
        behavior: currentTime === 0 ? 'auto' : 'smooth'
    });
  }, [currentTime, zoom, duration, isDraggingHandle]);

  const handleClick = (e: React.MouseEvent) => {
    if (isDraggingHandle) return;
    if (!containerRef.current || duration === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const percentage = x / (rect.width * zoom);
    onTimeClick(percentage * duration);
  };

  const getTimeFromX = (x: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const totalWidth = rect.width * zoom;
    return ((x + scrollLeft) / totalWidth) * duration;
  };

  const handleMouseDown = (e: React.MouseEvent, type: 'left' | 'right') => {
    e.stopPropagation();
    setIsDraggingHandle(type);
  };

  useEffect(() => {
    if (!isDraggingHandle) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !selectionRange) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newTime = getTimeFromX(x);

      if (isDraggingHandle === 'left') {
        onSelectionChange({ 
            start: Math.min(newTime, selectionRange.end - 0.1), 
            end: selectionRange.end 
        });
      } else {
        onSelectionChange({ 
            start: selectionRange.start, 
            end: Math.max(newTime, selectionRange.start + 0.1) 
        });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingHandle(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingHandle, selectionRange, duration, zoom]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-zinc-900 border-t border-zinc-800 overflow-hidden select-none relative">
      <div 
        ref={containerRef}
        onClick={handleClick}
        className="h-24 bg-zinc-950 relative cursor-crosshair overflow-x-auto scrollbar-hide"
      >
        <div 
          className="relative h-full"
          style={{ width: `${100 * zoom}%`, minWidth: '100%' }}
        >
          {/* Waveform Canvas */}
          <canvas 
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
          />

          {/* Selection Overlay */}
          {selectionRange && (
            <div 
              className="absolute inset-y-0 bg-purple-500/20 border-x border-purple-500/50 z-10"
              style={{ 
                left: `${(selectionRange.start / duration) * 100}%`,
                width: `${((selectionRange.end - selectionRange.start) / duration) * 100}%`
              }}
            >
                {/* Left Handle */}
                <div 
                    onMouseDown={(e) => handleMouseDown(e, 'left')}
                    className="absolute inset-y-0 left-0 w-2 cursor-ew-resize hover:bg-purple-500/40 group flex items-center justify-center"
                >
                    <div className="w-1 h-8 bg-purple-500/60 rounded-full group-hover:bg-purple-400" />
                </div>
                {/* Right Handle */}
                <div 
                    onMouseDown={(e) => handleMouseDown(e, 'right')}
                    className="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-purple-500/40 group flex items-center justify-center"
                >
                    <div className="w-1 h-8 bg-purple-500/60 rounded-full group-hover:bg-purple-400" />
                </div>
            </div>
          )}

          {/* Playhead Progress Overlay */}
          <div 
            className="absolute inset-y-0 left-0 bg-indigo-500/5 border-r border-indigo-500/20 z-0 pointer-events-none"
            style={{ width: `${progress}%` }}
          />

          {/* Segments Visualization */}
          <div className="absolute inset-0 flex pointer-events-none opacity-40">
            {segments.map((s) => (
              <div
                key={s.id}
                className={`
                  h-full border-r border-white/5
                  ${s.deleted ? 'bg-black/40' : ''}
                  ${s.type === WordType.FILLER ? 'bg-yellow-500/10' : ''}
                  ${s.type === WordType.SILENCE ? 'bg-zinc-700/10' : ''}
                `}
                style={{
                  width: `${((s.end - s.start) / duration) * 100}%`
                }}
              />
            ))}
          </div>

          {/* Playhead Marker */}
          <div 
            className="absolute inset-y-0 w-[2px] bg-white z-20 shadow-[0_0_8px_rgba(255,255,255,0.5)]"
            style={{ left: `${progress}%` }}
          >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 -translate-y-1/2" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;

