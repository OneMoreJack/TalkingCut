# 🎙️ TalkingCut

[English](./README.md) | 简体中文

**TalkingCut** 是一款专为口播视频打造的文本驱动型剪辑工具。

**快**：通过文字快速剔除废片。  
**准**：结合波形图实现毫秒级精修。  
**省**：大幅优化粗剪流程，让创作回归内容本身。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20(Silicon)%20|%20Windows-lightgrey.svg)
![Tech](https://img.shields.io/badge/tech-Electron%20|%20WhisperX%20|%20FFmpeg-orange.svg)

## 📺 演示视频

<video src="./assets/docs/demo.mp4" controls width="100%" autoplay loop muted></video>

## ✨ 核心功能

- ✂️ **文本驱动编辑**：在编辑器中删除一个词、短语或句子，视频会立即"剪切"以匹配。
- 🤖 **本地 AI 引擎**：由 **WhisperX** 提供支持，实现高精度的词级时间戳对齐。所有处理都在本地运行——无云端，无隐私担忧。
- 📊 **波形图精修**：可视化音频波形，支持毫秒级精确调整。波形图与文字区域实时联动，点击文字即可定位到对应波形位置，实现更精细的剪辑控制。
- ⚡ **高效 FFmpeg 渲染**：利用 FFmpeg 的流复制和复杂滤镜功能实现快速导出。
- 🍎 **Apple Silicon 优化**：针对 Apple Silicon (MPS) 优化，在 MacBook 硬件上实现高速 AI 推理。

## 🏗️ 技术架构

- **前端**：Next.js 15 (React) + Tailwind CSS + Lucide Icons
- **桌面封装**：Electron (Node.js 主进程)
- **AI 核心**：Python 3.10+ 配合 WhisperX、Faster-Whisper 和 Silero VAD
- **视频引擎**：FFmpeg（通过 Node.js 子进程集成）

## 🚀 工作原理

1. **导入**：将视频文件拖入应用程序。
2. **转录**：本地 AI 引擎生成带有精确时间戳的词级转录。
3. **编辑**：查看文本。高亮"嗯"或错误并按 `Delete` 键。
4. **预览**：在应用中播放视频；它会自动跳过"已删除"的片段。
5. **导出**：FFmpeg 将保留的片段连接成一个新的、精美的视频文件。

## 📈 项目状态与路线图

本项目目前正在积极开发中。我们专注于改进 AI 对齐精度和"呼吸空间"逻辑。

查看完整的开发计划：
👉 [**查看开发 TODO 列表**](./todo.md)

## 🛠️ 本地开发

按照以下步骤在您的机器上设置开发环境。

### 📋 前置要求

- **Node.js**：v18 或更高版本
- **pnpm**：`npm install -g pnpm`
- **Python**：3.11 或更高版本
- **FFmpeg**：必须在系统 `PATH` 中可用。
  - macOS：`brew install ffmpeg`
  - Windows：`choco install ffmpeg`

### ⚙️ 安装

1. **克隆仓库**：
   ```bash
   git clone https://github.com/one-more/talkingcut.git
   cd talkingcut
   ```

2. **安装 Node.js 依赖**：
   ```bash
   pnpm install
   ```

3. **设置 Python 虚拟环境**：
   此步骤安装 AI 引擎（WhisperX、PyTorch 等）。由于需要下载大型机器学习库，可能需要几分钟时间。
   ```bash
   pnpm run python:setup
   ```

### 🚀 运行应用

在开发模式下启动 Electron 应用：
```bash
pnpm run electron:dev
```

### 📥 模型管理

应用打开后：
1. 从侧边栏选择模型。**注意**：模型越大，识别准确度越高，但需要更多 VRAM/RAM，处理速度也会更慢。如果您的设备有足够的资源（例如 16GB+ RAM），建议选择较大的模型。**Medium** 通常是在速度和准确度之间的最佳平衡选择。
2. 点击 **Download** 按钮或直接点击 **"Open Video File"**——应用会自动将所需的模型下载到本地存储。
3. 一旦状态变为绿色（**Cached**），您就可以开始转录了！

---
*Created with ❤️ by Jack.*
