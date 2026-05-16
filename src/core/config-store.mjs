import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONFIG = {
  pmuName: "PMU_A",
  pmuId: 1,
  listenPort: 4712,
  allowedPdcIp: "127.0.0.1",
  pdcIps: ["127.0.0.1"],
  dataRate: 50,
  simulationMode: "normal",
  channels: {
    phasors: ["Va", "Vb", "Vc", "Ia", "Ib", "Ic"],
    frequency: true,
    rocof: true
  }
};

const SIMULATION_MODES = new Set([
  "normal",
  "voltageSag",
  "currentSpike",
  "frequencyDrop",
  "phaseShift",
  "noisySignal"
]);

function normalizeUInt16(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(65535, Math.max(1, parsed));
}

function normalizePdcIps(input) {
  const rawIps = Array.isArray(input.pdcIps)
    ? input.pdcIps
    : [input.allowedPdcIp];
  const normalized = rawIps
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(normalized.length ? normalized : DEFAULT_CONFIG.pdcIps)];
}

export class ConfigStore {
  constructor(electronApp) {
    this.electronApp = electronApp;
  }

  getConfigPath() {
    return path.join(this.electronApp.getPath("userData"), "pmu-config.json");
  }

  normalize(input = {}) {
    const listenPort = normalizeUInt16(input.listenPort, DEFAULT_CONFIG.listenPort);
    const pdcIps = normalizePdcIps(input);

    return {
      pmuName: typeof input.pmuName === "string" && input.pmuName.trim()
        ? input.pmuName.trim()
        : DEFAULT_CONFIG.pmuName,
      pmuId: normalizeUInt16(input.pmuId, DEFAULT_CONFIG.pmuId),
      listenPort,
      allowedPdcIp: pdcIps[0],
      pdcIps,
      dataRate: Number.isFinite(Number.parseInt(input.dataRate, 10))
        ? Number.parseInt(input.dataRate, 10)
        : DEFAULT_CONFIG.dataRate,
      simulationMode: SIMULATION_MODES.has(input.simulationMode)
        ? input.simulationMode
        : DEFAULT_CONFIG.simulationMode,
      channels: {
        phasors: Array.isArray(input?.channels?.phasors) && input.channels.phasors.length
          ? [...new Set(input.channels.phasors)]
          : DEFAULT_CONFIG.channels.phasors,
        frequency: input?.channels?.frequency !== false,
        rocof: input?.channels?.rocof !== false
      }
    };
  }

  async load() {
    const configPath = this.getConfigPath();
    try {
      const file = await readFile(configPath, "utf8");
      return this.normalize(JSON.parse(file));
    } catch {
      return this.save(DEFAULT_CONFIG);
    }
  }

  async save(input) {
    const normalized = this.normalize(input);
    const configPath = this.getConfigPath();
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, JSON.stringify(normalized, null, 2), "utf8");
    return normalized;
  }
}
