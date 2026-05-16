# PMU Desktop App

A small desktop app for running a simulated PMU and testing it with a PDC. The app lets you set the PMU identity, port, allowed PDC IPs, data rate, channels, and simulation mode.

## How to Open It

Use the packaged app:

```text
pmu-desktop-app\dist-current\win-unpacked\PMU Desktop App.exe
```

Or run it from source:

```powershell
npm install
npm start
```

## Basic Use

1. Open the app.
2. Set the `PMU Name`, `Device ID`, and `Listen Port`.
3. Add the PDC IP address in `PDC Access`.
4. Choose the data rate and channels in `Streaming Config`.
5. Click `Start PMU`.
6. Connect the PDC using the same device ID and port.

For local testing on the same computer, use:

```text
PDC IP: 127.0.0.1
Port: 4712
Device ID: 1
```

## Changing Settings

The main thing to remember is the difference between saving and applying:

| Button | Use it for |
| --- | --- |
| `Save Settings` | Saves the values for later. It does not restart a running PMU. |
| `Start PMU` | Saves the current values and starts listening for a PDC. |
| `Apply Changes` | Saves the values and restarts the PMU if it is already running. |
| `Stop PMU` | Stops the PMU and disconnects any connected PDCs. |

If the PMU is already running and you change the port, device ID, PDC IP list, data rate, or selected channels, click `Apply Changes`. The PDC may need to reconnect after that.

If the PMU is stopped, you can just change settings and click `Start PMU`.

## PDC Access

Only IP addresses listed in `PDC Access` can connect.

- Use `127.0.0.1` when the PDC is on the same PC.
- Use the PDC computer's LAN IP when it is on another machine.
- Click `Add PDC IP` if more than one PDC should be allowed.
- Click `Remove` to delete an IP row.

If a PDC is rejected, check that its actual IP address is in this list, then click `Apply Changes`.

## Streaming and Simulation

The PMU starts listening when you click `Start PMU`, but it does not stream data until the PDC sends the start transmission command.

The simulation buttons change the generated signal:

- `Normal`
- `Voltage Sag`
- `Current Spike`
- `Frequency Drop`
- `Phase Shift`
- `Noisy Signal`

Changing the simulation mode is immediate while the PMU is running.

## What to Watch

The `Runtime Status` panel shows whether the PMU is stopped, listening, or connected. It also shows the active device ID, port, allowed PDCs, and connected PDCs.

The `Event Log` is the quickest place to check what happened. It shows saved settings, accepted or rejected PDC connections, received commands, streaming changes, and errors.

## Common Problems

**PDC cannot connect**

Check that the PMU is running, the PDC is using the right IP and port, and the PDC IP is allowed in the app.

**PDC connects but gets rejected**

The PDC IP is probably not in `PDC Access`. Add it and click `Apply Changes`.

**Command rejected because of device ID**

The PMU `Device ID` and the PDC device ID do not match. Make them the same, then apply the change.

**Settings changed but nothing happened**

Use `Apply Changes` when the PMU is already running. `Save Settings` only writes the config to disk.

**Port will not start**

Another program may already be using the port. Stop the other program or choose a different port.

## Developer Notes

Run the app:

```powershell
npm start
```

Build the Windows package:

```powershell
npm run package
```

Main files:

```text
electron/main.mjs          App window and IPC handlers
electron/preload.cjs       UI bridge
src/core/config-store.mjs  Saved PMU settings
src/core/pmu-engine.mjs    TCP PMU engine
src/core/protocol.mjs      C37.118 frame logic
src/ui/app.mjs             UI actions
```
