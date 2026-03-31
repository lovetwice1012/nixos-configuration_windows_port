// ============================================================================
// Preload Script — Secure IPC Bridge
// Exposes electronAPI to renderer processes
// ============================================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // ── Data Fetching ──
    getSystemInfo: () => ipcRenderer.invoke('get:system-info'),
    getVolume: () => ipcRenderer.invoke('get:volume'),
    getBattery: () => ipcRenderer.invoke('get:battery'),
    getNetwork: () => ipcRenderer.invoke('get:network'),
    getNetworkList: () => ipcRenderer.invoke('get:networks-list'),
    getBluetooth: () => ipcRenderer.invoke('get:bluetooth'),
    getBluetoothDevices: () => ipcRenderer.invoke('get:bluetooth-devices'),
    getBrightness: () => ipcRenderer.invoke('get:brightness'),
    getFocusTime: () => ipcRenderer.invoke('get:focustime'),
    getMedia: () => ipcRenderer.invoke('get:media'),
    getKeyboard: () => ipcRenderer.invoke('get:keyboard'),
    getWeather: () => ipcRenderer.invoke('get:weather'),
    getApps: () => ipcRenderer.invoke('get:apps'),
    getMonitors: () => ipcRenderer.invoke('get:monitors'),

    setVolume: (vol) => ipcRenderer.invoke('action:set-volume', vol),
    setEqualizer: (bands) => ipcRenderer.invoke('action:set-equalizer', bands),
    eqGetSessions: () => ipcRenderer.invoke('eq:get-sessions'),
    eqStart: (pid) => ipcRenderer.invoke('eq:start', pid),
    eqStop: () => ipcRenderer.invoke('eq:stop'),
    eqSetBand: (band, freq, gain, q) => ipcRenderer.invoke('eq:set-band', { band, freq, gain, q }),
    toggleMute: () => ipcRenderer.invoke('action:toggle-mute'),
    mediaPlayPause: () => ipcRenderer.invoke('action:media-play-pause'),
    mediaNext: () => ipcRenderer.invoke('action:media-next'),
    mediaPrevious: () => ipcRenderer.invoke('action:media-previous'),
    setBrightness: (val) => ipcRenderer.invoke('action:set-brightness', val),
    setPowerProfile: (profile) => ipcRenderer.invoke('action:set-power-profile', profile),
    setTopology: (layouts) => ipcRenderer.invoke('action:set-topology', layouts),
    launchApp: (appPath) => ipcRenderer.invoke('action:launch-app', appPath),
    runCommand: (cmd) => ipcRenderer.invoke('action:run-command', cmd),
    setWallpaper: (imgPath) => ipcRenderer.invoke('action:set-wallpaper', imgPath),

    // ── Settings ──
    getSettings: () => ipcRenderer.invoke('settings:getAll'),
    saveSettings: (s) => ipcRenderer.invoke('settings:setAll', s),

    // ── Google Calendar ──
    getCalendarEvents: () => ipcRenderer.invoke('calendar:getEvents'),

    // ── Widget Management ──
    toggleWidget: (name) => ipcRenderer.send('widget:toggle', name),
    closeWidget: () => ipcRenderer.send('widget:close'),
    toggleLauncher: () => ipcRenderer.send('launcher:toggle'),
    hideLauncher: () => ipcRenderer.send('launcher:hide'),
    setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
    switchDesktop: (id) => ipcRenderer.send('action:switch-desktop', id),

    // ── Event Listeners ──
    onFastUpdate: (callback) => ipcRenderer.on('fast-update', (_, data) => callback(data)),
    onSlowUpdate: (callback) => ipcRenderer.on('slow-update', (_, data) => callback(data)),
    onWeatherUpdate: (callback) => ipcRenderer.on('weather-update', (_, data) => callback(data)),
    onWidgetOpen: (callback) => ipcRenderer.on('widget:open', (_, data) => callback(data)),
    onWidgetClose: (callback) => ipcRenderer.on('widget:close', () => callback()),
    onWidgetState: (callback) => ipcRenderer.on('widget:state', (_, state) => callback(state)),
    onLauncherFocus: (callback) => ipcRenderer.on('launcher:focus', () => callback()),
    onEqVisualizer: (callback) => {
        ipcRenderer.removeAllListeners('eq:visualizer-data');
        ipcRenderer.on('eq:visualizer-data', (_, data) => callback(data));
    },
});
