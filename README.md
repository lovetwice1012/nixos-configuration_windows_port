## Previews of my desktop

### You can find all of my wallpapers **[HERE](https://github.com/ilyamiro/shell-wallpapers)**.

#### Update 30.03.26
As of now, due to an increased demand, I am working on installation scripts. The first version will be out in the span of the next 7 days. Thank you for your support!

---

## Windows (Electron Port) Installation

This project has been ported to an Electron-based desktop environment for Windows. The background services (Battery, Audio, Media, Brightness, Network, etc.) are implemented purely in high-performance C++ native modules, replacing outdated PowerShell/VBS scripts for zero CPU latency.

### Prerequisites (Windows)
1. **Node.js** (v18 or higher recommended).
2. **Visual Studio C++ Build Tools** 
   - Installing the `Desktop development with C++` workload is required for compiling the native modules (`node-gyp`).
   - Note: The C++/WinRT compilation explicitly requires the Windows 10/11 SDK, which is included in the VS Build Tools.

### Installation Steps
1. Clone this repository and navigate to the `app/` directory:
   ```cmd
   cd nixos-configuration_windows_port\app
   ```
2. Install the necessary NPM dependencies. This will automatically trigger `node-gyp rebuild` to compile the native `sys_utils.node` addon:
   ```cmd
   npm install
   ```
3. Run the Electron desktop environment:
   ```cmd
   npm start
   ```

---


![preview1](previews/screenshot1.png)
![preview2](previews/screenshot2.png)
![preview6](previews/screenshot6.png)
![preview4](previews/screenshot4.png)
![preview7](previews/screenshot7.png)
![preview4](previews/screenshot5.png)
![preview1_2](previews/screenshot1_3.png)
![preview1_1](previews/screenshot1_1.png)
![preview9](previews/screenshot9.png)
![preview3](previews/screenshot3.png)
