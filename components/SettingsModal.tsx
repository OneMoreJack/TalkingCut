import {
    Check,
    Download,
    Globe,
    Info,
    Monitor,
    RotateCcw,
    Trash2,
    X
} from 'lucide-react';
import React, { useState } from 'react';
import { MirrorSource, useModelDownload } from '../hooks/useModelDownload';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const modelDownload = useModelDownload();
  const [activeTab, setActiveTab] = useState<'models' | 'general'>('models');

  const { mirror, setMirrorSource } = modelDownload;

  const handleMirrorChange = (newMirror: MirrorSource) => {
    setMirrorSource(newMirror);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-white">设置</h2>
            <div className="h-4 w-[1px] bg-zinc-700 mx-2" />
            <div className="flex space-x-1">
              <button 
                onClick={() => setActiveTab('models')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${activeTab === 'models' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                模型管理
              </button>
              <button 
                onClick={() => setActiveTab('general')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                通用设置
              </button>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {activeTab === 'models' ? (
            <>
              {/* Model List & Mirror Selection Header */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wide">可用模型</h3>
                  
                  <div className="flex items-center space-x-3">
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center">
                      <Globe size={10} className="mr-1" /> 下载源
                    </span>
                    <div className="bg-zinc-800/80 p-1 rounded-lg flex shadow-inner">
                      <button
                        onClick={() => handleMirrorChange('huggingface')}
                        className={`px-3 py-1 text-[10px] rounded-md font-bold transition-all ${mirror === 'huggingface' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-400'}`}
                      >
                        官方 (Global)
                      </button>
                      <button
                        onClick={() => handleMirrorChange('hf-mirror')}
                        className={`px-3 py-1 text-[10px] rounded-md font-bold transition-all ${mirror === 'hf-mirror' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-400'}`}
                      >
                        hf-mirror (镜像)
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4">
                  {modelDownload.models.map((model) => {
                    const isInstalled = model.status.installed;
                    const isDownloading = modelDownload.downloadProgress?.modelId === model.id;
                    const progress = isDownloading ? modelDownload.downloadProgress?.percent : 0;

                    return (
                      <div 
                        key={model.id}
                        className={`p-4 rounded-xl border transition-all ${isInstalled ? 'bg-zinc-800/20 border-zinc-700/50' : 'bg-zinc-800/5 border-zinc-800 hover:border-zinc-700/50'}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="text-2xl">{model.emoji}</div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-white tracking-tight">{model.name}</span>
                                <div className="flex items-center space-x-2">
                                  <div className="flex items-center space-x-1 text-[10px] font-medium text-zinc-500 bg-black/30 px-2 py-0.5 rounded">
                                    <Info size={10} className="opacity-50" />
                                    <span>{model.size}</span>
                                  </div>
                                  <div className="flex items-center space-x-1 text-[10px] font-medium text-zinc-500 bg-black/30 px-2 py-0.5 rounded">
                                    <Monitor size={10} className="opacity-50" />
                                    <span>{model.ramRequired}</span>
                                  </div>
                                </div>
                                {isInstalled && (
                                  <span className="flex items-center px-1.5 py-0.5 bg-green-500/10 text-green-500 text-[10px] font-bold rounded-md border border-green-500/20 uppercase tracking-tight">
                                    <Check size={10} className="mr-0.5" /> 已就绪
                                  </span>
                                )}
                                {isInstalled && model.status.source === 'symlink' && (
                                  <span className="flex items-center px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded-md border border-blue-500/20 uppercase tracking-tight">
                                    <Check size={10} className="mr-0.5" /> 已关联本地缓存
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-zinc-500 mt-1.5">{model.description}</p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            {isInstalled ? (
                              <button 
                                onClick={() => modelDownload.deleteModel(model.id)}
                                className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-colors"
                                title="删除模型"
                              >
                                <Trash2 size={16} />
                              </button>
                            ) : isDownloading ? (
                              <button 
                                onClick={() => modelDownload.cancelDownload()}
                                className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 animate-pulse-slow"
                              >
                                <X size={14} />
                                <span>取消</span>
                              </button>
                            ) : (
                              <button 
                                onClick={() => modelDownload.downloadModel(model.id)}
                                disabled={modelDownload.isDownloading}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${modelDownload.isDownloading ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-white text-black hover:bg-zinc-200'}`}
                              >
                                <Download size={14} />
                                <span>下载</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Download Progress Bar */}
                        {isDownloading && (
                          <div className="mt-4 space-y-2">
                            <div className="flex justify-between text-[10px] text-zinc-400 font-medium">
                              <span>正在下载: {modelDownload.downloadProgress?.fileName}</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-white transition-all duration-300" 
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-zinc-500 italic">
                              <span>速度: {Math.round(modelDownload.downloadProgress!.speed / 1024 / 1024 * 10) / 10} MB/s</span>
                              <span>剩余时间: {Math.round(modelDownload.downloadProgress!.eta)}s</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <RotateCcw size={40} className="text-zinc-700 animate-spin-slow" />
              <div>
                <h3 className="text-white font-bold">通用设置即将到来</h3>
                <p className="text-zinc-500 text-sm mt-1">目前专注于 AI 模型管理与网络优化。</p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 flex justify-end items-center">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-bold transition-all"
          >
            关闭
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
