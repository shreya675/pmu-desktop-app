const elements = {
  pmuName: document.querySelector("#pmuName"),
  pmuId: document.querySelector("#pmuId"),
  listenPort: document.querySelector("#listenPort"),
  pdcIpList: document.querySelector("#pdcIpList"),
  addPdcIpBtn: document.querySelector("#addPdcIpBtn"),
  dataRate: document.querySelector("#dataRate"),
  frequency: document.querySelector("#frequency"),
  rocof: document.querySelector("#rocof"),
  statusBadge: document.querySelector("#statusBadge"),
  statusMeta: document.querySelector("#statusMeta"),
  errorBanner: document.querySelector("#errorBanner"),
  engineState: document.querySelector("#engineState"),
  engineDeviceId: document.querySelector("#engineDeviceId"),
  enginePort: document.querySelector("#enginePort"),
  engineAllowedIp: document.querySelector("#engineAllowedIp"),
  engineClientIp: document.querySelector("#engineClientIp"),
  saveBtn: document.querySelector("#saveBtn"),
  startBtn: document.querySelector("#startBtn"),
  applyBtn: document.querySelector("#applyBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  eventLog: document.querySelector("#eventLog"),
  profileName: document.querySelector("#profileName"),
  summaryDeviceId: document.querySelector("#summaryDeviceId"),
  summaryRate: document.querySelector("#summaryRate"),
  summaryCount: document.querySelector("#summaryCount"),
  summaryPolicy: document.querySelector("#summaryPolicy"),
  channelSummary: document.querySelector("#channelSummary"),
  simulationButtons: [...document.querySelectorAll("[data-simulation-mode]")],
  phasorBoxes: [...document.querySelectorAll("input[data-phantype='phasor']")]
};

const eventHistory = [];
let currentSimulationMode = "normal";

const simulationLabels = {
  normal: "Normal",
  voltageSag: "Voltage Sag",
  currentSpike: "Current Spike",
  frequencyDrop: "Frequency Drop",
  phaseShift: "Phase Shift",
  noisySignal: "Noisy Signal"
};

function setBusy(button, busy, label) {
  button.disabled = busy;
  if (label) {
    button.textContent = label;
  }
}

function showError(message) {
  elements.errorBanner.textContent = message;
  elements.errorBanner.classList.remove("hidden");
  pushLog(message);
}

function clearError() {
  elements.errorBanner.textContent = "";
  elements.errorBanner.classList.add("hidden");
}

function getPdcIpInputs() {
  return [...elements.pdcIpList.querySelectorAll("input[data-pdc-ip]")];
}

function collectPdcIps() {
  const ips = getPdcIpInputs()
    .map((input) => input.value.trim())
    .filter(Boolean);
  return [...new Set(ips)];
}

function addPdcIpRow(value = "") {
  const row = document.createElement("div");
  row.className = "pdc-row";

  const label = document.createElement("label");
  label.textContent = "Allowed PDC IP";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "192.168.1.20";
  input.dataset.pdcIp = "true";
  input.value = value;
  input.addEventListener("input", renderConfigSnapshot);
  input.addEventListener("change", renderConfigSnapshot);

  label.append(input);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    if (getPdcIpInputs().length <= 1) {
      input.value = "";
    } else {
      row.remove();
    }
    renderConfigSnapshot();
  });

  row.append(label, removeButton);
  elements.pdcIpList.append(row);
}

function renderPdcIpRows(config) {
  elements.pdcIpList.replaceChildren();
  const ips = Array.isArray(config.pdcIps) && config.pdcIps.length
    ? config.pdcIps
    : [config.allowedPdcIp].filter(Boolean);

  (ips.length ? ips : [""]).forEach((ip) => addPdcIpRow(ip));
}

function collectConfig() {
  const pdcIps = collectPdcIps();
  return {
    pmuName: elements.pmuName.value,
    pmuId: elements.pmuId.value,
    listenPort: elements.listenPort.value,
    allowedPdcIp: pdcIps[0] || "",
    pdcIps,
    dataRate: elements.dataRate.value,
    simulationMode: currentSimulationMode,
    channels: {
      phasors: elements.phasorBoxes.filter((box) => box.checked).map((box) => box.value),
      frequency: elements.frequency.checked,
      rocof: elements.rocof.checked
    }
  };
}

