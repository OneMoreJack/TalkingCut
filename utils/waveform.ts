/**
 * Waveform utility for peak extraction
 */

export interface WaveformPeaks {
  data: number[];
  length: number;
}

/**
 * Extracts peaks from an AudioBuffer for visualization
 * @param buffer The AudioBuffer decoded from audio data
 * @param samples The number of data points to extract (usually matches width in pixels)
 */
export const extractPeaks = (buffer: AudioBuffer, samples: number): WaveformPeaks => {
  const channelData = buffer.getChannelData(0); // Use first channel
  const sampleSize = Math.floor(channelData.length / samples);
  const peaks: number[] = [];

  for (let i = 0; i < samples; i++) {
    const start = i * sampleSize;
    let max = 0;

    // Find absolute max in this range
    for (let j = 0; j < sampleSize; j++) {
      const val = Math.abs(channelData[start + j]);
      if (val > max) max = val;
    }

    peaks.push(max);
  }

  return {
    data: peaks,
    length: peaks.length
  };
};
