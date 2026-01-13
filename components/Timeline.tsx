import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWaveform } from '../hooks/useWaveform';
import { WordSegment } from '../types/index';

interface TimelineProps {
  segments: WordSegment[];
  duration: number;
  currentTime: number;
  onTimeClick: (time: number) => void;
  zoom?: number;
  audioPath?: string;
  selectionRange: { start: number; end: number } | null;
  onSelectionChange: (range: { start: number; end: number } | null) => void;
  onUpdateDeletionRange: (start: number, end: number, deleted: boolean) => void;
}

const Timeline: React.FC<TimelineProps> = ({ 
  segments, 
  duration, 
  currentTime, 
  onTimeClick, 
  zoom = 1.0,
  audioPath,
  selectionRange,
  onSelectionChange,
  onUpdateDeletionRange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { peaks, isLoading } = useWaveform(audioPath || null);
  
  // Dragging state
  const [dragging, setDragging] = useState<{
    type: 'selection-left' | 'selection-right' | 'deleted-left' | 'deleted-right';
    blockId?: string;
    originalRange?: { start: number; end: number };
  } | null>(null);

  // Group consecutive deleted segments into unified blocks
  const deletedBlocks = useMemo(() => {
    const blocks: { id: string; start: number; end: number }[] = [];
    let currentBlock: { id: string, start: number, end: number } | null = null;
    
    segments.forEach((s) => {
      if (s.deleted) {
        if (!currentBlock) {
          currentBlock = { id: s.id, start: s.start, end: s.end };
        } else {
          currentBlock.end = s.end;
        }
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
          currentBlock = null;
        }
      }
    });
    if (currentBlock) blocks.push(currentBlock);
    return blocks;
  }, [segments]);

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
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.clientHeight / 2);
    ctx.lineTo(canvas.clientWidth, canvas.clientHeight / 2);
    ctx.stroke();

    ctx.fillStyle = '#bef264';
    const data = peaks.data;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const ratio = data.length / canvasWidth;
    const amp = canvasHeight * 0.7;

    for (let i = 0; i < canvasWidth; i++) {
        const dataIdx = Math.floor(i * ratio);
        const rawPeak = data[dataIdx] || 0;
        const peak = Math.sqrt(rawPeak); 
        const h = Math.max(1.5, peak * amp);
        ctx.fillRect(i, (canvasHeight - h) / 2, 0.9, h);
    }
  }, [peaks, zoom, duration]);

  // Auto-scroll
  useEffect(() => {
    if (!containerRef.current || dragging || duration === 0) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const totalWidth = rect.width * zoom;
    const playheadX = (currentTime / duration) * totalWidth;
    
    const targetScroll = playheadX - rect.width / 2;
    container.scrollLeft = targetScroll;
  }, [currentTime, zoom, duration, dragging]);

  const handleClick = (e: React.MouseEvent) => {
    if (dragging) return;
    if (!containerRef.current || duration === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const percentage = x / (rect.width * zoom);
    onTimeClick(percentage * duration);
  };

  const getTimeFromX = (x: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const totalWidth = rect.width * zoom;
    return (x / totalWidth) * duration;
  };

  const handleDragStart = (e: React.MouseEvent, type: any, blockId?: string, range?: any) => {
    e.stopPropagation();
    setDragging({ type, blockId, originalRange: range });
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + containerRef.current.scrollLeft;
      const newTime = Math.max(0, Math.min(duration, getTimeFromX(x)));

      if (dragging.type === 'selection-left' && selectionRange) {
        onSelectionChange({ start: Math.min(newTime, selectionRange.end - 0.05), end: selectionRange.end });
      } else if (dragging.type === 'selection-right' && selectionRange) {
        onSelectionChange({ start: selectionRange.start, end: Math.max(newTime, selectionRange.start + 0.05) });
      } else if (dragging.type === 'deleted-left' && dragging.originalRange) {
        // When shrinking/expanding a deletion from the left
        const { start, end } = dragging.originalRange;
        if (newTime < start) {
          // Expanding left: set words between newTime and start as deleted
          onUpdateDeletionRange(newTime, start, true);
        } else if (newTime > start) {
          // Shrinking left: set words between start and newTime as active
          onUpdateDeletionRange(start, newTime, false);
        }
      } else if (dragging.type === 'deleted-right' && dragging.originalRange) {
        // When shrinking/expanding a deletion from the right
        const { start, end } = dragging.originalRange;
        if (newTime > end) {
          // Expanding right: set words between end and newTime as deleted
          onUpdateDeletionRange(end, newTime, true);
        } else if (newTime < end) {
          // Shrinking right: set words between newTime and end as active
          onUpdateDeletionRange(newTime, end, false);
        }
      }
    };

    const handleMouseUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, selectionRange, duration, zoom]);

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

          {/* Interactive Deleted Blocks */}
          {deletedBlocks.map((block) => (
            <div 
              key={block.id}
              className="absolute inset-y-0 bg-zinc-800/80 border-x border-zinc-700/50 z-10 group/del"
              style={{ 
                left: `${(block.start / duration) * 100}%`,
                width: `${((block.end - block.start) / duration) * 100}%`
              }}
            >
              {/* Left Handle */}
              <div 
                onMouseDown={(e) => handleDragStart(e, 'deleted-left', block.id, block)}
                className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize hover:bg-zinc-600/50 flex items-center justify-center -translate-x-1"
              >
                <div className="w-1 h-6 bg-zinc-600 rounded-full opacity-60" />
              </div>
              {/* Right Handle */}
              <div 
                onMouseDown={(e) => handleDragStart(e, 'deleted-right', block.id, block)}
                className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize hover:bg-zinc-600/50 flex items-center justify-center translate-x-1"
              >
                <div className="w-1 h-6 bg-zinc-600 rounded-full opacity-60" />
              </div>
            </div>
          ))}

          {/* Selection Overlay */}
          {selectionRange && (
            <div 
              className="absolute inset-y-0 bg-purple-500/20 border-x border-purple-500/50 z-20 pointer-events-none"
              style={{ 
                left: `${(selectionRange.start / duration) * 100}%`,
                width: `${((selectionRange.end - selectionRange.start) / duration) * 100}%`
              }}
            >
                {/* Selection handles are usually passive but drawn for clarity */}
                {/* We'll make them active if they don't overlap with deleted handles */}
            </div>
          )}
          
          {/* Active selection handles (on top of everything) */}
          {selectionRange && !dragging?.type.startsWith('deleted') && (
            <>
              <div 
                onMouseDown={(e) => handleDragStart(e, 'selection-left')}
                className="absolute inset-y-0 w-2 cursor-ew-resize z-30 hover:bg-purple-500/20"
                style={{ left: `${(selectionRange.start / duration) * 100}%`, transform: 'translateX(-50%)' }}
              />
              <div 
                onMouseDown={(e) => handleDragStart(e, 'selection-right')}
                className="absolute inset-y-0 w-2 cursor-ew-resize z-30 hover:bg-purple-500/20"
                style={{ left: `${(selectionRange.end / duration) * 100}%`, transform: 'translateX(-50%)' }}
              />
            </>
          )}

          {/* Playhead Progress */}
          <div 
            className="absolute inset-y-0 left-0 bg-indigo-500/5 border-r border-indigo-500/20 z-0 pointer-events-none"
            style={{ width: `${progress}%` }}
          />

          {/* Playhead Marker */}
          <div 
            className="absolute inset-y-0 w-[2px] bg-white z-40 shadow-[0_0_8px_rgba(255,255,255,0.5)] pointer-events-none"
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