function renderLog() {
  elements.eventLog.innerHTML = eventHistory.length
    ? eventHistory.map((entry) => `
        <div class="log-entry">
          <time>${entry.timestamp}</time>
          <div>${entry.message}</div>
        </div>
      `).join("")
    : `<div class="log-entry"><div>No events yet.</div></div>`;
}

function pushLog(message) {
  if (!message) {
    return;
  }

  const latest = eventHistory[0];
  if (latest?.message === message) {
    return;
  }

  eventHistory.unshift({
    timestamp: new Date().toLocaleTimeString(),
    message
  });

  if (eventHistory.length > 12) {
    eventHistory.length = 12;
  }
  renderLog();
}

function renderConfig(config) {
  currentSimulationMode = config.simulationMode || "normal";
  elements.pmuName.value = config.pmuName;
  elements.pmuId.value = config.pmuId;
  elements.listenPort.value = config.listenPort;
  renderPdcIpRows(config);
  elements.dataRate.value = String(config.dataRate);
  elements.frequency.checked = Boolean(config.channels.frequency);
  elements.rocof.checked = Boolean(config.channels.rocof);
  elements.phasorBoxes.forEach((box) => {
    box.checked = config.channels.phasors.includes(box.value);
  });
  renderSimulationMode(currentSimulationMode);
  renderConfigSnapshot(config);
}

