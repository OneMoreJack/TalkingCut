
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
  // Segmentation and display fields
  segmentId?: string;
  isLastInSegment?: boolean;
  hasTrailingSpace?: boolean;
  duration?: number; // For silence segments
  language?: string;
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
    crossfadeDuration: number;
    breakGap: number; // Gap threshold for line breaks in transcript (default: 1.0s)
  };
}

export interface ProcessingStatus {
  step: 'idle' | 'extracting' | 'transcribing' | 'aligning' | 'cutting' | 'exporting';
  progress: number;
  message: string;
}
