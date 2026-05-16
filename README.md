# PMU Desktop App

A desktop-based PMU simulator built using Electron and Node.js for testing IEEE C37.118 communication with a PDC. The app allows users to configure PMU settings, control streaming, monitor runtime activity, and simulate different signal conditions.

---

# Features

- PMU simulation over TCP
- Configurable Device ID and port
- PDC IP access control
- Real-time streaming
- Multiple signal simulation modes
- Runtime status and event logging
- Persistent configuration storage

---

# Run the Application

## From Source

```bash
npm install
npm start
```

## Build Windows Application

```bash
npm run package
```

Packaged files will be generated inside:

```text
dist/win-unpacked/
```

---

# Basic Usage

1. Open the app
2. Configure:
   - PMU Name
   - Device ID
   - Port
   - Allowed PDC IPs
3. Select streaming channels and data rate
4. Click **Start PMU**
5. Connect the PDC using the same Device ID and port

For local testing:

| Parameter | Value |
|---|---|
| PDC IP | `127.0.0.1` |
| Port | `4712` |
| Device ID | `1` |

---

# Configuration Buttons

| Button | Function |
|---|---|
| Save Settings | Saves configuration only |
| Start PMU | Starts the PMU |
| Apply Changes | Applies changes while running |
| Stop PMU | Stops the PMU |

---

# Simulation Modes

- Normal
- Voltage Sag
- Current Spike
- Frequency Drop
- Phase Shift
- Noisy Signal

---

# Common Issues

## PDC Cannot Connect
- Check IP and port
- Ensure PMU is running
- Verify PDC IP is allowed

## Device ID Mismatch
- PMU and PDC Device IDs must match

## Settings Not Applying
- Use **Apply Changes** if PMU is already running

---

# Project Structure

```text
electron/
src/
package.json
README.md
```

Main source files:

```text
electron/main.mjs
src/core/pmu-engine.mjs
src/core/protocol.mjs
src/ui/app.mjs
```

---

# Technologies Used

- Electron
- Node.js
- HTML/CSS/JavaScript
- TCP Networking
```
