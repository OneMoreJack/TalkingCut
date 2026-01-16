import {
    Check,
    ChevronDown,
    Cpu,
    Database,
    Settings
} from 'lucide-react';
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
  onOpenSettings?: () => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentModelId,
  onSelect,
  models,
  onOpenSettings
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = models.find(m => m.id === currentModelId);

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
    <div className="relative" ref={dropdownRef}>
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all group"
      >
        {currentModel ? (
          <div className="flex items-center space-x-3">
            <div className="text-xl group-hover:scale-110 transition-transform">{currentModel.emoji}</div>
            <div className="text-left">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-white leading-none">{currentModel.name}</span>
                <span className="px-1.5 py-0.5 bg-green-500/10 text-green-500 text-[10px] font-bold rounded-md border border-green-500/20 uppercase tracking-tight">
                  Cached
                </span>
              </div>
              <div className="flex items-center space-x-3 mt-1 text-[10px] text-zinc-500 font-medium whitespace-nowrap">
                <span className="flex items-center"><Database size={10} className="mr-1" /> {currentModel.size}</span>
                <span className="flex items-center"><Cpu size={10} className="mr-1" /> {currentModel.ramRequired || '5GB'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-3 text-zinc-500">
            <div className="text-xl opacity-50 grayscale">🦦</div>
            <div className="text-left">
              <span className="text-sm font-bold block leading-none">未选择模型</span>
              <span className="text-[10px] block mt-1">请先下载模型</span>
            </div>
          </div>
        )}
        <ChevronDown 
          size={16} 
          className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            {models.length > 0 ? (
              <div className="p-1">
                <div className="px-3 py-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">已安装</div>
                {models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onSelect(model.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-zinc-800 transition-colors ${currentModelId === model.id ? 'bg-zinc-800/50' : ''}`}
                  >
                    <div className="flex items-center space-x-3 text-left">
                      <div className="text-xl">{model.emoji}</div>
                      <div>
                        <div className="font-bold text-sm text-white">{model.name}</div>
                        <div className="flex items-center space-x-2 text-[10px] text-zinc-500">
                          <span>{model.size}</span>
                          <span>•</span>
                          <span>{model.ramRequired} RAM</span>
                        </div>
                      </div>
                    </div>
                    {currentModelId === model.id && (
                      <Check size={14} className="text-zinc-400" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center space-y-3">
                <div className="text-4xl filter grayscale opacity-20">📥</div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-zinc-400">暂无下载模型</p>
                  <p className="text-[10px] text-zinc-500 px-4 leading-relaxed">
                    点击下方按钮进入设置界面下载模型以开始转写
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Footer Action */}
          <div className="p-2 bg-black/20 border-t border-zinc-800/50">
            <button
              onClick={() => {
                onOpenSettings?.();
                setIsOpen(false);
              }}
              className="w-full h-9 flex items-center justify-center space-x-2 text-[10px] font-bold uppercase tracking-wider text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-all border border-zinc-700/50"
            >
              <Settings size={12} />
              <span>管理模型 & 下载设置</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
