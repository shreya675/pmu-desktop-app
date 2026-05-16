const SYNC_DATA = 0xaa;
const TYPE_DATA = 0x01;
const TYPE_HDR = 0x11;
const SYNC_CFG2 = 0xaa;
const TYPE_CFG2 = 0x31;
const SYNC_CMD = 0xaa;
const TYPE_CMD = 0x41;

const CMD_TURN_OFF_TX = 0x0001;
const CMD_TURN_ON_TX = 0x0002;
const CMD_SEND_HDR = 0x0003;
const CMD_SEND_CFG1 = 0x0004;
const CMD_SEND_CFG2 = 0x0005;
const CMD_SEND_CFG3 = 0x0006;
const TIME_BASE = 1_000_000;
const FIXED_PHASOR_COUNT = 3;
const FIXED_ANALOG_COUNT = 4;
const FIXED_DIGITAL_COUNT = 0;
const USE_FLOAT_FORMAT = true;
const USE_POLAR_FORMAT = true;

const CHANNEL_GROUPS = {
  Va: { label: "Va", base: 230, type: "voltage", angle: 0 },
  Vb: { label: "Vb", base: 230, type: "voltage", angle: -120 },
  Vc: { label: "Vc", base: 230, type: "voltage", angle: 120 },
  Ia: { label: "Ia", base: 10, type: "current", angle: -5 },
  Ib: { label: "Ib", base: 10, type: "current", angle: -125 },
  Ic: { label: "Ic", base: 10, type: "current", angle: 115 }
};

const FALLBACK_CHANNELS = ["Va", "Vb", "Vc"];
const SIMULATION_PROFILES = {
  normal: {
    voltageScale: 1,
    currentScale: 1,
    angleShift: 0,
    frequencyOffset: 0,
    rocofOffset: 0,
    noiseScale: 0,
    analogOffset: 0
  },
  voltageSag: {
    voltageScale: 0.72,
    currentScale: 1.35,
    angleShift: -4,
    frequencyOffset: -0.04,
    rocofOffset: -0.18,
    noiseScale: 0.2,
    analogOffset: 0.8
  },
  currentSpike: {
    voltageScale: 0.96,
    currentScale: 4,
    angleShift: -8,
    frequencyOffset: -0.02,
    rocofOffset: -0.08,
    noiseScale: 0.25,
    analogOffset: 2.5
  },
  frequencyDrop: {
    voltageScale: 0.94,
    currentScale: 1.22,
    angleShift: -5,
    frequencyOffset: -1.2,
    rocofOffset: -0.7,
    noiseScale: 0.18,
    analogOffset: 0.7
  },
  phaseShift: {
    voltageScale: 1,
    currentScale: 1,
    angleShift: 25,
    angleOffsets: {
      Va: 18,
      Vb: -12,
      Vc: 7,
      Ia: 28,
      Ib: -18,
      Ic: 12
    },
    frequencyOffset: 0.01,
    rocofOffset: 0.06,
    noiseScale: 0.08,
    analogOffset: 0
  },
  noisySignal: {
    voltageScale: 1,
    currentScale: 1,
    angleShift: 0,
    frequencyOffset: 0,
    rocofOffset: 0,
    noiseScale: 1,
    analogOffset: 0
  }
};

function appendUInt16BE(chunks, value) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16BE(value);
  chunks.push(buf);
}

function appendUInt32BE(chunks, value) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value);
  chunks.push(buf);
}

function appendFloat32BE(chunks, value) {
  const buf = Buffer.alloc(4);
  buf.writeFloatBE(value);
  chunks.push(buf);
}

function appendAscii(chunks, value, length) {
  const padded = String(value).slice(0, length).padEnd(length, " ");
  chunks.push(Buffer.from(padded, "ascii"));
}

