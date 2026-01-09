/**
 * FFmpeg Bridge Service
 * ======================
 * 
 * Handles audio extraction and video cutting via FFmpeg.
 * Reports progress back to the renderer process.
 */

import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export class FFmpegBridge {
  private currentProcess: ChildProcess | null = null;
  private ffmpegPath: string = 'ffmpeg';

  constructor() {
    this.detectFFmpegPath();
  }

  /**
   * Auto-detect FFmpeg in PATH or common locations
   */
  private detectFFmpegPath(): void {
    const possiblePaths = [
      '/usr/local/bin/ffmpeg',
      '/opt/homebrew/bin/ffmpeg',
      '/usr/bin/ffmpeg',
      'ffmpeg' // System PATH
    ];

    for (const p of possiblePaths) {
      try {
        if (p === 'ffmpeg' || fs.existsSync(p)) {
          this.ffmpegPath = p;
          console.log(`[FFmpegBridge] Using FFmpeg at: ${p}`);
          return;
        }
      } catch {
        // Try next path
      }
    }

    console.log('[FFmpegBridge] Using system ffmpeg');
  }

  /**
   * Extract audio from a video file for transcription
   */
  async extractAudio(
    videoPath: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create a temp file for the extracted audio
      const outputPath = path.join(
        os.tmpdir(),
        `talkingcut_audio_${Date.now()}.wav`
      );

      // -vn: no video, -acodec pcm_s16le: 16-bit WAV, -ar 16000: 16kHz sample rate
      const args = [
        '-i', videoPath,
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        '-y', // Overwrite output
        outputPath
      ];

      console.log(`[FFmpegBridge] Extracting audio: ${this.ffmpegPath} ${args.join(' ')}`);

      this.currentProcess = spawn(this.ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let duration: number | null = null;

      // FFmpeg outputs progress to stderr
      this.currentProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();

        // Parse duration
        const durationMatch = text.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
        if (durationMatch) {
          const [, hours, minutes, seconds] = durationMatch;
          duration = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
        }

        // Parse progress
        const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2})/);
        if (timeMatch && duration) {
          const [, hours, minutes, seconds] = timeMatch;
          const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
          const progress = Math.min(100, (currentTime / duration) * 100);
          onProgress?.(progress);
        }
      });

      this.currentProcess.on('error', (error) => {
        this.currentProcess = null;
        reject(new Error(`FFmpeg error: ${error.message}`));
      });

      this.currentProcess.on('close', (code) => {
        this.currentProcess = null;

        if (code !== 0) {
          reject(new Error(`FFmpeg exited with code ${code}`));
          return;
        }

        onProgress?.(100);
        resolve(outputPath);
      });
    });
  }

  /**
   * Execute a pre-generated FFmpeg command for video cutting
   */
  async executeCommand(
    command: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Parse the command string into args (simplified parsing)
      const args = this.parseCommand(command);

      console.log(`[FFmpegBridge] Executing: ${this.ffmpegPath} ${args.join(' ')}`);

      this.currentProcess = spawn(this.ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let duration: number | null = null;

      this.currentProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();

        // Parse duration from input file info
        const durationMatch = text.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
        if (durationMatch && !duration) {
          const [, hours, minutes, seconds] = durationMatch;
          duration = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
        }

        // Parse progress
        const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2})/);
        if (timeMatch && duration) {
          const [, hours, minutes, seconds] = timeMatch;
          const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
          const progress = Math.min(100, (currentTime / duration) * 100);
          onProgress?.(progress);
        }
      });

      this.currentProcess.on('error', (error) => {
        this.currentProcess = null;
        reject(new Error(`FFmpeg error: ${error.message}`));
      });

      this.currentProcess.on('close', (code) => {
        this.currentProcess = null;

        if (code !== 0) {
          reject(new Error(`FFmpeg exited with code ${code}`));
          return;
        }

        onProgress?.(100);
        resolve();
      });
    });
  }

  /**
   * Parse an FFmpeg command string into arguments array
   * Handles quoted strings properly
   */
  private parseCommand(command: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    // Skip the 'ffmpeg' part if present
    let cmdToParse = command.trim();
    if (cmdToParse.startsWith('ffmpeg ')) {
      cmdToParse = cmdToParse.substring(7);
    }

    for (const char of cmdToParse) {
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          args.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      args.push(current);
    }

    return args;
  }

  /**
   * Cancel the current FFmpeg process
   */
  cancel(): void {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
  }

  /**
   * Get video duration in seconds
   */
  async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', videoPath,
        '-hide_banner'
      ];

      const proc = spawn(this.ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderrBuffer = '';

      proc.stderr?.on('data', (data: Buffer) => {
        stderrBuffer += data.toString();
      });

      proc.on('close', () => {
        const match = stderrBuffer.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (match) {
          const [, hours, minutes, seconds, centiseconds] = match;
          const duration =
            parseInt(hours) * 3600 +
            parseInt(minutes) * 60 +
            parseInt(seconds) +
            parseInt(centiseconds) / 100;
          resolve(duration);
        } else {
          reject(new Error('Could not determine video duration'));
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }
}
