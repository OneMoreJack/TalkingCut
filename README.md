# 🎙️ TalkingCut

**TalkingCut** is a professional-grade, desktop-based video editing tool that revolutionizes the editing workflow through **Text-based Video Editing**. Instead of manually trimming waveforms, you edit your video by simply deleting text from a transcribed script—just like editing a Word document.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20(Silicon)%20|%20Windows-lightgrey.svg)
![Tech](https://img.shields.io/badge/tech-Electron%20|%20WhisperX%20|%20FFmpeg-orange.svg)

## ✨ Key Features

- ✂️ **Text-Driven Editing**: Delete a word, phrase, or sentence in the editor, and the video is instantly "cut" to match.
- 🤖 **Local AI Engine**: Powered by **WhisperX** for high-precision, word-level timestamp alignment. Everything runs locally on your machine—no cloud, no privacy concerns.
- 🧹 **Smart Filler Word Detection**: Automatically identifies and highlights filler words ("uh", "um", "那个", "就是") and awkward silences for one-click removal.
- 🌬️ **Breathing Room Control**: Customizable padding (e.g., 0.1s) for every cut to ensure natural transitions without abrupt audio clipping.
- ⚡ **Lossless FFmpeg Rendering**: Utilizes FFmpeg's stream-copy and complex-filter capabilities for lightning-fast exports.
- 🍎 **Silicon Optimized**: Specifically architected to leverage Apple Silicon (MPS) for high-speed AI inference on MacBook hardware.

## 🏗️ Architecture

- **Frontend**: Next.js 15 (React) + Tailwind CSS + Lucide Icons.
- **Desktop Wrapper**: Electron (Node.js Main Process).
- **AI Core**: Python 3.10+ with WhisperX, Faster-Whisper, and Silero VAD.
- **Video Engine**: FFmpeg (integrated via Node.js child processes).

## 🚀 How it Works

1. **Import**: Drop a video file into the app.
2. **Transcribe**: The local AI engine generates a word-level transcript with exact timestamps.
3. **Edit**: Review the text. Highlight "uhm"s or mistakes and hit `Delete`.
4. **Preview**: Play back the video in the app; it automatically skips the "deleted" segments.
5. **Export**: FFmpeg concatenates the kept segments into a new, polished video file.

## 📈 Project Status & Roadmap

This project is currently in active development. We are focusing on refining the AI alignment accuracy and the "breathing room" logic.

Check out the full development plan here:
👉 [**View the Development TODO List**](./todo.md)

## 🛠️ Development

To contribute or run locally, ensure you have:
- Node.js (v18+)
- Python (3.10+)
- FFmpeg installed in your PATH

---
*Created with ❤️ by the TalkingCut Team.*
