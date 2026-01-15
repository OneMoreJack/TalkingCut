export const translations = {
  en: {
    nav: {
      github: "GitHub",
    },
    hero: {
      tag: "AI-Powered Video Editor",
      title: "TalkingCut",
      subtitle: "A text-driven video editor designed for talking-head videos. Quickly remove filler words via text and achieve millisecond-level precision with waveform syncing.",
      download: "Download Now",
      github: "GitHub Source",
    },
    features: {
      title: "Core Highlights",
      subtitle: "TalkingCut combines advanced AI with intuitive interaction for an unprecedented editing experience.",
      items: [
        {
          title: "Fast: Text-Driven Editing",
          description: "Delete a word, phrase, or sentence in the editor, and the video 'cuts' instantly to match. Quick removal of bad takes via text.",
        },
        {
          title: "Accurate: Millisecond Precision",
          description: "Visualize audio waveforms for millisecond-accurate adjustments. Real-time syncing between waveform and text.",
        },
        {
          title: "Local: Private AI Engine",
          description: "Powered by WhisperX, all processing runs locally. No cloud fees, no privacy concerns.",
        },
        {
          title: "High Performance",
          description: "Optimized for Apple Silicon (MPS) and utilizes FFmpeg for rapid video export.",
        },
        {
          title: "Minimalist Workflow",
          description: "Import, Transcribe, Edit, Preview, Export. Five steps that let creation return to content itself.",
        },
        {
          title: "Waveform Sync",
          description: "Click text to instantly locate the waveform. Precise control over every cut point, making editing as easy as typing.",
        },
      ],
    },
    howItWorks: {
      title: "How It Works",
      subtitle: "Five simple steps to increase your editing efficiency by 10x.",
      steps: [
        {
          number: "01",
          title: "Import Video",
          description: "Drag and drop your video files directly into the TalkingCut application.",
        },
        {
          number: "02",
          title: "AI Transcription",
          description: "The local AI engine automatically generates word-level transcripts with precise timestamps.",
        },
        {
          number: "03",
          title: "Text Editing",
          description: "Edit video like a document. Highlight and delete text; the video follows the cuts automatically.",
        },
        {
          number: "04",
          title: "Instant Preview",
          description: "Instantly preview your edits in-app; the system automatically skips deleted segments.",
        },
        {
          number: "05",
          title: "Rapid Export",
          description: "Utilize FFmpeg stream copying for nearly instantaneous high-quality export.",
        },
      ],
    },
    footer: {
      text: "Created with ❤️ by Jack.",
    },
  },
  cn: {
    nav: {
      github: "GitHub",
    },
    hero: {
      tag: "AI 驱动的视频编辑器",
      title: "TalkingCut",
      subtitle: "专为口播视频打造的文本驱动型剪辑工具。通过文字快速剔除废片，结合波形图实现毫秒级精修。",
      download: "立即下载",
      github: "GitHub 源码",
    },
    features: {
      title: "核心亮点",
      subtitle: "TalkingCut 结合了最先进的 AI 技术和直观的交互界面，为您提供前所未有的剪辑体验。",
      items: [
        {
          title: "快：文本驱动剪辑",
          description: "在编辑器中删除一个词、短语或句子，视频会立即\"剪切\"以匹配。通过文字快速剔除废片。",
        },
        {
          title: "准：毫秒级精修",
          description: "可视化音频波形，支持毫秒级精确调整。波形图与文字区域实时联动，点击文字即可定位。",
        },
        {
          title: "省：本地 AI 引擎",
          description: "由 WhisperX 支持，所有处理都在本地运行。无云端费用，无隐私担忧。",
        },
        {
          title: "高性能架构",
          description: "针对 Apple Silicon (MPS) 优化，利用 FFmpeg 实现快速视频导出。",
        },
        {
          title: "极简工作流",
          description: "导入、转录、编辑、预览、导出。五个步骤，让创作回归内容本身。",
        },
        {
          title: "波形实时联动",
          description: "点击文本即刻定位波形，精准控制每一个剪辑点，让剪辑如敲字般简单。",
        },
      ],
    },
    howItWorks: {
      title: "工作原理",
      subtitle: "五个简单步骤，让您的剪辑流程效率提升 10 倍。",
      steps: [
        {
          number: "01",
          title: "导入视频",
          description: "将您的视频文件直接拖入 TalkingCut 应用程序。",
        },
        {
          number: "02",
          title: "AI 转录",
          description: "本地 AI 引擎自动为您的视频生成带有精确时间戳的词级转录。",
        },
        {
          number: "03",
          title: "文本编辑",
          description: "像编辑文档一样剪辑视频。高亮并删除文字，视频会自动跟随剪切。",
        },
        {
          number: "04",
          title: "快速预览",
          description: "在应用内即时预览剪辑效果，系统会自动跳过已删除的片段。",
        },
        {
          number: "05",
          title: "瞬间导出",
          description: "利用 FFmpeg 流复制技术，几乎瞬间完成高质量视频导出。",
        },
      ],
    },
    footer: {
      text: "由 Jack 用 ❤️ 创作",
    },
  },
};

export type Language = "en" | "cn";
export type Translations = typeof translations.en;
