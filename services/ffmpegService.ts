
import { VideoProject } from '../types';

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
 * Generates an FFmpeg command to concat the segments with audio crossfades.
 * Uses filter_complex for frame-accurate cutting and smooth audio transitions.
 */
export const generateFFmpegCommand = (project: VideoProject, outputPath: string) => {
  const cuts = generateCutList(project);
  if (cuts.length === 0) return '';

  const { crossfadeDuration } = project.settings;

  // 1. Define Trim and SetPTS filters for each segment
  let filter = '';
  cuts.forEach((cut, i) => {
    // Video part
    filter += `[0:v]trim=start=${cut.start}:end=${cut.end},setpts=PTS-STARTPTS[v${i}]; `;
    // Audio part
    filter += `[0:a]atrim=start=${cut.start}:end=${cut.end},asetpts=PTS-STARTPTS[a${i}]; `;
  });

  // 2. Concat video segments (video is easy to concat)
  const vConcatInput = cuts.map((_, i) => `[v${i}]`).join('');
  filter += `${vConcatInput}concat=n=${cuts.length}:v=1:a=0[outv]; `;

  // 3. Chain audio segments with crossfades
  if (cuts.length === 1) {
    filter += `[a0]anull[outa]`;
  } else {
    let lastAudio = '[a0]';
    for (let i = 1; i < cuts.length; i++) {
      const isLast = i === cuts.length - 1;
      const nextOutput = isLast ? '[outa]' : `[ax${i}]`;
      filter += `${lastAudio}[a${i}]acrossfade=d=${crossfadeDuration}:curve1=exp:curve2=exp${nextOutput}${isLast ? '' : '; '}`;
      lastAudio = `[ax${i}]`;
    }
  }

  // Final command
  // Trim trailing semicolon if any (though we handled it above)
  const finalFilter = filter.trim().replace(/;$/, '');
  return `ffmpeg -i "${project.videoPath}" -filter_complex "${finalFilter}" -map "[outv]" -map "[outa]" -c:v libx264 -preset superfast -c:a aac -b:a 192k "${outputPath}"`;
};
