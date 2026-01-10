
import { RotateCcw, Trash2 } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { WordSegment, WordType } from '../types/index';

interface WordEditorProps {
  segments: WordSegment[];
  currentTime: number;
  onToggleDelete: (id: string) => void;
  onToggleWordsDelete: (ids: string[]) => void;
  onWordClick: (time: number) => void;
  searchTerm?: string;
}

const WordEditor: React.FC<WordEditorProps> = ({ segments, currentTime, onToggleDelete, onToggleWordsDelete, onWordClick, searchTerm }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Grouping Logic ---
  const sentences = useMemo(() => {
    const groups: WordSegment[][] = [];
    let currentGroup: WordSegment[] = [];

    segments.forEach((word, index) => {
      currentGroup.push(word);

      // Boundary detectors: Only punctuation now
      const hasPunctuation = /[.?!。？！,，]$/.test(word.text);
      
      if (hasPunctuation || index === segments.length - 1) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
          currentGroup = [];
        }
      }
    });

    return groups;
  }, [segments]);

  // Helper to check if a string contains English letters
  const isEnglish = (text: string) => /[a-zA-Z]/.test(text);

  // Helper to format time (e.g. 65.5 -> 01:05)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Selection Handling
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectedIds([]);
      setSelectionRect(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    if (!container) return;

    // Find all word IDs within the range
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
        top: rect.top - containerRect.top - 40,
        left: rect.left - containerRect.left + rect.width / 2
      });
    } else {
      setSelectedIds([]);
      setSelectionRect(null);
    }
  };

  const handleDeleteSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleWordsDelete(selectedIds);
    setSelectedIds([]);
    setSelectionRect(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div 
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="p-8 max-w-5xl mx-auto leading-relaxed space-y-6 relative"
    >
      {/* Floating Action Button for Selection */}
      {selectionRect && selectedIds.length > 0 && (
        <div 
          className="absolute z-50 animate-in fade-in zoom-in duration-200"
          style={{ top: selectionRect.top, left: selectionRect.left, transform: 'translateX(-50%)' }}
        >
          <button
            onClick={handleDeleteSelection}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-full shadow-lg text-xs font-medium"
          >
            <Trash2 size={12} />
            <span>Delete Selection</span>
          </button>
        </div>
      )}

      {sentences.map((sentence, sIdx) => {
        const startTime = sentence[0]?.start ?? 0;
        const sentenceIds = sentence.map(w => w.id);
        const allDeleted = sentence.every(w => w.deleted);
        
        return (
          <div key={`s-${sIdx}`} className="flex flex-col group/sentence space-y-2">
            {/* Sentence Header (Timestamp & Delete) */}
            <div className="flex items-center space-x-3 select-none">
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded">
                {formatTime(startTime)}
              </span>
              <button 
                onClick={() => onToggleWordsDelete(sentenceIds)}
                className="opacity-0 group-hover/sentence:opacity-100 transition-opacity p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-red-400"
                title={allDeleted ? "Restore Sentence" : "Delete Sentence"}
              >
                {allDeleted ? <RotateCcw size={12} /> : <Trash2 size={12} />}
              </button>
            </div>

            {/* Sentence Content - Inline Layout */}
            <div className="text-base text-zinc-300">
              {sentence.map((word, wIdx) => {
                const isActive = currentTime >= word.start && currentTime < word.end;
                const isFiller = word.type === WordType.FILLER;
                const isSilence = word.type === WordType.SILENCE;
                const isMatched = searchTerm && word.text.toLowerCase().includes(searchTerm.toLowerCase());
                
                const nextWord = sentence[wIdx + 1];
                const needsSpace = isEnglish(word.text) && nextWord && !/^[.,!?;:。？！，、]/.test(nextWord.text);

                return (
                  <React.Fragment key={word.id}>
                    <span
                      data-word-id={word.id}
                      onClick={() => onWordClick(word.start)}
                      className={`
                        inline-block cursor-pointer px-0.5 rounded transition-all
                        ${word.deleted ? 'opacity-30 line-through grayscale text-zinc-600' : ''}
                        ${isActive ? 'bg-indigo-600 text-white shadow-md z-10' : ''}
                        ${!isActive && isMatched ? 'bg-yellow-500/20 ring-1 ring-yellow-500/50' : ''}
                        ${!isActive && !word.deleted && !isMatched ? 'hover:bg-zinc-800' : ''}
                        ${isFiller ? 'underline decoration-yellow-500/50 decoration-wavy' : ''}
                        ${isSilence ? 'text-zinc-500 italic text-[13px] border border-zinc-700/50 bg-zinc-800/20 px-1.5 mx-0.5' : ''}
                      `}
                    >
                      {word.text}
                    </span>
                    {needsSpace && <span className="inline select-none"> </span>}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WordEditor;
