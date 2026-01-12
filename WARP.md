# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

TalkingCut is a text-based video editing tool that allows users to edit videos by deleting text from a transcribed script. The application uses local AI (WhisperX) for transcription and FFmpeg for video processing.

**Technology Stack:**
- Frontend: React 19 + Vite + TypeScript
- Desktop: Electron
- AI Engine: Python (WhisperX, Silero VAD)
- Video Processing: FFmpeg
- Package Manager: pnpm

## Development Commands

### Initial Setup
```bash
# Install Node.js dependencies
pnpm install

# Set up Python virtual environment and install AI dependencies (takes several minutes)
pnpm run python:setup
```

### Running the App
```bash
# Start Electron app in development mode
pnpm run electron:dev
```

### Building
```bash
# Build frontend only
pnpm run build

# Build and package Electron app for distribution
pnpm run electron:build

# Build and preview (without packaging)
pnpm run electron:preview
```

### Testing Python Engine
```bash
# Activate Python virtual environment first
cd python
source venv/bin/activate  # On macOS/Linux
# or: venv\Scripts\activate  # On Windows

# Run transcription on a test file
python transcribe.py --input <video_file> --output output.json --model base

# Test with specific language
python transcribe.py --input <video_file> --output output.json --model base --language en
```

## Architecture Overview

### Three-Layer Architecture

1. **Frontend (React/TypeScript)**
   - `App.tsx` - Main application component with project state management
   - `components/WordEditor.tsx` - Primary editing interface for word-by-word deletion
   - `components/Timeline.tsx` - Visual timeline representation
   - `components/ModelSelector.tsx` - AI model download and selection UI
   - `hooks/useProject.ts` - Core project state management (segments, undo/redo)
   - `hooks/useModelDownload.ts` - Model download orchestration

2. **Electron Bridge (Node.js)**
   - `electron/main.ts` - Main process with IPC handlers for all operations
   - `electron/preload.ts` - Secure API bridge using contextBridge
   - `electron/services/pythonBridge.ts` - Spawns Python subprocess for transcription
   - `electron/services/ffmpegBridge.ts` - Spawns FFmpeg for audio extraction and video export
   - `electron/services/modelManager.ts` - Manages local AI model storage
   - `electron/services/downloadManager.ts` - Handles model downloads with progress tracking
   - `electron/services/fileManager.ts` - Manages temp workspace and project files

3. **Python AI Engine**
   - `python/transcribe.py` - WhisperX-based transcription with word-level alignment
   - Uses Silero VAD for silence detection
   - Outputs structured JSON with word segments, timestamps, and types (word/filler/silence)

### Data Flow

**Transcription Flow:**
1. User selects video → Frontend calls `window.electronAPI.transcribe.start()`
2. Electron main process receives IPC call
3. FFmpegBridge extracts audio to temp WAV file (16kHz, mono)
4. PythonBridge spawns Python subprocess with transcribe.py
5. Python returns JSON with word segments, timing, and metadata
6. Results flow back through IPC to frontend
7. Frontend populates WordEditor with editable segments

**Export Flow:**
1. Frontend generates FFmpeg command via `ffmpegService.generateFFmpegCommand()`
2. Command uses `filter_complex` with trim/concat/acrossfade filters
3. Electron spawns FFmpeg process
4. Progress parsed from stderr and sent via IPC
5. Final video written to user-selected path

### Key Concepts

**Word Segments:** Each word has:
- Precise timestamps (start/end)
- Type: `word`, `filler`, or `silence`
- `deleted` flag for editing
- `isLastInSegment` - controls line breaks in editor (gap >= 1.0s or sentence ending)
- `hasTrailingSpace` - English language spacing

**Breathing Room (Padding):** Configurable padding added to kept segments to prevent abrupt cuts:
- `paddingStart` / `paddingEnd` (default: 0.1s each)
- Applied in `services/ffmpegService.ts` during cut list generation

**Crossfade:** Audio transitions between segments use `acrossfade` filter (default: 0.02s) to eliminate pops/clicks

