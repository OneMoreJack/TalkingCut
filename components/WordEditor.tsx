
import { RotateCcw, Trash2 } from 'lucide-react';
import React, { useMemo } from 'react';
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
  // ... (Grouping Logic remains same)
  const sentences = useMemo(() => {
    const groups: WordSegment[][] = [];
    let currentGroup: WordSegment[] = [];

    segments.forEach((word, index) => {
      currentGroup.push(word);

      // Boundary detectors
      const hasPunctuation = /[.?!。？！,，]$/.test(word.text);
      const nextWord = segments[index + 1];
      const isLargeGap = nextWord ? (nextWord.start - word.end > 1.2) : false;
      const isSilence = word.type === WordType.SILENCE;

      if (hasPunctuation || isLargeGap || isSilence || index === segments.length - 1) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
          currentGroup = [];
        }
      }
    });

    return groups;
  }, [segments]);

  // Helper to format time (e.g. 65.5 -> 01:05)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto leading-relaxed space-y-6">
      {sentences.map((sentence, sIdx) => {
        const startTime = sentence[0]?.start ?? 0;
        const sentenceIds = sentence.map(w => w.id);
        const allDeleted = sentence.every(w => w.deleted);
        
        return (
          <div key={`s-${sIdx}`} className="flex flex-col group/sentence space-y-2">
            {/* Sentence Header (Timestamp & Delete) */}
            <div className="flex items-center space-x-3">
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

            {/* Sentence Content */}
            <div className="flex flex-wrap gap-x-1 gap-y-1.5">
              {sentence.map((word) => {
                const isActive = currentTime >= word.start && currentTime < word.end;
                const isFiller = word.type === WordType.FILLER;
                const isSilence = word.type === WordType.SILENCE;
                const isMatched = searchTerm && word.text.toLowerCase().includes(searchTerm.toLowerCase());

                return (
                  <span
                    key={word.id}
                    onClick={() => onWordClick(word.start)}
                    className={`
                      relative group/word cursor-pointer text-base px-1 py-0.5 rounded transition-all
                      ${word.deleted ? 'opacity-30 line-through grayscale text-zinc-600' : ''}
                      ${isActive ? 'bg-indigo-600 text-white shadow-md z-10' : ''}
                      ${!isActive && isMatched ? 'bg-yellow-500/20 ring-1 ring-yellow-500/50' : ''}
                      ${!isActive && !word.deleted && !isMatched ? 'hover:bg-zinc-800' : ''}
                      ${isFiller ? 'underline decoration-yellow-500/50 decoration-wavy' : ''}
                      ${isSilence ? 'text-zinc-500 italic text-sm border border-zinc-700/50 bg-zinc-800/20 px-2 my-1' : ''}
                    `}
                  >
                    {word.text}
                    
                    {/* Quick Actions Hover Menu */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover/word:flex bg-zinc-800 shadow-xl rounded-lg border border-zinc-700 overflow-hidden z-20">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onToggleDelete(word.id); }}
                        className="p-2 hover:bg-zinc-700 text-zinc-300"
                      >
                        {word.deleted ? <RotateCcw size={14} /> : <Trash2 size={14} className="text-red-400" />}
                      </button>
                    </div>
                  </span>
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
