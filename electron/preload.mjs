import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("pmuDesktop", {
  getState: () => ipcRenderer.invoke("pmu:get-state"),
  saveConfig: (config) => ipcRenderer.invoke("pmu:save-config", config),
  start: (config) => ipcRenderer.invoke("pmu:start", config),
  stop: () => ipcRenderer.invoke("pmu:stop"),
  apply: (config) => ipcRenderer.invoke("pmu:apply", config),
  setSimulationMode: (mode) => ipcRenderer.invoke("pmu:set-simulation-mode", mode),
  onStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("pmu:status", handler);
    return () => ipcRenderer.removeListener("pmu:status", handler);
  }
});