**Model Management:** WhisperX models downloaded on-demand:
- Stored in `~/Library/Application Support/talkingcut/models` (macOS)
- Models: tiny, base, small, medium, large-v3
- Frontend shows cache status badges

## Important Implementation Details

### IPC Communication Pattern
All Electron communication uses typed IPC handlers:
- Main process: `ipcMain.handle('namespace:action', ...)`
- Preload: exposes `window.electronAPI.namespace.action()`
- Frontend: calls `window.electronAPI.*` with TypeScript safety

### Python Environment Detection
`pythonBridge.ts` auto-detects Python in this order:
1. `python/venv/bin/python` (project venv) 
2. System Python3
If transcription fails with ModuleNotFoundError, user must run `pnpm run python:setup`

### Device Selection for AI
Python engine (`transcribe.py`) auto-detects:
- **macOS:** Forces CPU (WhisperX's faster-whisper doesn't support MPS reliably)
- **Windows/Linux:** Uses CUDA if available, otherwise CPU
- CPU mode uses `int8` quantization for 2-4x speedup
- Thread count: 80% of available cores via `OMP_NUM_THREADS`

### Line Breaking Logic
Lines break in WordEditor when:
- Gap between words >= `settings.breakGap` (default: 1.0s)
- Word ends with sentence punctuation (。？！.?!)
- Implemented in `transcribe.py` during second pass processing

### FFmpeg Command Generation
The `generateFFmpegCommand` function creates complex filter chains:
```
[0:v]trim...[v0]; [0:a]atrim...[a0];  # Per-segment trimming
[v0][v1]...concat[outv];              # Video concatenation
[a0][a1]acrossfade[ax1]; [ax1][a2]... # Audio crossfades
```

### Temporary Files
Managed by FileManager:
- Extracted audio: `os.tmpdir()/talkingcut_audio_*.wav`
- Transcription JSON: `os.tmpdir()/talkingcut_*.json`
- Cleaned up on app exit via `will-quit` event

## File Naming Conventions

- React components: PascalCase (`WordEditor.tsx`)
- Services: camelCase (`pythonBridge.ts`, `ffmpegService.ts`)
- Types: PascalCase interfaces in `types/index.ts`
- Python: snake_case (`transcribe.py`)

## Dependencies to Note

### System Requirements
- **FFmpeg:** Must be in system PATH. Install via `brew install ffmpeg` (macOS) or `choco install ffmpeg` (Windows)
- **Python 3.11+:** Required for Python engine
- **Node.js 18+:** For Electron and frontend

### Critical Python Packages
- `whisperx>=3.1.1` - Core transcription engine
- `torch>=2.0` - PyTorch for ML inference
- `silero-vad>=5.0` - Voice activity detection
- Environment variable `TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD=1` set to handle omegaconf in checkpoints

## Development Workflows

### Adding New Model Sizes
1. Add definition to `electron/models/modelDefinitions.ts`
2. Update choices in `python/transcribe.py` argparse
3. Frontend automatically picks up new models from `MODEL_DEFINITIONS`

### Modifying Transcription Behavior
- Filler word detection: Edit `FILLER_WORDS` dict in `python/transcribe.py`
- Line breaking logic: Modify gap threshold or punctuation regex in `transcribe_audio()` second pass
- VAD sensitivity: Adjust `threshold` parameter in `detect_silences()`

### Debugging Transcription Issues
1. Check Python logs in Electron console (main process)
2. Test Python engine standalone: `python/venv/bin/python python/transcribe.py --input test.mp4 --output out.json`
3. Verify FFmpeg audio extraction worked: check temp WAV file exists and is valid
4. Common issue: Missing dependencies → run `pnpm run python:setup` again

### Project File Format
- Extension: `.tcproj`
- Content: JSON serialization of `VideoProject` interface
- Includes: segments array, settings, video path, metadata
- Saved via `fileManager.saveProject()`, loaded via `fileManager.loadProject()`
