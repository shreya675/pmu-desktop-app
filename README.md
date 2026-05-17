# PMU Desktop App

A desktop-based PMU simulator built using Electron and Node.js for testing IEEE C37.118 communication with a PDC. The application allows users to configure PMU settings, stream simulated data, monitor runtime activity, and test different signal conditions.

---
## Authors
- Aayushi Jindal  
- Shreya Jaiswal  

## Guide
- Dr. Bibhu Prasad Padhy
---

# Features

- IEEE C37.118 style PMU simulation
- Configurable Device ID and port
- PDC IP access control
- Real-time streaming
- Multiple simulation modes
- Runtime status and event logging
- Persistent configuration storage

---

# Download

Download the latest Windows release from:

https://github.com/shreya675/pmu-desktop-app/releases

---

# Run From Source

```bash
npm install
npm start
```

---

# Build the Application

```bash
npm run package
```

Packaged files will be generated inside:

```text
dist/
```

---

# Basic Usage

1. Open the application
2. Configure:
   - PMU Name
   - Device ID
   - Listening Port
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
| Save Settings | Saves configuration |
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

---

# Technologies Used

- Electron
- Node.js
- HTML/CSS/JavaScript
- TCP Networking

---

# License

This project is licensed under the GNU GPL v3.0 License.
