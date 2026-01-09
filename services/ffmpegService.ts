
import { WordSegment, VideoProject } from '../types';

/**
 * Calculates continuous kept segments from individual words.
 * Implements "Breathing Room" (Padding) logic.
 */
export const generateCutList = (project: VideoProject) => {
  const { segments, settings, duration } = project;
  const { paddingStart, paddingEnd } = settings;

  const cutPoints: { start: number; end: number }[] = [];
  let currentSegment: { start: number; end: number } | null = null;

  segments.forEach((word, index) => {
    if (!word.deleted) {
      if (!currentSegment) {
        // Start a new sequence
        currentSegment = { start: word.start, end: word.end };
      } else {
        // Extend current sequence
        currentSegment.end = word.end;
      }
    } else {
      // Current sequence ends because we hit a deleted word
      if (currentSegment) {
        cutPoints.push(applyPadding(currentSegment, paddingStart, paddingEnd, duration));
        currentSegment = null;
      }
    }
    
    // Last segment case
    if (index === segments.length - 1 && currentSegment) {
      cutPoints.push(applyPadding(currentSegment, paddingStart, paddingEnd, duration));
    }
  });

  return cutPoints;
};

const applyPadding = (
  seg: { start: number; end: number }, 
  pStart: number, 
  pEnd: number, 
  maxDuration: number
) => {
  return {
    start: Math.max(0, seg.start - pStart),
    end: Math.min(maxDuration, seg.end + pEnd)
  };
};

/**
 * Generates an FFmpeg command to concat the segments.
 * For lossless fast cutting, we use a complex filter or a concat demuxer file.
 */
export const generateFFmpegCommand = (project: VideoProject, outputPath: string) => {
  const cuts = generateCutList(project);
  
  // Method 1: Filter Complex (Better for accuracy but requires re-encoding)
  let filter = '';
  cuts.forEach((cut, i) => {
    filter += `[0:v]trim=start=${cut.start}:end=${cut.end},setpts=PTS-STARTPTS[v${i}]; `;
    filter += `[0:a]atrim=start=${cut.start}:end=${cut.end},asetpts=PTS-STARTPTS[a${i}]; `;
  });
  
  const concatStr = cuts.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${cuts.length}:v=1:a=1[outv][outa]`;
  
  return `ffmpeg -i "${project.videoPath}" -filter_complex "${filter}${concatStr}" -map "[outv]" -map "[outa]" -c:v libx264 -preset superfast "${outputPath}"`;
};
