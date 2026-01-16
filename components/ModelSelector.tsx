import { Check, ChevronDown, Cpu, Download, HardDrive, Trash2, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { DownloadProgress, ModelWithStatus } from '../hooks/useModelDownload';

interface ModelSelectorProps {
  currentModelId: string;
  onSelect: (id: string) => void;
  models: ModelWithStatus[];
  downloadProgress: DownloadProgress | null;
  onDownload: (id: string) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  isDownloading: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentModelId,
  onSelect,
  models,
  downloadProgress,
  onDownload,
  onCancel,
  onDelete,
  isDownloading
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedModel = models.find(m => m.id === currentModelId);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Main Card */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 cursor-pointer hover:border-zinc-700 transition-all shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-4xl">{selectedModel?.emoji || '🦦'}</div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-zinc-100">{selectedModel?.name || 'Base'}</span>
                {selectedModel?.status.installed ? (
                  <span className="flex items-center space-x-1 px-2 py-0.5 bg-green-500/10 text-green-400 text-[10px] rounded-full font-semibold border border-green-500/20">
                    <Check size={10} />
                    <span>Cached</span>
                  </span>
                ) : (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isDownloading) onDownload(currentModelId);
                    }}
                    disabled={isDownloading}
                    className="flex items-center space-x-1 px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[10px] rounded-full border border-zinc-700 transition-colors cursor-pointer"
                  >
                    <Download size={10} className={isDownloading ? 'animate-bounce' : ''} />
                    <span>{isDownloading ? 'Downloading...' : 'Not Cached'}</span>
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 px-1.5 py-0.5 bg-zinc-800/50 rounded text-[10px] text-zinc-400">
                  <HardDrive size={10} />
                  <span>{selectedModel?.size || '150MB'}</span>
                </div>
                <div className="flex items-center space-x-1 px-1.5 py-0.5 bg-zinc-800/50 rounded text-[10px] text-zinc-400">
                  <Cpu size={10} />
                  <span>{selectedModel?.ramRequired || '1GB RAM'}</span>
                </div>
              </div>
            </div>
          </div>
          <div className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown size={20} />
          </div>
        </div>

        {/* Local Download Progress Bar (Mini) */}
        {isDownloading && downloadProgress?.modelId === currentModelId && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between items-center text-[10px] text-zinc-500">
              <span>Downloading...</span>
              <div className="flex items-center space-x-2">
                <span>{downloadProgress.percent}%</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                  }}
                  className="p-0.5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded transition-colors"
                  title="Cancel download"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
              <div 
                className="bg-indigo-500 h-full transition-all duration-300" 
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden border border-zinc-200 animate-in fade-in slide-in-from-top-2 duration-200">

          {/* Model List */}
          <div className="max-h-[400px] overflow-y-auto">
            {models.map((model) => (
              <div
                key={model.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(model.id);
                  setIsOpen(false);
                }}
                className={`group flex items-center justify-between p-3 cursor-pointer transition-colors ${
                  currentModelId === model.id 
                  ? 'bg-indigo-50/50' 
                  : 'hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="text-3xl group-hover:scale-110 transition-transform duration-200">
                    {model.emoji}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-zinc-900 flex items-center space-x-1">
                      <span>{model.name}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-[10px] text-zinc-500">
                      <span className="flex items-center space-x-0.5">
                        <HardDrive size={8} />
                        <span>{model.size}</span>
                      </span>
                      <span className="flex items-center space-x-0.5">
                        <Cpu size={8} />
                        <span>{model.ramRequired}</span>
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {model.status.installed ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete cached model "${model.name}"?`)) {
                            onDelete(model.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-zinc-400 hover:text-red-500 rounded-lg transition-all"
                        title="Delete cached model"
                      >
                        <Trash2 size={14} />
                      </button>
                      <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] rounded-full font-bold">
                        Cached
                      </span>
                    </>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(model.id);
                        onDownload(model.id);
                        setIsOpen(false);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-indigo-50 text-zinc-400 hover:text-indigo-600 rounded-lg transition-all"
                      title="Download model"
                    >
                      <Download size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
