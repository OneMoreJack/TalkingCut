import { contextBridge, ipcRenderer } from "electron";
const electronAPI = {
  // ----- File Dialogs -----
  openVideoDialog: () => ipcRenderer.invoke("dialog:openVideo"),
  saveVideoDialog: () => ipcRenderer.invoke("dialog:saveVideo"),
  // ----- Transcription -----
  transcribe: {
    start: (videoPath, options) => ipcRenderer.invoke("transcribe:start", videoPath, options),
    cancel: () => ipcRenderer.invoke("transcribe:cancel"),
    onProgress: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("transcribe:progress", handler);
      return () => ipcRenderer.removeListener("transcribe:progress", handler);
    }
  },
  // ----- Export -----
  export: {
    start: (params) => ipcRenderer.invoke("export:start", params),
    onProgress: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("export:progress", handler);
      return () => ipcRenderer.removeListener("export:progress", handler);
    }
  },
  // ----- Project Management -----
  project: {
    save: (data, filePath) => ipcRenderer.invoke("project:save", data, filePath),
    load: () => ipcRenderer.invoke("project:load")
  },
  // ----- Temp Files -----
  temp: {
    getWorkspace: () => ipcRenderer.invoke("temp:getWorkspace"),
    cleanup: () => ipcRenderer.invoke("temp:cleanup")
  }
};
contextBridge.exposeInMainWorld("electronAPI", electronAPI);
