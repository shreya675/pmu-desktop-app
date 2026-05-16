import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConfigStore } from "../src/core/config-store.mjs";
import { PmuEngine } from "../src/core/pmu-engine.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configStore = new ConfigStore(app);
const pmuEngine = new PmuEngine();

let mainWindow = null;

async function publishStatus() {
  if (!mainWindow) {
    return;
  }

  mainWindow.webContents.send("pmu:status", {
    config: await configStore.load(),
    runtime: pmuEngine.getStatus()
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1260,
    height: 920,
    minWidth: 1080,
    minHeight: 760,
    backgroundColor: "#081420",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../src/ui/index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  createWindow();

  pmuEngine.onStatusChange(async () => {
    await publishStatus();
  });

  ipcMain.handle("pmu:get-state", async () => ({
    config: await configStore.load(),
    runtime: pmuEngine.getStatus()
  }));

  ipcMain.handle("pmu:save-config", async (_event, nextConfig) => {
    const saved = await configStore.save(nextConfig);
    await publishStatus();
    return saved;
  });

  ipcMain.handle("pmu:start", async (_event, nextConfig) => {
    const saved = await configStore.save(nextConfig);
    try {
      await pmuEngine.start(saved);
      await publishStatus();
      return {
        config: saved,
        runtime: pmuEngine.getStatus()
      };
    } catch (error) {
      pmuEngine.setStatus({
        lastEvent: `Start failed: ${error.message}`
      });
      await publishStatus();
      throw error;
    }
  });

  ipcMain.handle("pmu:stop", async () => {
    await pmuEngine.stop();
    await publishStatus();
    return {
      config: await configStore.load(),
      runtime: pmuEngine.getStatus()
    };
  });

  ipcMain.handle("pmu:apply", async (_event, nextConfig) => {
    const saved = await configStore.save(nextConfig);
    try {
      if (pmuEngine.isRunning()) {
        await pmuEngine.restart(saved);
      }
      await publishStatus();
      return {
        config: saved,
        runtime: pmuEngine.getStatus()
      };
    } catch (error) {
      pmuEngine.setStatus({
        lastEvent: `Apply failed: ${error.message}`
      });
      await publishStatus();
      throw error;
    }
  });

  ipcMain.handle("pmu:set-simulation-mode", async (_event, simulationMode) => {
    const current = await configStore.load();
    const saved = await configStore.save({
      ...current,
      simulationMode
    });

    if (pmuEngine.isRunning()) {
      pmuEngine.updateConfig(saved);
    }

    await publishStatus();
    return {
      config: saved,
      runtime: pmuEngine.getStatus()
    };
  });

  await publishStatus();
});

app.on("window-all-closed", async () => {
  await pmuEngine.stop();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
