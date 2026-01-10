import { RotateCcw, Trash2, Wand2 } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { WordSegment, WordType } from '../types/index';

interface WordEditorProps {
  segments: WordSegment[];
  currentTime: number;
  onToggleDelete: (id: string) => void;
  onToggleWordsDelete: (ids: string[]) => void;
  onWordClick: (time: number) => void;
  searchTerm?: string;
  breakGap?: number; // Dynamic break gap in seconds, default 1.0
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

  // --- Deduplication & Grouping Logic ---
  const sentences = useMemo(() => {
    // 1. Deduplication: Filter out exact consecutive duplicates
    const uniqueSegments: WordSegment[] = [];
    
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
      uniqueSegments.push(word);
    });

    // 2. Group into sentences with silence blocks included
    const groups: WordSegment[][] = [];
    let currentGroup: WordSegment[] = [];

    uniqueSegments.forEach((word, index) => {
      // Include silence as a special block
      currentGroup.push(word);

      // Check boundary conditions
      let shouldBreak = false;

      // For silence segments: break after long silences
      if (word.type === WordType.SILENCE) {
        const duration = word.duration || (word.end - word.start);
        if (duration >= breakGap) {
          shouldBreak = true;
        }
      } else {
        // For word segments
        // 1. Backend signal (isLastInSegment) - trust it
        if (word.isLastInSegment) {
          shouldBreak = true;
        }
        // 2. Gap-based break (using breakGap prop)
        else if (index < uniqueSegments.length - 1) {
          const next = uniqueSegments[index + 1];
          const gap = next.start - word.end;
          
          // Skip over silence segments when checking gaps
          if (next.type !== WordType.SILENCE && gap >= breakGap) {
            shouldBreak = true;
          }
        }

        // 3. Fallback: Sentence-ending punctuation (always breaks)
        if (/[。？！.?!]$/.test(word.text)) {
          shouldBreak = true;
        }
      }

      // Force break if group is too long
      if (currentGroup.length > 50) {
        shouldBreak = true;
      }
      
      // End of list
      if (index === uniqueSegments.length - 1) {
        shouldBreak = true;
      }

      if (shouldBreak && currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
    });

    return groups;
  }, [segments, breakGap]);

  // Helper to check if a string is CJK (Chinese, Japanese, Korean)
  const isCJK = (text: string) => /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(text);

  // Helper to check if a string starts with punctuation
  const isPunctuation = (text: string) => /^[.,!?;:。？！，、]/.test(text);

  // Robust spacing logic
  const shouldAddSpace = (current: WordSegment, next: WordSegment | undefined) => {
    // If backend explicitly told us via hasTrailingSpace
    if (typeof current.hasTrailingSpace === 'boolean') {
      // Trust backend but verify next isn't punctuation
      if (current.hasTrailingSpace && next && !isPunctuation(next.text)) {
        return true;
      }
      return false;
    }

    // Fallback logic
    if (!next) return false;
    // No space for silence
    if (current.type === WordType.SILENCE) return false;
    // No space if current is CJK
    if (isCJK(current.text)) return false;
    // No space if next is punctuation
    if (isPunctuation(next.text)) return false;
    
    // Default: Add space (English, Numbers, etc.)
    return true;
  };

  // Helper to format time (e.g. 65.5 -> 01:05)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

  // Render a silence block
  const renderSilence = (word: WordSegment) => {
    const duration = word.duration || (word.end - word.start);
    return (
      <span
        key={word.id}
        data-word-id={word.id}
        onClick={() => onWordClick(word.start)}
        className={`
          inline-block mx-1 px-2 py-0.5 text-xs text-zinc-500 
          bg-zinc-800/50 border border-dashed border-zinc-700 rounded
          cursor-pointer hover:bg-zinc-700/50 transition-colors
          ${word.deleted ? 'opacity-30 line-through' : ''}
        `}
      >
        {duration.toFixed(1)}s
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

      {sentences.map((sentence, sIdx) => {
        const startTime = sentence[0]?.start ?? 0;
        const sentenceIds = sentence.map(w => w.id);
        const allDeleted = sentence.every(w => w.deleted);
        
        return (
          <div key={`s-${sIdx}`} className="items-start mb-6 group/sentence relative pl-12 transition-all duration-500">
            {/* Sentence Timeline Marker */}
            <div className="absolute left-0 top-1 flex flex-col items-end w-10 opacity-50 group-hover/sentence:opacity-100 transition-opacity select-none">
              <span className="text-[10px] font-mono text-zinc-500 mb-1">
                {formatTime(startTime)}
              </span>
              <button 
                onClick={() => onToggleWordsDelete(sentenceIds)}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-600 hover:text-red-400 opacity-0 group-hover/sentence:opacity-100 transition-all"
                title={allDeleted ? "Restore Sentence" : "Delete Sentence"}
              >
                {allDeleted ? <RotateCcw size={12} /> : <Trash2 size={12} />}
              </button>
            </div>

            {/* Sentence Content - Natural flowing text */}
            <p className={`text-lg leading-relaxed text-zinc-300 tracking-normal ${allDeleted ? 'opacity-40' : ''}`}>
              {sentence.map((word, wIdx) => {
                // Handle silence blocks specially
                if (word.type === WordType.SILENCE) {
                  return renderSilence(word);
                }

                const isActive = currentTime >= word.start && currentTime < word.end;
                const isMatched = searchTerm && word.text.toLowerCase().includes(searchTerm.toLowerCase());
                
                const nextWord = sentence[wIdx + 1];
                const needsSpace = shouldAddSpace(word, nextWord);

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
                    {needsSpace && <span className="whitespace-pre">{"\u00A0"}</span>}
                  </React.Fragment>
                );
              })}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default WordEditor;