export function calculateCrc(buffer) {
  let crc = 0xffff;
  for (const byte of buffer) {
    crc ^= byte << 8;
    for (let index = 0; index < 8; index += 1) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc;
}

export function inspectCommandFrame(buffer, expectedPmuId) {
  if (buffer.length < 18 || buffer[0] !== SYNC_CMD || buffer[1] !== TYPE_CMD) {
    return { ok: false, error: "Command frame sync/type is invalid." };
  }

  const frameSize = buffer.readUInt16BE(2);
  if (frameSize > buffer.length || frameSize < 18) {
    return { ok: false, error: "Command frame size is invalid or incomplete." };
  }

  const pmuId = buffer.readUInt16BE(4);
  const pmuIdMatches = pmuId === expectedPmuId;

  const expectedCrc = buffer.readUInt16BE(frameSize - 2);
  const actualCrc = calculateCrc(buffer.subarray(0, frameSize - 2));
  if (expectedCrc !== actualCrc) {
    return { ok: false, error: "Command frame CRC validation failed." };
  }

  const command = buffer.readUInt16BE(14);
  return {
    ok: true,
    pmuId,
    pmuIdMatches,
    command,
    commandName: getCommandName(command),
    frameSize
  };
}

export function parseCommandFrame(buffer, expectedPmuId) {
  const inspected = inspectCommandFrame(buffer, expectedPmuId);
  return inspected.ok ? { command: inspected.command } : null;
}

export function shouldStop(command) {
  return command === CMD_TURN_OFF_TX;
}

export function shouldSendConfig(command) {
  return command === CMD_SEND_CFG1 || command === CMD_SEND_CFG2 || command === CMD_SEND_CFG3;
}

export function shouldSendHeader(command) {
  return command === CMD_SEND_HDR;
}

export function shouldStream(command) {
  return command === CMD_TURN_ON_TX;
}

export function getCommandName(command) {
  if (command === CMD_TURN_OFF_TX) {
    return "TURN_OFF_TX";
  }
  if (command === CMD_TURN_ON_TX) {
    return "TURN_ON_TX";
  }
  if (command === CMD_SEND_HDR) {
    return "SEND_HDR";
  }
  if (command === CMD_SEND_CFG1) {
    return "SEND_CFG1";
  }
  if (command === CMD_SEND_CFG2) {
    return "SEND_CFG2";
  }
  if (command === CMD_SEND_CFG3) {
    return "SEND_CFG3";
  }
  return `UNKNOWN_0x${command.toString(16).padStart(4, "0")}`;
}

function normalizeStationName(value, pmuId) {
  const fallback = `SIM_PMU_${pmuId}`;
  return String(value || fallback).slice(0, 16).padEnd(16, " ");
}

export function buildHeaderFrame(config) {
  const chunks = [];
  const text = `${String(config.pmuName || "PMU").slice(0, 16)} simulated PMU, IEEE C37.118 command channel`;

  chunks.push(Buffer.from([SYNC_DATA, TYPE_HDR]));
  appendUInt16BE(chunks, 0);
  appendUInt16BE(chunks, config.pmuId);
  appendUInt32BE(chunks, Math.floor(Date.now() / 1000));
  appendUInt32BE(chunks, 0);
  chunks.push(Buffer.from(text, "ascii"));

  const withoutCrc = Buffer.concat(chunks);
  withoutCrc.writeUInt16BE(withoutCrc.length + 2, 2);
  const crcBuf = Buffer.alloc(2);
  crcBuf.writeUInt16BE(calculateCrc(withoutCrc));
  return Buffer.concat([withoutCrc, crcBuf]);
}

function getCompatiblePhasorChannels(config) {
  const selected = Array.isArray(config?.channels?.phasors)
    ? config.channels.phasors.filter((channel) => CHANNEL_GROUPS[channel])
    : [];

  const combined = [...selected];
  for (const fallback of FALLBACK_CHANNELS) {
    if (!combined.includes(fallback)) {
      combined.push(fallback);
    }
  }

  return combined.slice(0, FIXED_PHASOR_COUNT);
}

export function buildConfigFrame(config) {
  const chunks = [];
  const phasorChannels = getCompatiblePhasorChannels(config);
  const stationName = normalizeStationName(config.pmuName, config.pmuId);
  const format =
    (USE_FLOAT_FORMAT ? (1 << 0) : 0) |
    (USE_POLAR_FORMAT ? (1 << 1) : 0) |
    (USE_FLOAT_FORMAT ? (1 << 2) : 0) |
    (USE_FLOAT_FORMAT ? (1 << 3) : 0) |
    (USE_FLOAT_FORMAT ? (1 << 4) : 0);

  chunks.push(Buffer.from([SYNC_CFG2, TYPE_CFG2]));
  appendUInt16BE(chunks, 0);
  appendUInt16BE(chunks, config.pmuId);
  appendUInt32BE(chunks, Math.floor(Date.now() / 1000));
  appendUInt32BE(chunks, 0);
  appendUInt32BE(chunks, TIME_BASE);
  appendUInt16BE(chunks, 1);
  appendAscii(chunks, stationName, 16);
  appendUInt16BE(chunks, config.pmuId);
  appendUInt16BE(chunks, format);
  appendUInt16BE(chunks, FIXED_PHASOR_COUNT);
  appendUInt16BE(chunks, FIXED_ANALOG_COUNT);
  appendUInt16BE(chunks, FIXED_DIGITAL_COUNT);

  for (let index = 0; index < FIXED_PHASOR_COUNT; index += 1) {
    appendAscii(chunks, `Phasor ${index + 1}`, 16);
  }

  for (let index = 0; index < FIXED_ANALOG_COUNT; index += 1) {
    appendAscii(chunks, `Analog ${index + 1}`, 16);
  }

  for (let index = 0; index < FIXED_PHASOR_COUNT; index += 1) {
    appendUInt32BE(chunks, index === 0 ? 0x00000001 : 0x01000001);
  }

  for (let index = 0; index < FIXED_ANALOG_COUNT; index += 1) {
    appendUInt32BE(chunks, 0x00000064);
  }

  appendUInt16BE(chunks, 1);
  appendUInt16BE(chunks, 0);
  appendUInt16BE(chunks, config.dataRate);

  const withoutCrc = Buffer.concat(chunks);
  withoutCrc.writeUInt16BE(withoutCrc.length + 2, 2);
  const crcBuf = Buffer.alloc(2);
  crcBuf.writeUInt16BE(calculateCrc(withoutCrc));
  return Buffer.concat([withoutCrc, crcBuf]);
}

function getSimulationProfile(config) {
  return SIMULATION_PROFILES[config?.simulationMode] || SIMULATION_PROFILES.normal;
}

function generatePhasorValue(channel, timeIndex, simulationProfile) {
  const profile = CHANNEL_GROUPS[channel];
  if (!profile) {
    return null;
  }

  const scale = profile.type === "voltage"
    ? simulationProfile.voltageScale
    : simulationProfile.currentScale;
  const normalSwing = profile.type === "voltage" ? 4 : 0.8;
  const noise = Math.sin(timeIndex * 3.7 + profile.angle) * simulationProfile.noiseScale * normalSwing;
  const magnitude = (profile.base * scale) + Math.sin(timeIndex + profile.angle / 180) * normalSwing + noise;
  const angleRad = (
    profile.angle +
    simulationProfile.angleShift +
    (simulationProfile.angleOffsets?.[channel] ?? 0) +
    Math.sin(timeIndex * 0.4) * 3 +
    Math.cos(timeIndex * 2.1) * simulationProfile.noiseScale
  ) * Math.PI / 180;
  return { magnitude, angleRad };
}

export function buildDataFrame(config, sampleIndex) {
  const chunks = [];
  const simulationProfile = getSimulationProfile(config);
  const selectedPhasors = getCompatiblePhasorChannels(config)
    .map((channel) => generatePhasorValue(channel, sampleIndex / 6, simulationProfile))
    .filter(Boolean);

  chunks.push(Buffer.from([SYNC_DATA, TYPE_DATA]));
  appendUInt16BE(chunks, 0);
  appendUInt16BE(chunks, config.pmuId);
  appendUInt32BE(chunks, Math.floor(Date.now() / 1000));
  appendUInt32BE(chunks, (Date.now() % 1000) * 1000);
  appendUInt16BE(chunks, 0x0000);

  for (const phasor of selectedPhasors) {
    appendFloat32BE(chunks, phasor.magnitude);
    appendFloat32BE(chunks, phasor.angleRad);
  }

  while (selectedPhasors.length < FIXED_PHASOR_COUNT) {
    appendFloat32BE(chunks, 230);
    appendFloat32BE(chunks, 0);
    selectedPhasors.push({ magnitude: 230, angleRad: 0 });
  }

  const frequency = 50 + simulationProfile.frequencyOffset + Math.sin(sampleIndex / 10) * (0.03 + simulationProfile.noiseScale * 0.02);
  const rocof = simulationProfile.rocofOffset + Math.cos(sampleIndex / 14) * (0.12 + simulationProfile.noiseScale * 0.04);

  appendFloat32BE(chunks, config.channels.frequency ? frequency : 0);
  appendFloat32BE(chunks, config.channels.rocof ? rocof : 0);

  for (let index = 0; index < FIXED_ANALOG_COUNT; index += 1) {
    const analogNoise = Math.cos((sampleIndex + index) / 3) * simulationProfile.noiseScale;
    const analogValue = 5 + simulationProfile.analogOffset + Math.sin((sampleIndex + index * 2) / 8) * 3 + analogNoise;
    appendFloat32BE(chunks, analogValue);
  }

  const withoutCrc = Buffer.concat(chunks);
  withoutCrc.writeUInt16BE(withoutCrc.length + 2, 2);
  const crcBuf = Buffer.alloc(2);
  crcBuf.writeUInt16BE(calculateCrc(withoutCrc));
  return Buffer.concat([withoutCrc, crcBuf]);
}
