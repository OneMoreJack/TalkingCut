/**
 * Model Definitions
 * ==================
 * 
 * Metadata for WhisperX models available for download.
 * Uses faster-whisper models from HuggingFace.
 */

export interface ModelInfo {
  id: string;
  name: string;
  size: string;
  ramRequired: string;
  description: string;
  huggingFaceRepo: string;
  files: ModelFile[];
  emoji: string;
  category: 'all' | 'en';
}

export interface ModelFile {
  name: string;
  url: string;
  size: number; // bytes
  sha256?: string;
}

export interface LocalModelStatus {
  id: string;
  installed: boolean;
  source: 'downloaded' | 'symlink' | 'none';
  path?: string;
  sizeOnDisk?: number;
}

export interface DownloadProgress {
  modelId: string;
  fileName: string;
  downloaded: number;
  total: number;
  percent: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
  status: 'downloading' | 'paused' | 'completed' | 'error';
  error?: string;
}

// HuggingFace faster-whisper models
export const MODEL_DEFINITIONS: ModelInfo[] = [
  {
    id: 'tiny',
    name: 'Tiny',
    size: '80MB',
    ramRequired: '1GB',
    description: '最快速度，适合快速预览',
    huggingFaceRepo: 'Systran/faster-whisper-tiny',
    emoji: '🐦',
    category: 'all',
    files: [
      { name: 'model.bin', url: 'https://hf-mirror.com/Systran/faster-whisper-tiny/resolve/main/model.bin', size: 75000000 },
      { name: 'config.json', url: 'https://hf-mirror.com/Systran/faster-whisper-tiny/resolve/main/config.json', size: 2000 },
      { name: 'vocabulary.json', url: 'https://hf-mirror.com/Systran/faster-whisper-tiny/resolve/main/vocabulary.json', size: 1000000 },
      { name: 'tokenizer.json', url: 'https://hf-mirror.com/Systran/faster-whisper-tiny/resolve/main/tokenizer.json', size: 2500000 },
    ]
  },
  {
    id: 'base',
    name: 'Base',
    size: '150MB',
    ramRequired: '1GB',
    description: '平衡速度与精度，推荐日常使用',
    huggingFaceRepo: 'Systran/faster-whisper-base',
    emoji: '🦦',
    category: 'all',
    files: [
      { name: 'model.bin', url: 'https://hf-mirror.com/Systran/faster-whisper-base/resolve/main/model.bin', size: 145000000 },
      { name: 'config.json', url: 'https://hf-mirror.com/Systran/faster-whisper-base/resolve/main/config.json', size: 2000 },
      { name: 'vocabulary.json', url: 'https://hf-mirror.com/Systran/faster-whisper-base/resolve/main/vocabulary.json', size: 1000000 },
      { name: 'tokenizer.json', url: 'https://hf-mirror.com/Systran/faster-whisper-base/resolve/main/tokenizer.json', size: 2500000 },
    ]
  },
  {
    id: 'small',
    name: 'Small',
    size: '480MB',
    ramRequired: '2GB',
    description: '更高精度，适合正式内容',
    huggingFaceRepo: 'Systran/faster-whisper-small',
    emoji: '🦊',
    category: 'all',
    files: [
      { name: 'model.bin', url: 'https://hf-mirror.com/Systran/faster-whisper-small/resolve/main/model.bin', size: 470000000 },
      { name: 'config.json', url: 'https://hf-mirror.com/Systran/faster-whisper-small/resolve/main/config.json', size: 2000 },
      { name: 'vocabulary.json', url: 'https://hf-mirror.com/Systran/faster-whisper-small/resolve/main/vocabulary.json', size: 1000000 },
      { name: 'tokenizer.json', url: 'https://hf-mirror.com/Systran/faster-whisper-small/resolve/main/tokenizer.json', size: 2500000 },
    ]
  },
  {
    id: 'medium',
    name: 'Medium',
    size: '1.5GB',
    ramRequired: '5GB',
    description: '高精度转写，需要较大内存',
    huggingFaceRepo: 'Systran/faster-whisper-medium',
    emoji: '🦉',
    category: 'all',
    files: [
      { name: 'model.bin', url: 'https://hf-mirror.com/Systran/faster-whisper-medium/resolve/main/model.bin', size: 1500000000 },
      { name: 'config.json', url: 'https://hf-mirror.com/Systran/faster-whisper-medium/resolve/main/config.json', size: 2000 },
      { name: 'vocabulary.json', url: 'https://hf-mirror.com/Systran/faster-whisper-medium/resolve/main/vocabulary.json', size: 1000000 },
      { name: 'tokenizer.json', url: 'https://hf-mirror.com/Systran/faster-whisper-medium/resolve/main/tokenizer.json', size: 2500000 },
    ]
  },
  {
    id: 'large-v3-turbo',
    name: 'Large (Turbo)',
    size: '1.6GB',
    ramRequired: '6GB',
    description: '最高精度，针对长内容优化',
    huggingFaceRepo: 'Systran/faster-whisper-large-v3-turbo',
    emoji: '🦅',
    category: 'all',
    files: [
      { name: 'model.bin', url: 'https://hf-mirror.com/Systran/faster-whisper-large-v3-turbo/resolve/main/model.bin', size: 1600000000 },
      { name: 'config.json', url: 'https://hf-mirror.com/Systran/faster-whisper-large-v3-turbo/resolve/main/config.json', size: 2000 },
      { name: 'vocabulary.json', url: 'https://hf-mirror.com/Systran/faster-whisper-large-v3-turbo/resolve/main/vocabulary.json', size: 1000000 },
      { name: 'tokenizer.json', url: 'https://hf-mirror.com/Systran/faster-whisper-large-v3-turbo/resolve/main/tokenizer.json', size: 2500000 },
    ]
  },
  {
    id: 'large-v3',
    name: 'Large',
    size: '3.1GB',
    ramRequired: '12GB',
    description: '超高精度，需要显卡或大内存',
    huggingFaceRepo: 'Systran/faster-whisper-large-v3',
    emoji: '🐘',
    category: 'all',
    files: [
      { name: 'model.bin', url: 'https://hf-mirror.com/Systran/faster-whisper-large-v3/resolve/main/model.bin', size: 3100000000 },
      { name: 'config.json', url: 'https://hf-mirror.com/Systran/faster-whisper-large-v3/resolve/main/config.json', size: 2000 },
      { name: 'vocabulary.json', url: 'https://hf-mirror.com/Systran/faster-whisper-large-v3/resolve/main/vocabulary.json', size: 1000000 },
      { name: 'tokenizer.json', url: 'https://hf-mirror.com/Systran/faster-whisper-large-v3/resolve/main/tokenizer.json', size: 2500000 },
    ]
  }
];

export function getModelById(id: string): ModelInfo | undefined {
  return MODEL_DEFINITIONS.find(m => m.id === id);
}

export function getTotalModelSize(model: ModelInfo): number {
  return model.files.reduce((sum, f) => sum + f.size, 0);
}