function renderSimulationMode(mode) {
  currentSimulationMode = mode || "normal";
  elements.simulationButtons.forEach((button) => {
    const isActive = button.dataset.simulationMode === currentSimulationMode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderConfigSnapshot(config = collectConfig()) {
  const selectedChannels = [
    ...config.channels.phasors,
    ...(config.channels.frequency ? ["f"] : []),
    ...(config.channels.rocof ? ["df/dt"] : [])
  ];

  elements.profileName.textContent = config.pmuName || "Unnamed PMU";
  elements.summaryDeviceId.textContent = config.pmuId || "--";
  elements.summaryRate.textContent = `${config.dataRate || "--"} fps`;
  elements.summaryCount.textContent = `${selectedChannels.length} active`;
  const pdcIps = Array.isArray(config.pdcIps) ? config.pdcIps : collectPdcIps();
  elements.summaryPolicy.textContent = pdcIps.length ? `${pdcIps.length} PDC IP${pdcIps.length === 1 ? "" : "s"}` : "Restricted";
  elements.channelSummary.innerHTML = selectedChannels.length
    ? [
        `<span class="chip chip-mode">${simulationLabels[config.simulationMode || currentSimulationMode] || "Normal"}</span>`,
        ...selectedChannels.map((channel) => `<span class="chip">${channel}</span>`)
      ].join("")
    : `<span class="chip chip-muted">No channels selected</span>`;
}

function renderRuntime(runtime) {
  const badgeText = runtime.running ? (runtime.connectedClientIp ? "Connected" : "Listening") : "Stopped";
  const badgeClass = runtime.running ? (runtime.connectedClientIp ? "connected" : "running") : "stopped";
  const allowedPdcText = Array.isArray(runtime.allowedPdcIps) && runtime.allowedPdcIps.length
    ? runtime.allowedPdcIps.join(", ")
    : runtime.allowedPdcIp ?? "--";
  const connectedPdcText = Array.isArray(runtime.connectedClientIps) && runtime.connectedClientIps.length
    ? runtime.connectedClientIps.join(", ")
    : runtime.connectedClientIp ?? "--";
  const metaText = runtime.running && !runtime.connectedClientIp
    ? `PMU is listening on port ${runtime.listeningPort ?? "--"} and waiting for allowed PDC IPs ${allowedPdcText}.`
    : runtime.lastEvent;

  elements.statusBadge.textContent = badgeText;
  elements.statusBadge.className = `status-badge ${badgeClass}`;
  elements.statusMeta.textContent = metaText;
  elements.engineState.textContent = runtime.running ? "Running" : "Stopped";
  elements.engineDeviceId.textContent = runtime.deviceId ?? "--";
  elements.enginePort.textContent = runtime.listeningPort ?? "--";
  elements.engineAllowedIp.textContent = allowedPdcText;
  elements.engineClientIp.textContent = connectedPdcText;

  elements.startBtn.disabled = runtime.running;
  elements.stopBtn.disabled = !runtime.running;

  if (runtime.lastEvent?.toLowerCase().includes("failed")) {
    showError(runtime.lastEvent);
  } else {
    clearError();
  }
}

function renderState(payload) {
  renderConfig(payload.config);
  renderRuntime(payload.runtime);
  pushLog(payload.runtime?.lastEvent);
}

async function bootstrap() {
  if (!window.pmuDesktop) {
    showError("Desktop bridge failed to load. Please restart the app.");
    return;
  }

  const initialState = await window.pmuDesktop.getState();
  renderState(initialState);
  renderLog();

  window.pmuDesktop.onStatus((payload) => {
    renderState(payload);
  });
}

elements.saveBtn.addEventListener("click", async () => {
  setBusy(elements.saveBtn, true, "Saving...");
  try {
    const saved = await window.pmuDesktop.saveConfig(collectConfig());
    pushLog(`Saved configuration for ${saved.pmuName}.`);
  } catch (error) {
    showError(`Save failed: ${error.message}`);
  } finally {
    setBusy(elements.saveBtn, false, "Save Settings");
  }
});

elements.startBtn.addEventListener("click", async () => {
  setBusy(elements.startBtn, true, "Starting...");
  try {
    renderState(await window.pmuDesktop.start(collectConfig()));
  } catch (error) {
    showError(`Start failed: ${error.message}`);
  } finally {
    setBusy(elements.startBtn, false, "Start PMU");
  }
});

elements.stopBtn.addEventListener("click", async () => {
  setBusy(elements.stopBtn, true, "Stopping...");
  try {
    renderState(await window.pmuDesktop.stop());
  } catch (error) {
    showError(`Stop failed: ${error.message}`);
  } finally {
    setBusy(elements.stopBtn, false, "Stop PMU");
  }
});

elements.addPdcIpBtn.addEventListener("click", () => {
  addPdcIpRow();
  getPdcIpInputs().at(-1)?.focus();
  renderConfigSnapshot();
});

elements.applyBtn.addEventListener("click", async () => {
  setBusy(elements.applyBtn, true, "Applying...");
  try {
    renderState(await window.pmuDesktop.apply(collectConfig()));
  } catch (error) {
    showError(`Apply failed: ${error.message}`);
  } finally {
    setBusy(elements.applyBtn, false, "Apply Changes");
  }
});

elements.simulationButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const nextMode = button.dataset.simulationMode;
    if (!nextMode || nextMode === currentSimulationMode) {
      return;
    }

    const previousMode = currentSimulationMode;
    renderSimulationMode(nextMode);
    renderConfigSnapshot();
    elements.simulationButtons.forEach((item) => {
      item.disabled = true;
    });

    try {
      renderState(await window.pmuDesktop.setSimulationMode(nextMode));
      pushLog(`Simulation event: ${simulationLabels[nextMode] || nextMode}.`);
    } catch (error) {
      renderSimulationMode(previousMode);
      renderConfigSnapshot();
      showError(`Simulation change failed: ${error.message}`);
    } finally {
      elements.simulationButtons.forEach((item) => {
        item.disabled = false;
      });
    }
  });
});

[
  elements.pmuName,
  elements.pmuId,
  elements.listenPort,
  elements.dataRate,
  elements.frequency,
  elements.rocof,
  ...elements.phasorBoxes
].forEach((field) => {
  field.addEventListener("input", () => {
    renderConfigSnapshot();
  });
  field.addEventListener("change", () => {
    renderConfigSnapshot();
  });
});

bootstrap();
