# 🎙️ TalkingCut

English | [简体中文](./README_CN.md)

**TalkingCut** is a text-driven editing tool designed specifically for spoken video content.

**Fast**: Quickly remove unwanted footage through text editing.  
**Precise**: Achieve millisecond-level refinement with waveform visualization.  
**Efficient**: Dramatically optimize rough-cut workflows, letting creators focus on content.


![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20(Silicon)%20|%20Windows-lightgrey.svg)
![Tech](https://img.shields.io/badge/tech-Electron%20|%20WhisperX%20|%20FFmpeg-orange.svg)

## 📺 Demo

<video src="./assets/docs/demo.mp4" controls width="100%" autoplay loop muted></video>

## ✨ Key Features

- ✂️ **Text-Driven Editing**: Delete a word, phrase, or sentence in the editor, and the video is instantly "cut" to match.
- 🤖 **Local AI Engine**: Powered by **WhisperX** for high-precision, word-level timestamp alignment. Everything runs locally on your machine—no cloud, no privacy concerns.
- 📊 **Waveform Refinement**: Visualize audio waveforms for millisecond-level precision. The waveform syncs with the text editor in real-time—click on text to jump to the corresponding waveform position for fine-grained editing control.
- ⚡ **Efficient FFmpeg Rendering**: Utilizes FFmpeg's stream-copy and complex-filter capabilities for fast exports.
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

## 🛠️ Local Development

Follow these steps to set up the development environment on your machine.

### 📋 Prerequisites

- **Node.js**: v18 or later
- **pnpm**: `npm install -g pnpm`
- **Python**: 3.11 or later
- **FFmpeg**: Must be available in your system `PATH`.
  - macOS: `brew install ffmpeg`
  - Windows: `choco install ffmpeg`

### ⚙️ Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/one-more/talkingcut.git
   cd talkingcut
   ```

2. **Install Node.js dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up Python Virtual Environment**:
   This step installs the AI engine (WhisperX, PyTorch, etc.). This may take several minutes as it downloads large machine learning libraries.
   ```bash
   pnpm run python:setup
   ```

### 🚀 Running the App

Start the Electron app in development mode:
```bash
pnpm run electron:dev
```

### 📥 Model Management

When the app opens:
1. Select a model size from the sidebar. **Note**: Larger models provide higher recognition accuracy but require more VRAM/RAM and are slower to process. If your device has sufficient resources (e.g., 16GB+ RAM), choosing a larger model is recommended. **Medium** is generally the best balance between speed and accuracy for most users.
2. Click the **Download** button or simply click **"Open Video File"**—the app will automatically download the required model weights to your local storage.
3. Once the status turns green (**Cached**), you're ready to transcribe!

---
*Created with ❤️ by the Jack.*
