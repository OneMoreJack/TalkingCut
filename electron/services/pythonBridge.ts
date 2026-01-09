/**
 * Python Bridge Service
 * ======================
 * 
 * Manages Python subprocess for transcription.
 * Streams progress from stdout and returns parsed JSON result.
 */

import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface TranscribeOptions {
  model?: string;
  language?: string;
  onProgress?: (progress: number, message: string) => void;
}

export interface TranscribeResult {
  segments: Array<{
    id: string;
    text: string;
    start: number;
    end: number;
    confidence: number;
    type: 'word' | 'filler' | 'silence';
    deleted: boolean;
  }>;
  metadata?: {
    model: string;
    input_file: string;
  };
}

export class PythonBridge {
  private currentProcess: ChildProcess | null = null;
  private pythonPath: string | null = null;

  constructor() {
    this.detectPythonPath();
  }

  /**
   * Auto-detect Python path in virtual environment or system
   */
  private detectPythonPath(): void {
    const possiblePaths = [
      // Project venv (relative to app root)
      path.join(process.cwd(), 'python', 'venv', 'bin', 'python'),
      path.join(process.cwd(), 'python', 'venv', 'Scripts', 'python.exe'),
      // System Python
      '/usr/bin/python3',
      '/usr/local/bin/python3',
      'python3',
      'python'
    ];

    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          this.pythonPath = p;
          const isVenv = p.includes(path.join('python', 'venv'));
          console.log(`[PythonBridge] Found Python at: ${p} (${isVenv ? 'VENV' : 'SYSTEM'})`);
          return;
        }
      } catch {
        // Try next path
      }
    }

    // Fallback to 'python3' and hope it's in PATH
    this.pythonPath = 'python3';
    console.log('[PythonBridge] Using system python3');
  }

  /**
   * Get the path to the transcribe.py script
   */
  private getScriptPath(): string {
    // In development, use the source directly
    const devPath = path.join(process.cwd(), 'python', 'transcribe.py');
    if (fs.existsSync(devPath)) {
      return devPath;
    }

    // In production, it might be bundled differently
    const prodPath = path.join(process.resourcesPath || '', 'python', 'transcribe.py');
    if (fs.existsSync(prodPath)) {
      return prodPath;
    }

    throw new Error('transcribe.py not found');
  }

  /**
   * Run transcription on an audio file
   */
  async transcribe(audioPath: string, options: TranscribeOptions = {}): Promise<TranscribeResult> {
    return new Promise((resolve, reject) => {
      const scriptPath = this.getScriptPath();
      const tempOutputPath = path.join(os.tmpdir(), `talkingcut_${Date.now()}.json`);

      const args = [
        scriptPath,
        '--input', audioPath,
        '--output', tempOutputPath,
        '--model', options.model || 'base'
      ];

      if (options.language) {
        args.push('--language', options.language);
      }

      console.log(`[PythonBridge] Running: ${this.pythonPath} ${args.join(' ')}`);

      this.currentProcess = spawn(this.pythonPath!, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdoutBuffer = '';
      let stderrBuffer = '';

      this.currentProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        stdoutBuffer += text;

        // Parse progress messages from stdout
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('[TalkingCut]')) {
            const message = line.replace('[TalkingCut] ', '');

            // Estimate progress based on message content
            let progress = 50;
            if (message.includes('Loading model')) progress = 10;
            else if (message.includes('Loading audio')) progress = 20;
            else if (message.includes('Transcribing')) progress = 30;
            else if (message.includes('alignment model')) progress = 50;
            else if (message.includes('Aligning')) progress = 60;
            else if (message.includes('silences')) progress = 80;
            else if (message.includes('Found')) progress = 95;

            options.onProgress?.(progress, message);
          }
        }
      });

      this.currentProcess.stderr?.on('data', (data: Buffer) => {
        stderrBuffer += data.toString();
      });

      this.currentProcess.on('error', (error) => {
        this.currentProcess = null;
        reject(new Error(`Python process error: ${error.message}`));
      });

      this.currentProcess.on('close', (code) => {
        this.currentProcess = null;

        if (code !== 0) {
          let errorMessage = stderrBuffer;
          if (stderrBuffer.includes('ModuleNotFoundError') || stderrBuffer.includes('No module named')) {
            errorMessage = `Missing Python dependencies. Please run 'pnpm run python:setup' in your terminal.\n\nDetails: ${stderrBuffer}`;
          } else if (!this.pythonPath?.includes('venv')) {
            errorMessage = `Python virtual environment not found or incomplete. Try running 'pnpm run python:setup'.\n\nDetails: ${stderrBuffer}`;
          }
          reject(new Error(`Python process exited with code ${code}: ${errorMessage}`));
          return;
        }

        // Read the output JSON file
        try {
          const jsonContent = fs.readFileSync(tempOutputPath, 'utf-8');
          const result = JSON.parse(jsonContent) as TranscribeResult;

          // Cleanup temp file
          fs.unlinkSync(tempOutputPath);

          options.onProgress?.(100, 'Transcription complete');
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to read transcription result: ${(error as Error).message}`));
        }
      });
    });
  }

  /**
   * Cancel the current transcription process
   */
  cancel(): void {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
  }
}
