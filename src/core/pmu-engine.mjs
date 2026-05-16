import net from "node:net";
import {
  buildConfigFrame,
  buildDataFrame,
  buildHeaderFrame,
  getCommandName,
  inspectCommandFrame,
  shouldSendConfig,
  shouldSendHeader,
  shouldStop,
  shouldStream
} from "./protocol.mjs";

export class PmuEngine {
  constructor() {
    this.server = null;
    this.clients = new Map();
    this.currentConfig = null;
    this.frameTimer = null;
    this.sampleIndex = 0;
    this.listeners = new Set();
    this.status = {
      running: false,
      deviceId: null,
      listeningPort: null,
      allowedPdcIp: null,
      allowedPdcIps: [],
      connectedClientIp: null,
      connectedClientIps: [],
      streamActive: false,
      lastEvent: "PMU engine is idle."
    };
  }

  onStatusChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emitStatus() {
    for (const listener of this.listeners) {
      listener(this.getStatus());
    }
  }

  setStatus(patch) {
    this.status = { ...this.status, ...patch };
    this.emitStatus();
  }

  getStatus() {
    return { ...this.status };
  }

  isRunning() {
    return Boolean(this.server);
  }

  async start(config) {
    await this.stop();
    this.currentConfig = config;
    this.sampleIndex = 0;
    this.clients.clear();
    const allowedIps = new Set(config.pdcIps || [config.allowedPdcIp].filter(Boolean));

    this.server = net.createServer((socket) => {
      const remoteIp = socket.remoteAddress?.replace("::ffff:", "") || socket.remoteAddress || "unknown";
      if (!allowedIps.has(remoteIp)) {
        socket.destroy();
        this.setStatus({
          lastEvent: `Rejected connection from ${remoteIp}. Allowed PDC IPs are ${[...allowedIps].join(", ")}.`
        });
        return;
      }

      this.clients.set(socket, {
        ip: remoteIp,
        commandBuffer: Buffer.alloc(0),
        streaming: false
      });
      socket.write(buildConfigFrame(this.getEffectiveConfig()));
      this.refreshConnectionStatus(`Accepted PDC IP ${remoteIp}. Sent CFG2 and waiting for commands for PMU ID ${config.pmuId}.`);

      socket.on("data", (chunk) => {
        this.processCommandChunk(socket, chunk, remoteIp);
      });

      socket.on("error", (error) => {
        this.setStatus({
          lastEvent: `Socket error for ${remoteIp}: ${error.message}`
        });
      });

      socket.on("close", () => {
        this.clients.delete(socket);
        if (!this.hasStreamingClients()) {
          this.stopStreaming();
        }
        this.refreshConnectionStatus(socket.rejectReason || `PDC ${remoteIp} disconnected. PMU is waiting for allowed connections.`);
      });
    });

    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(config.listenPort, "0.0.0.0", () => {
        this.server.off("error", reject);
        resolve();
      });
    });

    this.setStatus({
      running: true,
      deviceId: config.pmuId,
      listeningPort: config.listenPort,
      allowedPdcIp: config.allowedPdcIp,
      allowedPdcIps: [...allowedIps],
      connectedClientIp: null,
      connectedClientIps: [],
      streamActive: false,
      lastEvent: `PMU started on port ${config.listenPort}; accepting PDC IPs ${[...allowedIps].join(", ")}.`
    });
  }

  processCommandChunk(socket, chunk, remoteIp) {
    const clientState = this.clients.get(socket);
    if (!clientState) {
      return;
    }

    clientState.commandBuffer = Buffer.concat([clientState.commandBuffer, chunk]);

    while (clientState.commandBuffer.length >= 4) {
      if (clientState.commandBuffer[0] !== 0xaa) {
        const nextSync = clientState.commandBuffer.indexOf(0xaa, 1);
        clientState.commandBuffer = nextSync === -1 ? Buffer.alloc(0) : clientState.commandBuffer.subarray(nextSync);
        continue;
      }

      const frameSize = clientState.commandBuffer.readUInt16BE(2);
      if (frameSize < 18 || frameSize > 65535) {
        this.setStatus({
          lastEvent: `Ignored malformed command frame from ${remoteIp}.`
        });
        clientState.commandBuffer = clientState.commandBuffer.subarray(1);
        continue;
      }

      if (clientState.commandBuffer.length < frameSize) {
        break;
      }

      const frameBuffer = clientState.commandBuffer.subarray(0, frameSize);
      clientState.commandBuffer = clientState.commandBuffer.subarray(frameSize);

      const frame = inspectCommandFrame(frameBuffer, this.currentConfig?.pmuId ?? 0);
      if (!frame.ok) {
        this.setStatus({
          lastEvent: `Ignored command from ${remoteIp}: ${frame.error}`
        });
        continue;
      }

      if (!frame.pmuIdMatches) {
        socket.rejectReason = `Rejected PDC command from ${remoteIp}: device ID ${frame.pmuId} does not match PMU device ID ${this.currentConfig.pmuId}.`;
        this.setStatus({
          lastEvent: socket.rejectReason
        });
        socket.destroy();
        return;
      }

      this.setStatus({
        connectedClientIps: this.getConnectedClientIps(),
        connectedClientIp: this.getConnectedClientIps().join(", ") || null,
        lastEvent: `Received ${frame.commandName} from ${remoteIp}.`
      });

      if (shouldSendHeader(frame.command)) {
        socket.write(buildHeaderFrame(this.getEffectiveConfig()));
        this.setStatus({
          lastEvent: `Sent header frame to ${remoteIp} for PMU ID ${this.getEffectiveConfig().pmuId}.`
        });
      }

      if (shouldSendConfig(frame.command)) {
        socket.write(buildConfigFrame(this.getEffectiveConfig()));
        this.setStatus({
          lastEvent: `Sent CFG2 to ${remoteIp} for PMU ID ${this.getEffectiveConfig().pmuId} after ${getCommandName(frame.command)}.`
        });
      }

      if (shouldStream(frame.command)) {
        clientState.streaming = true;
        this.startStreaming();
        this.setStatus({
          streamActive: true,
          lastEvent: `Streaming enabled for ${remoteIp} after ${getCommandName(frame.command)}.`
        });
      }

      if (shouldStop(frame.command)) {
        clientState.streaming = false;
        if (!this.hasStreamingClients()) {
          this.stopStreaming();
        }
        this.setStatus({
          streamActive: this.hasStreamingClients(),
          lastEvent: `Streaming stopped by ${remoteIp}.`
        });
      }
    }
  }

  startStreaming() {
    if (this.frameTimer || !this.currentConfig || !this.hasStreamingClients()) {
      return;
    }

    const intervalMs = Math.max(1, Math.floor(1000 / Math.max(1, this.currentConfig.dataRate)));
    this.frameTimer = setInterval(() => {
      if (!this.currentConfig || !this.hasStreamingClients()) {
        this.stopStreaming();
        return;
      }
      this.sampleIndex += 1;
      const frame = buildDataFrame(this.getEffectiveConfig(), this.sampleIndex);
      for (const [socket, clientState] of this.clients) {
        if (clientState.streaming && !socket.destroyed) {
          socket.write(frame);
        }
      }
    }, intervalMs);
  }

  getConnectedClientIps() {
    return [...new Set([...this.clients.values()].map((clientState) => clientState.ip))];
  }

  hasStreamingClients() {
    return [...this.clients.entries()].some(([socket, clientState]) => clientState.streaming && !socket.destroyed);
  }

  refreshConnectionStatus(lastEvent) {
    const connectedClientIps = this.getConnectedClientIps();
    this.setStatus({
      connectedClientIps,
      connectedClientIp: connectedClientIps.join(", ") || null,
      streamActive: this.hasStreamingClients(),
      lastEvent
    });
  }

  getEffectiveConfig() {
    if (!this.currentConfig) {
      return null;
    }

    return {
      ...this.currentConfig,
      pmuId: this.currentConfig.pmuId
    };
  }

  stopStreaming() {
    if (this.frameTimer) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
  }

  async restart(config) {
    await this.start(config);
  }

  updateConfig(config) {
    if (!this.currentConfig) {
      this.currentConfig = config;
      return;
    }

    this.currentConfig = {
      ...this.currentConfig,
      ...config,
      pmuId: this.currentConfig.pmuId,
      listenPort: this.currentConfig.listenPort,
      allowedPdcIp: this.currentConfig.allowedPdcIp,
      pdcIps: this.currentConfig.pdcIps
    };

    this.setStatus({
      lastEvent: `Simulation mode changed to ${config.simulationMode || "normal"}.`
    });
  }

  async stop() {
    this.stopStreaming();
    for (const socket of this.clients.keys()) {
      if (!socket.destroyed) {
        socket.destroy();
      }
    }
    this.clients.clear();

    if (this.server) {
      const serverToClose = this.server;
      this.server = null;
      await new Promise((resolve) => serverToClose.close(() => resolve()));
    }

    this.setStatus({
      running: false,
      deviceId: null,
      listeningPort: null,
      allowedPdcIp: null,
      allowedPdcIps: [],
      connectedClientIp: null,
      connectedClientIps: [],
      streamActive: false,
      lastEvent: "PMU engine stopped."
    });
  }
}
