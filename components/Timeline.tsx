import React, { useEffect, useRef, useState } from 'react';
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
  cutRanges: { id: string; start: number; end: number }[];
  onUpdateCutRanges: (ranges: { id: string; start: number; end: number }[]) => void;
  onStatusChange?: (status: { isDragging: boolean }) => void;
  isPlaying?: boolean;
  seekTime?: number; // When this changes, scroll to center this time
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
  cutRanges,
  onUpdateCutRanges,
  onStatusChange,
  isPlaying = false,
  seekTime
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { peaks, isLoading } = useWaveform(audioPath || null);
  
  // Dragging state
  const [dragging, setDragging] = useState<{
    type: 'selection-left' | 'selection-right' | 'deleted-left' | 'deleted-right' | 'deleted-move' | 'deleted-create';
    blockId?: string;
    startPoint?: { x: number; time: number }; // Initial click position
    originalRange?: { start: number; end: number }; // Initial range for move/create
  } | null>(null);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{ 
    x: number; 
    y: number; 
    blockId: string;
  } | null>(null);

  // Ref to track if we were just dragging to prevent handleClick from firing
  const wasDraggingRef = useRef(false);

  // Resize canvas for waveform (same)
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
    const amp = canvasHeight * 0.6; // Slightly reduced max amplitude

    for (let i = 0; i < canvasWidth; i++) {
        const dataIdx = Math.floor(i * ratio);
        const rawPeak = data[dataIdx] || 0;
        // Linear curve is cleaner for silence than Math.sqrt
        const peak = rawPeak; 
        const h = Math.max(0.5, peak * amp); // Lowered minimum height for silence
        ctx.fillRect(i, (canvasHeight - h) / 2, 0.9, h);
    }
  }, [peaks, zoom, duration]);

  // Auto-scroll (Center the playhead during playback)
  useEffect(() => {
    if (!containerRef.current || dragging || duration === 0 || !isPlaying) return;
    const container = containerRef.current;
    
    // Use scrollWidth and clientWidth for precise centering
    const totalWidth = container.scrollWidth;
    const viewportWidth = container.clientWidth;
    const playheadX = (currentTime / duration) * totalWidth;
    
    // Target position: playheadX minus half the viewport
    const targetScroll = playheadX - viewportWidth / 2;
    
    // Browser will handle boundaries (0 and maxScroll) automatically,
    // but we can be explicit to avoid jitter
    const maxScroll = totalWidth - viewportWidth;
    if (maxScroll > 0) {
      container.scrollLeft = Math.max(0, Math.min(maxScroll, targetScroll));
    } else {
      container.scrollLeft = 0;
    }
  }, [currentTime, zoom, duration, dragging, isPlaying]);

  // Scroll to seekTime when it changes (from word clicks or selection)
  useEffect(() => {
    if (seekTime === undefined || !containerRef.current || duration === 0) return;
    const container = containerRef.current;
    
    const totalWidth = container.scrollWidth;
    const viewportWidth = container.clientWidth;
    const targetX = (seekTime / duration) * totalWidth;
    
    // Center the target time in the viewport
    const targetScroll = targetX - viewportWidth / 2;
    const maxScroll = totalWidth - viewportWidth;
    
    container.scrollTo({
      left: Math.max(0, Math.min(maxScroll, targetScroll)),
      behavior: 'smooth'
    });
  }, [seekTime, duration]);

  const handleClick = (e: React.MouseEvent) => {
    // If we just finished a drag, don't trigger a click/seek
    if (wasDraggingRef.current) {
        wasDraggingRef.current = false;
        return;
    }
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

  const handleDragStart = (e: React.MouseEvent, type: any, blockId?: string, extra?: any) => {
    e.stopPropagation();
    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current!.scrollLeft;
    const time = getTimeFromX(x);

    setDragging({ 
      type, 
      blockId, 
      startPoint: { x, time },
      originalRange: extra?.range 
    });
    wasDraggingRef.current = false; // Reset to false, will become true on move
    onStatusChange?.({ isDragging: true });
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + containerRef.current.scrollLeft;
      const newTime = Math.max(0, Math.min(duration, getTimeFromX(x)));
      
      // If we move more than 3 pixels, it's a drag
      if (dragging.startPoint && Math.abs(x - dragging.startPoint.x) > 3) {
        wasDraggingRef.current = true;
      }

      if (dragging.type === 'selection-left' && selectionRange) {
        onSelectionChange({ start: Math.min(newTime, selectionRange.end - 0.05), end: selectionRange.end });
      } else if (dragging.type === 'selection-right' && selectionRange) {
        onSelectionChange({ start: selectionRange.start, end: Math.max(newTime, selectionRange.start + 0.05) });
      } else if (dragging.type === 'deleted-move' && dragging.blockId && dragging.originalRange && dragging.startPoint) {
        const delta = newTime - dragging.startPoint.time;
        const newStart = Math.max(0, dragging.originalRange.start + delta);
        const newEnd = Math.min(duration, dragging.originalRange.end + delta);
        
        // Keep duration constant
        const actualDelta = newStart - dragging.originalRange.start;
        const finalEnd = dragging.originalRange.end + actualDelta;

        const newCutRanges = cutRanges.map(r => 
          r.id === dragging.blockId ? { ...r, start: newStart, end: finalEnd } : r
        );
        onUpdateCutRanges(newCutRanges);
      } else if (dragging.type === 'deleted-create' && dragging.startPoint) {
        const startTime = Math.min(dragging.startPoint.time, newTime);
        const endTime = Math.max(dragging.startPoint.time, newTime);
        
        // Show temporary selection or create/update a temporary range
        // For simplicity, we update the selectionRange during creation
        onSelectionChange({ start: startTime, end: endTime });
      } else if (dragging.type.startsWith('deleted') && dragging.blockId) {
        const rangeIndex = cutRanges.findIndex(r => r.id === dragging.blockId);
        if (rangeIndex === -1) return;

        const newCutRanges = [...cutRanges];
        const range = { ...newCutRanges[rangeIndex] };

        if (dragging.type === 'deleted-left') {
          range.start = Math.min(newTime, range.end - 0.01);
        } else {
          range.end = Math.max(newTime, range.start + 0.01);
        }

        newCutRanges[rangeIndex] = range;
        onUpdateCutRanges(newCutRanges);
      }
    };

    const handleMouseUp = () => {
      if (dragging.type === 'deleted-create' && selectionRange && wasDraggingRef.current) {
        const duration = selectionRange.end - selectionRange.start;
        if (duration > 0.1) {
          const newRange = {
            id: `manual-${Date.now()}`,
            start: selectionRange.start,
            end: selectionRange.end
          };
          onUpdateCutRanges([...cutRanges, newRange]);
          onSelectionChange(null);
        }
      }
      setDragging(null);
      onStatusChange?.({ isDragging: false });
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, selectionRange, duration, zoom, cutRanges, onUpdateCutRanges]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      className="bg-zinc-900 border-t border-zinc-800 overflow-hidden select-none relative"
      onClick={() => setContextMenu(null)}
    >
      <div 
        ref={containerRef}
        onClick={handleClick}
        onMouseDown={(e) => {
          // Only start a creation drag if clicking on background (not on a block or handle)
          if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'CANVAS') {
            handleDragStart(e, 'deleted-create');
          }
        }}
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

          {/* Precision Deleted Blocks (Source of Truth) */}
          {cutRanges.map((block) => {
            const isDraggingLeft = dragging?.type === 'deleted-left' && dragging.blockId === block.id;
            const isDraggingRight = dragging?.type === 'deleted-right' && dragging.blockId === block.id;

            return (
              <div 
                key={block.id}
                className="absolute inset-y-0 bg-zinc-200/[0.3] z-10 group/del cursor-move"
                style={{ 
                  left: `${(block.start / duration) * 100}%`,
                  width: `${((block.end - block.start) / duration) * 100}%`
                }}
                onMouseDown={(e) => {
                  // Only move if clicking the block itself, not the handles
                  if ((e.target as HTMLElement).classList.contains('group/del')) {
                    handleDragStart(e, 'deleted-move', block.id, { range: { start: block.start, end: block.end } });
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const containerRect = containerRef.current!.getBoundingClientRect();
                  setContextMenu({
                    x: e.clientX - containerRect.left,
                    y: e.clientY - containerRect.top,
                    blockId: block.id
                  });
                }}
              >
                {/* Left Handle */}
                <div 
                  onMouseDown={(e) => handleDragStart(e, 'deleted-left', block.id)}
                  className="absolute inset-y-0 left-0 w-3 cursor-ew-resize flex items-center justify-center -translate-x-1.5 group/left"
                >
                  {isDraggingLeft ? (
                    /* Thin line when dragging - Centered in the w-3 hit area */
                    <div className="w-px h-full bg-white/90" />
                  ) : (
                    /* Pill shape when idle - Centered automatically by justify-center */
                    <div className="w-1.5 h-6 bg-zinc-600/80 rounded-full group-hover/left:bg-zinc-100 group-hover/left:scale-y-110 transition-all shadow-sm" />
                  )}
                </div>
                
                {/* Right Handle */}
                <div 
                  onMouseDown={(e) => handleDragStart(e, 'deleted-right', block.id)}
                  className="absolute inset-y-0 right-0 w-3 cursor-ew-resize flex items-center justify-center translate-x-1.5 group/right"
                >
                  {isDraggingRight ? (
                    /* Thin line when dragging - Centered in the w-3 hit area */
                    <div className="w-px h-full bg-white/90" />
                  ) : (
                    /* Pill shape when idle - Centered automatically by justify-center */
                    <div className="w-1.5 h-6 bg-zinc-600/80 rounded-full group-hover/right:bg-zinc-100 group-hover/right:scale-y-110 transition-all shadow-sm" />
                  )}
                </div>
              </div>
            );
          })}

          {/* Selection Overlay */}
          {selectionRange && (
            <div 
              className="absolute inset-y-0 bg-purple-500/20 border-x border-purple-500/50 z-20 pointer-events-none"
              style={{ 
                left: `${(selectionRange.start / duration) * 100}%`,
                width: `${((selectionRange.end - selectionRange.start) / duration) * 100}%`
              }}
            />
          )}
          
          {/* Active selection handles */}
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
            className="absolute inset-y-0 left-0 bg-zinc-500/5 border-r border-zinc-500/20 z-0 pointer-events-none"
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
      {/* Right-click Context Menu */}
      {contextMenu && (
        <div 
          className="absolute z-[100] bg-zinc-800 border border-zinc-700 rounded shadow-xl overflow-hidden py-1 min-w-[100px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onUpdateCutRanges(cutRanges.filter(r => r.id !== contextMenu.blockId));
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-zinc-700 transition-colors flex items-center space-x-2"
          >
            <span>删除片段</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Timeline;
