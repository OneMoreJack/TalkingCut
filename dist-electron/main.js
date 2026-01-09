var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import fs$1 from "fs/promises";
class FFmpegBridge {
  constructor() {
    __publicField(this, "currentProcess", null);
    __publicField(this, "ffmpegPath", "ffmpeg");
    this.detectFFmpegPath();
  }
  /**
   * Auto-detect FFmpeg in PATH or common locations
   */
  detectFFmpegPath() {
    const possiblePaths = [
      "/usr/local/bin/ffmpeg",
      "/opt/homebrew/bin/ffmpeg",
      "/usr/bin/ffmpeg",
      "ffmpeg"
      // System PATH
    ];
    for (const p of possiblePaths) {
      try {
        if (p === "ffmpeg" || fs.existsSync(p)) {
          this.ffmpegPath = p;
          console.log(`[FFmpegBridge] Using FFmpeg at: ${p}`);
          return;
        }
      } catch {
      }
    }
    console.log("[FFmpegBridge] Using system ffmpeg");
  }
  /**
   * Extract audio from a video file for transcription
   */
  async extractAudio(videoPath, onProgress) {
    return new Promise((resolve, reject) => {
      var _a;
      const outputPath = path.join(
        os.tmpdir(),
        `talkingcut_audio_${Date.now()}.wav`
      );
      const args = [
        "-i",
        videoPath,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-y",
        // Overwrite output
        outputPath
      ];
      console.log(`[FFmpegBridge] Extracting audio: ${this.ffmpegPath} ${args.join(" ")}`);
      this.currentProcess = spawn(this.ffmpegPath, args, {
        stdio: ["ignore", "pipe", "pipe"]
      });
      let duration = null;
      (_a = this.currentProcess.stderr) == null ? void 0 : _a.on("data", (data) => {
        const text = data.toString();
        const durationMatch = text.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
        if (durationMatch) {
          const [, hours, minutes, seconds] = durationMatch;
          duration = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
        }
        const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2})/);
        if (timeMatch && duration) {
          const [, hours, minutes, seconds] = timeMatch;
          const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
          const progress = Math.min(100, currentTime / duration * 100);
          onProgress == null ? void 0 : onProgress(progress);
        }
      });
      this.currentProcess.on("error", (error) => {
        this.currentProcess = null;
        reject(new Error(`FFmpeg error: ${error.message}`));
      });
      this.currentProcess.on("close", (code) => {
        this.currentProcess = null;
        if (code !== 0) {
          reject(new Error(`FFmpeg exited with code ${code}`));
          return;
        }
        onProgress == null ? void 0 : onProgress(100);
        resolve(outputPath);
      });
    });
  }
  /**
   * Execute a pre-generated FFmpeg command for video cutting
   */
  async executeCommand(command, onProgress) {
    return new Promise((resolve, reject) => {
      var _a;
      const args = this.parseCommand(command);
      console.log(`[FFmpegBridge] Executing: ${this.ffmpegPath} ${args.join(" ")}`);
      this.currentProcess = spawn(this.ffmpegPath, args, {
        stdio: ["ignore", "pipe", "pipe"]
      });
      let duration = null;
      (_a = this.currentProcess.stderr) == null ? void 0 : _a.on("data", (data) => {
        const text = data.toString();
        const durationMatch = text.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
        if (durationMatch && !duration) {
          const [, hours, minutes, seconds] = durationMatch;
          duration = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
        }
        const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2})/);
        if (timeMatch && duration) {
          const [, hours, minutes, seconds] = timeMatch;
          const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
          const progress = Math.min(100, currentTime / duration * 100);
          onProgress == null ? void 0 : onProgress(progress);
        }
      });
      this.currentProcess.on("error", (error) => {
        this.currentProcess = null;
        reject(new Error(`FFmpeg error: ${error.message}`));
      });
      this.currentProcess.on("close", (code) => {
        this.currentProcess = null;
        if (code !== 0) {
          reject(new Error(`FFmpeg exited with code ${code}`));
          return;
        }
        onProgress == null ? void 0 : onProgress(100);
        resolve();
      });
    });
  }
  /**
   * Parse an FFmpeg command string into arguments array
   * Handles quoted strings properly
   */
  parseCommand(command) {
    const args = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";
    let cmdToParse = command.trim();
    if (cmdToParse.startsWith("ffmpeg ")) {
      cmdToParse = cmdToParse.substring(7);
    }
    for (const char of cmdToParse) {
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = "";
      } else if (char === " " && !inQuotes) {
        if (current) {
          args.push(current);
          current = "";
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
  cancel() {
    if (this.currentProcess) {
      this.currentProcess.kill("SIGTERM");
      this.currentProcess = null;
    }
  }
  /**
   * Get video duration in seconds
   */
  async getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
      var _a;
      const args = [
        "-i",
        videoPath,
        "-hide_banner"
      ];
      const proc = spawn(this.ffmpegPath, args, {
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stderrBuffer = "";
      (_a = proc.stderr) == null ? void 0 : _a.on("data", (data) => {
        stderrBuffer += data.toString();
      });
      proc.on("close", () => {
        const match = stderrBuffer.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (match) {
          const [, hours, minutes, seconds, centiseconds] = match;
          const duration = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds) / 100;
          resolve(duration);
        } else {
          reject(new Error("Could not determine video duration"));
        }
      });
      proc.on("error", (error) => {
        reject(error);
      });
    });
  }
}
class FileManager {
  constructor() {
    __publicField(this, "workspacePath");
    this.workspacePath = path.join(
      os.tmpdir(),
      "TalkingCut",
      `session_${Date.now()}`
    );
    this.initWorkspace();
  }
  /**
   * Initialize the workspace directory
   */
  async initWorkspace() {
    try {
      await fs$1.mkdir(this.workspacePath, { recursive: true });
      console.log(`[FileManager] Workspace created: ${this.workspacePath}`);
    } catch (error) {
      console.error(`[FileManager] Failed to create workspace: ${error}`);
    }
  }
  /**
   * Get the workspace path
   */
  getWorkspacePath() {
    return this.workspacePath;
  }
  /**
   * Get the user data directory (for persistent storage)
   */
  getUserDataPath() {
    return app.getPath("userData");
  }
  /**
   * Save project data to a file
   */
  async saveProject(filePath, projectData) {
    await fs$1.writeFile(filePath, projectData, "utf-8");
    console.log(`[FileManager] Project saved to: ${filePath}`);
  }
  /**
   * Load project data from a file
   */
  async loadProject(filePath) {
    const data = await fs$1.readFile(filePath, "utf-8");
    console.log(`[FileManager] Project loaded from: ${filePath}`);
    return data;
  }
  /**
   * Create a cache file for extracted audio
   */
  async cacheAudio(sourceVideoPath, audioData) {
    const hash = this.hashPath(sourceVideoPath);
    const cachePath = path.join(this.workspacePath, `audio_${hash}.wav`);
    await fs$1.writeFile(cachePath, audioData);
    return cachePath;
  }
  /**
   * Check if cached audio exists for a video
   */
  async getCachedAudio(sourceVideoPath) {
    const hash = this.hashPath(sourceVideoPath);
    const cachePath = path.join(this.workspacePath, `audio_${hash}.wav`);
    try {
      await fs$1.access(cachePath);
      return cachePath;
    } catch {
      return null;
    }
  }
  /**
   * Save a JSON snapshot of the project state
   */
  async saveSnapshot(snapshotId, data) {
    const snapshotPath = path.join(this.workspacePath, `snapshot_${snapshotId}.json`);
    await fs$1.writeFile(snapshotPath, JSON.stringify(data, null, 2), "utf-8");
    return snapshotPath;
  }
  /**
   * Load a JSON snapshot
   */
  async loadSnapshot(snapshotId) {
    const snapshotPath = path.join(this.workspacePath, `snapshot_${snapshotId}.json`);
    try {
      const data = await fs$1.readFile(snapshotPath, "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  /**
   * List all snapshots in the workspace
   */
  async listSnapshots() {
    try {
      const files = await fs$1.readdir(this.workspacePath);
      return files.filter((f) => f.startsWith("snapshot_") && f.endsWith(".json")).map((f) => f.replace("snapshot_", "").replace(".json", ""));
    } catch {
      return [];
    }
  }
  /**
   * Cleanup the workspace (remove all temp files)
   */
  async cleanupWorkspace() {
    try {
      await fs$1.rm(this.workspacePath, { recursive: true, force: true });
      console.log(`[FileManager] Workspace cleaned: ${this.workspacePath}`);
    } catch (error) {
      console.error(`[FileManager] Cleanup failed: ${error}`);
    }
  }
  /**
   * Create a simple hash from a file path (for caching)
   */
  hashPath(filePath) {
    let hash = 0;
    for (let i = 0; i < filePath.length; i++) {
      const char = filePath.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
  /**
   * Get recent projects from user data
   */
  async getRecentProjects() {
    const recentPath = path.join(this.getUserDataPath(), "recent_projects.json");
    try {
      const data = await fs$1.readFile(recentPath, "utf-8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
  /**
   * Add a project to the recent projects list
   */
  async addRecentProject(projectPath, projectName) {
    const recentPath = path.join(this.getUserDataPath(), "recent_projects.json");
    let recent = await this.getRecentProjects();
    recent = recent.filter((p) => p.path !== projectPath);
    recent.unshift({
      path: projectPath,
      name: projectName,
      date: (/* @__PURE__ */ new Date()).toISOString()
    });
    recent = recent.slice(0, 10);
    await fs$1.writeFile(recentPath, JSON.stringify(recent, null, 2), "utf-8");
  }
}
class PythonBridge {
  constructor() {
    __publicField(this, "currentProcess", null);
    __publicField(this, "pythonPath", null);
    this.detectPythonPath();
  }
  /**
   * Auto-detect Python path in virtual environment or system
   */
  detectPythonPath() {
    const possiblePaths = [
      // Project venv (relative to app root)
      path.join(process.cwd(), "python", "venv", "bin", "python"),
      path.join(process.cwd(), "python", "venv", "Scripts", "python.exe"),
      // System Python
      "/usr/bin/python3",
      "/usr/local/bin/python3",
      "python3",
      "python"
    ];
    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          this.pythonPath = p;
          console.log(`[PythonBridge] Found Python at: ${p}`);
          return;
        }
      } catch {
      }
    }
    this.pythonPath = "python3";
    console.log("[PythonBridge] Using system python3");
  }
  /**
   * Get the path to the transcribe.py script
   */
  getScriptPath() {
    const devPath = path.join(process.cwd(), "python", "transcribe.py");
    if (fs.existsSync(devPath)) {
      return devPath;
    }
    const prodPath = path.join(process.resourcesPath || "", "python", "transcribe.py");
    if (fs.existsSync(prodPath)) {
      return prodPath;
    }
    throw new Error("transcribe.py not found");
  }
  /**
   * Run transcription on an audio file
   */
  async transcribe(audioPath, options = {}) {
    return new Promise((resolve, reject) => {
      var _a, _b;
      const scriptPath = this.getScriptPath();
      const tempOutputPath = path.join(os.tmpdir(), `talkingcut_${Date.now()}.json`);
      const args = [
        scriptPath,
        "--input",
        audioPath,
        "--output",
        tempOutputPath,
        "--model",
        options.model || "base"
      ];
      if (options.language) {
        args.push("--language", options.language);
      }
      console.log(`[PythonBridge] Running: ${this.pythonPath} ${args.join(" ")}`);
      this.currentProcess = spawn(this.pythonPath, args, {
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stderrBuffer = "";
      (_a = this.currentProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
        var _a2;
        const text = data.toString();
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("[TalkingCut]")) {
            const message = line.replace("[TalkingCut] ", "");
            let progress = 50;
            if (message.includes("Loading model")) progress = 10;
            else if (message.includes("Loading audio")) progress = 20;
            else if (message.includes("Transcribing")) progress = 30;
            else if (message.includes("alignment model")) progress = 50;
            else if (message.includes("Aligning")) progress = 60;
            else if (message.includes("silences")) progress = 80;
            else if (message.includes("Found")) progress = 95;
            (_a2 = options.onProgress) == null ? void 0 : _a2.call(options, progress, message);
          }
        }
      });
      (_b = this.currentProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
        stderrBuffer += data.toString();
      });
      this.currentProcess.on("error", (error) => {
        this.currentProcess = null;
        reject(new Error(`Python process error: ${error.message}`));
      });
      this.currentProcess.on("close", (code) => {
        var _a2;
        this.currentProcess = null;
        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}: ${stderrBuffer}`));
          return;
        }
        try {
          const jsonContent = fs.readFileSync(tempOutputPath, "utf-8");
          const result = JSON.parse(jsonContent);
          fs.unlinkSync(tempOutputPath);
          (_a2 = options.onProgress) == null ? void 0 : _a2.call(options, 100, "Transcription complete");
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to read transcription result: ${error.message}`));
        }
      });
    });
  }
  /**
   * Cancel the current transcription process
   */
  cancel() {
    if (this.currentProcess) {
      this.currentProcess.kill("SIGTERM");
      this.currentProcess = null;
    }
  }
}
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
let mainWindow = null;
const pythonBridge = new PythonBridge();
const ffmpegBridge = new FFmpegBridge();
const fileManager = new FileManager();
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1e3,
    minHeight: 700,
    title: "TalkingCut",
    backgroundColor: "#09090b",
    // zinc-950
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
      // Required for preload to access node modules path resolution
    },
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function setupIpcHandlers() {
  ipcMain.handle("dialog:openVideo", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "Video Files", extensions: ["mp4", "mov", "mkv", "avi", "webm"] }
      ]
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("dialog:saveVideo", async () => {
    const result = await dialog.showSaveDialog({
      filters: [
        { name: "MP4 Video", extensions: ["mp4"] }
      ]
    });
    return result.canceled ? null : result.filePath;
  });
  ipcMain.handle("transcribe:start", async (event, videoPath, options) => {
    try {
      const audioPath = await ffmpegBridge.extractAudio(videoPath, (progress) => {
        event.sender.send("transcribe:progress", {
          step: "extracting",
          progress,
          message: "Extracting audio..."
        });
      });
      const result = await pythonBridge.transcribe(audioPath, {
        model: (options == null ? void 0 : options.model) || "base",
        language: options == null ? void 0 : options.language,
        onProgress: (progress, message) => {
          event.sender.send("transcribe:progress", {
            step: "transcribing",
            progress,
            message
          });
        }
      });
      return { success: true, segments: result.segments };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("transcribe:cancel", () => {
    pythonBridge.cancel();
    return { success: true };
  });
  ipcMain.handle("export:start", async (event, params) => {
    try {
      await ffmpegBridge.executeCommand(params.ffmpegCommand, (progress) => {
        event.sender.send("export:progress", {
          step: "exporting",
          progress,
          message: `Exporting... ${Math.round(progress)}%`
        });
      });
      return { success: true, outputPath: params.outputPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("project:save", async (_event, projectData, filePath) => {
    try {
      const savePath = filePath || await dialog.showSaveDialog({
        filters: [{ name: "TalkingCut Project", extensions: ["tcproj"] }]
      }).then((r) => r.filePath);
      if (!savePath) return { success: false, error: "Cancelled" };
      await fileManager.saveProject(savePath, projectData);
      return { success: true, path: savePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("project:load", async () => {
    try {
      const result = await dialog.showOpenDialog({
        filters: [{ name: "TalkingCut Project", extensions: ["tcproj"] }]
      });
      if (result.canceled) return { success: false, error: "Cancelled" };
      const data = await fileManager.loadProject(result.filePaths[0]);
      return { success: true, data, path: result.filePaths[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("temp:getWorkspace", () => {
    return fileManager.getWorkspacePath();
  });
  ipcMain.handle("temp:cleanup", async () => {
    await fileManager.cleanupWorkspace();
    return { success: true };
  });
}
app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("will-quit", async () => {
  await fileManager.cleanupWorkspace();
});
