import { useEffect, useState } from 'react';
import { extractPeaks, WaveformPeaks } from '../utils/waveform';

export const useWaveform = (audioPath: string | null, samples: number = 2000) => {
  const [peaks, setPeaks] = useState<WaveformPeaks | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!audioPath || !window.electronAPI) {
      setPeaks(null);
      return;
    }

    let isCancelled = false;
    const loadAudio = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const buffer = await window.electronAPI.readVideoFile(audioPath);
        if (!buffer) throw new Error('Failed to read audio file');

        if (isCancelled) return;

        // Ensure we have a raw ArrayBuffer (handle case where buffer might be a TypedArray/Node Buffer)
        const arrayBuffer = (buffer instanceof ArrayBuffer)
          ? buffer
          : (buffer as any).buffer.slice((buffer as any).byteOffset, (buffer as any).byteOffset + (buffer as any).byteLength);

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        if (isCancelled) return;

        const extractedPeaks = extractPeaks(audioBuffer, samples);
        setPeaks(extractedPeaks);
      } catch (err) {
        console.error('[useWaveform] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadAudio();

    return () => {
      isCancelled = true;
    };
  }, [audioPath, samples]);

  return { peaks, isLoading, error };
};
