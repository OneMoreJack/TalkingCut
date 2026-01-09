
export enum WordType {
  WORD = 'word',
  FILLER = 'filler', // "uh", "um", "那个", "就是"
  SILENCE = 'silence'
}

export interface WordSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
  type: WordType;
  deleted: boolean;
}

export interface VideoProject {
  id: string;
  name: string;
  videoPath: string;
  duration: number;
  segments: WordSegment[];
  settings: {
    paddingStart: number;
    paddingEnd: number;
    minSilenceDuration: number;
  };
}

export interface ProcessingStatus {
  step: 'idle' | 'transcribing' | 'aligning' | 'cutting' | 'exporting';
  progress: number;
  message: string;
}
