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

export type MirrorSource = 'huggingface' | 'hf-mirror';

export const MIRROR_CONFIG = {
  huggingface: 'https://huggingface.co',
  'hf-mirror': 'https://hf-mirror.com'
};

export const getDownloadUrl = (repo: string, file: string, source: MirrorSource = 'huggingface') => {
  const base = MIRROR_CONFIG[source];
  return `${base}/${repo}/resolve/main/${file}`;
};

// HuggingFace faster-whisper models
// Note: All 4 files are required for whisperx/faster-whisper to work correctly
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
      { name: 'model.bin', size: 75538270, url: '' },
      { name: 'config.json', size: 2300, url: '' },
      { name: 'vocabulary.txt', size: 460000, url: '' },
      { name: 'tokenizer.json', size: 2210000, url: '' },
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
      { name: 'model.bin', size: 145000000, url: '' },
      { name: 'config.json', size: 500, url: '' },
      { name: 'vocabulary.txt', size: 800000, url: '' },
      { name: 'tokenizer.json', size: 2400000, url: '' },
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
      { name: 'model.bin', size: 470000000, url: '' },
      { name: 'config.json', size: 500, url: '' },
      { name: 'vocabulary.txt', size: 800000, url: '' },
      { name: 'tokenizer.json', size: 2400000, url: '' },
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
      { name: 'model.bin', size: 1500000000, url: '' },
      { name: 'config.json', size: 500, url: '' },
      { name: 'vocabulary.txt', size: 800000, url: '' },
      { name: 'tokenizer.json', size: 2400000, url: '' },
    ]
  },
  {
    id: 'large-v3-turbo',
    name: 'Large (Turbo)',
    size: '1.6GB',
    ramRequired: '6GB',
    description: '最高精度，针对长内容优化',
    huggingFaceRepo: 'deepdml/faster-whisper-large-v3-turbo-ct2',
    emoji: '🦅',
    category: 'all',
    files: [
      { name: 'model.bin', size: 1600000000, url: '' },
      { name: 'config.json', size: 500, url: '' },
      { name: 'vocabulary.json', size: 800000, url: '' },
      { name: 'tokenizer.json', size: 2400000, url: '' },
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
      { name: 'model.bin', size: 3100000000, url: '' },
      { name: 'config.json', size: 500, url: '' },
      { name: 'vocabulary.json', size: 800000, url: '' },
      { name: 'tokenizer.json', size: 2400000, url: '' },
    ]
  }
];

export function getModelInfoWithUrls(modelId: string, source: MirrorSource = 'huggingface'): ModelInfo | undefined {
  const model = MODEL_DEFINITIONS.find(m => m.id === modelId);
  if (!model) return undefined;

  return {
    ...model,
    files: model.files.map(f => ({
      ...f,
      url: getDownloadUrl(model.huggingFaceRepo, f.name, source)
    }))
  };
}

export function getModelById(id: string): ModelInfo | undefined {
  return MODEL_DEFINITIONS.find(m => m.id === id);
}

export function getTotalModelSize(model: ModelInfo): number {
  return model.files.reduce((sum, f) => sum + f.size, 0);
}
