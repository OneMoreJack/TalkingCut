import { Trash2, Wand2 } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { WordSegment, WordType } from '../types/index';

interface WordEditorProps {
  segments: WordSegment[];
  currentTime: number;
  onToggleDelete: (id: string) => void;
  onToggleWordsDelete: (ids: string[]) => void;
  onWordClick: (time: number) => void;
  searchTerm?: string;
  breakGap?: number;
}

const WordEditor: React.FC<WordEditorProps> = ({ 
  segments, 
  currentTime, 
  onToggleDelete, 
  onToggleWordsDelete, 
  onWordClick, 
  searchTerm,
  breakGap = 1.0 
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Deduplicate segments
  const uniqueSegments = useMemo(() => {
    const result: WordSegment[] = [];
    
    segments.forEach((word, index) => {
      if (index > 0) {
        const prev = segments[index - 1];
        if (
          prev.text === word.text && 
          Math.abs(prev.start - word.start) < 0.01 && 
          Math.abs(prev.end - word.end) < 0.01
        ) {
          return; // Skip duplicate
        }
      }
      result.push(word);
    });

    return result;
  }, [segments]);

  // Selection Handling
  const handleSelectionChange = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setTimeout(() => {
        if (!window.getSelection()?.toString()) {
           setSelectedIds([]);
           setSelectionRect(null);
        }
      }, 100);
      return;
    }

    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    if (!container) return;

    if (!container.contains(range.commonAncestorContainer)) return;

    const ids: string[] = [];
    const wordSpans = container.querySelectorAll('[data-word-id]');
    
    wordSpans.forEach((span) => {
      if (selection.containsNode(span, true)) {
        const id = span.getAttribute('data-word-id');
        if (id) ids.push(id);
      }
    });

    if (ids.length > 0) {
      setSelectedIds(ids);
      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      setSelectionRect({
        top: rect.bottom - containerRect.top + 8,
        left: rect.left - containerRect.left + rect.width / 2
      });
    }
  };

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const handleDeleteSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleWordsDelete(selectedIds);
    window.getSelection()?.removeAllRanges();
    setSelectedIds([]);
    setSelectionRect(null);
  };

  const handleAiCorrection = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("AI Correction triggered for", selectedIds);
    window.getSelection()?.removeAllRanges();
    setSelectedIds([]);
    setSelectionRect(null);
  };

  // Render a silence block inline
  const renderSilence = (word: WordSegment) => {
    const duration = word.duration || (word.end - word.start);
    return (
      <span
        key={word.id}
        data-word-id={word.id}
        onClick={() => onWordClick(word.start)}
        className={`
          inline mx-1 px-1.5 py-0.5 text-xs text-zinc-500 
          bg-zinc-800/50 border border-dashed border-zinc-700 rounded
          cursor-pointer hover:bg-zinc-700/50 transition-colors
          ${word.deleted ? 'opacity-30 line-through' : ''}
        `}
      >
        [...{duration.toFixed(1)}s]
      </span>
    );
  };

  return (
    <div 
      ref={containerRef}
      className="p-8 max-w-5xl mx-auto relative pb-32"
    >
      {/* Floating Action Menu for Selection */}
      {selectionRect && selectedIds.length > 0 && (
        <div 
          className="absolute z-50 animate-in fade-in zoom-in duration-200"
          style={{ top: selectionRect.top, left: selectionRect.left, transform: 'translateX(-50%)' }}
        >
          <div className="flex items-center bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden ring-1 ring-black/50">
            <button
              onClick={handleDeleteSelection}
              className="flex items-center space-x-2 px-3 py-2 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              <Trash2 size={14} />
              <span className="text-xs font-medium">删除</span>
            </button>
            
            <div className="w-[1px] h-4 bg-zinc-700"></div>
            
            <button
              onClick={handleAiCorrection}
              className="flex items-center space-x-2 px-3 py-2 hover:bg-zinc-700 text-zinc-300 transition-colors group"
            >
              <Wand2 size={14} className="text-purple-400 group-hover:text-purple-300" />
              <span className="text-xs font-medium">AI改口误</span>
              <span className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[9px] px-1 rounded ml-1">
                试用
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Continuous flowing text - no sentence grouping */}
      <p className="text-lg leading-relaxed text-zinc-300 tracking-normal">
        {uniqueSegments.map((word) => {
          // Handle silence blocks
          if (word.type === WordType.SILENCE) {
            return renderSilence(word);
          }

          const isActive = currentTime >= word.start && currentTime < word.end;
          const isMatched = searchTerm && word.text.toLowerCase().includes(searchTerm.toLowerCase());
          
          const activeStyle = isActive 
            ? 'bg-indigo-500/30 text-indigo-200 font-medium' 
            : '';
          
          const deletedStyle = word.deleted 
              ? 'line-through decoration-zinc-600 text-zinc-600 decoration-2' 
              : 'hover:text-zinc-100';

          const matchedStyle = !isActive && isMatched 
            ? 'bg-yellow-500/20 text-yellow-200' 
            : '';

          return (
            <React.Fragment key={word.id}>
              <span
                data-word-id={word.id}
                onClick={() => onWordClick(word.start)}
                className={`
                  cursor-text transition-colors duration-150 rounded-sm
                  ${activeStyle}
                  ${deletedStyle}
                  ${matchedStyle}
                  selection:bg-teal-900 selection:text-teal-100
                `}
              >
                {word.text}
              </span>
              {word.hasTrailingSpace && ' '}
            </React.Fragment>
          );
        })}
      </p>
    </div>
  );
};

export default WordEditor;
