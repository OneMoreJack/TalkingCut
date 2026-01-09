
import { RotateCcw, Trash2 } from 'lucide-react';
import React from 'react';
import { WordSegment, WordType } from '../types/index';

interface WordEditorProps {
  segments: WordSegment[];
  currentTime: number;
  onToggleDelete: (id: string) => void;
  onWordClick: (time: number) => void;
  searchTerm?: string;
}

const WordEditor: React.FC<WordEditorProps> = ({ segments, currentTime, onToggleDelete, onWordClick, searchTerm }) => {
  return (
    <div className="p-8 max-w-5xl mx-auto leading-relaxed">
      <div className="flex flex-wrap gap-x-2 gap-y-4">
        {segments.map((word) => {
          const isActive = currentTime >= word.start && currentTime < word.end;
          const isFiller = word.type === WordType.FILLER;
          const isSilence = word.type === WordType.SILENCE;
          const isMatched = searchTerm && word.text.toLowerCase().includes(searchTerm.toLowerCase());

          return (
            <span
              key={word.id}
              onClick={() => onWordClick(word.start)}
              className={`
                relative group cursor-pointer text-xl px-1.5 py-1 rounded transition-all
                ${word.deleted ? 'opacity-30 line-through grayscale text-zinc-600' : ''}
                ${isActive ? 'bg-indigo-600 text-white scale-110 shadow-lg z-10' : ''}
                ${!isActive && isMatched ? 'bg-yellow-500/20 ring-1 ring-yellow-500/50' : ''}
                ${!isActive && !word.deleted && !isMatched ? 'hover:bg-zinc-800' : ''}
                ${isFiller ? 'underline decoration-yellow-500/50 decoration-wavy' : ''}
                ${isSilence ? 'text-zinc-500 italic text-sm border border-zinc-700/50 bg-zinc-800/20' : ''}
              `}
            >
              {word.text}
              
              {/* Quick Actions Hover Menu */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-zinc-800 shadow-xl rounded-lg border border-zinc-700 overflow-hidden z-20">
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggleDelete(word.id); }}
                  className="p-2 hover:bg-zinc-700 text-zinc-300"
                >
                  {word.deleted ? <RotateCcw size={14} /> : <Trash2 size={14} className="text-red-400" />}
                </button>
              </div>

              {/* Timestamp Badge */}
              {isActive && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] bg-indigo-500 px-1 rounded text-white font-mono whitespace-nowrap">
                  {word.start.toFixed(2)}s
                </div>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default WordEditor;
