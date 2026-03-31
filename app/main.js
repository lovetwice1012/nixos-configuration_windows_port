// ============================================================================
// NixOS Desktop Port — Electron Main Process
// Recreates the Hyprland + Quickshell desktop environment on Windows
// ============================================================================
const { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

// Service modules
const audioService = require('./services/audio');
const batteryService = require('./services/battery');
const networkService = require('./services/network');
const bluetoothService = require('./services/bluetooth');
const brightnessService = require('./services/brightness');
const mediaService = require('./services/media');
const weatherService = require('./services/weather');
const keyboardService = require('./services/keyboard-layout');
const appLauncherService = require('./services/app-launcher');
const monitorsService = require('./services/monitors');
const focustimeService = require('./services/focustime');
const settingsService = require('./services/settings');
const googleCalendarService = require('./services/google-calendar');

// Real WASAPI Phase Inversion Equalizer
let wasapiCaptureObj = null;
try {
    const { WasapiCapture } = require('./native/wasapi-capture/build/Release/wasapi_capture.node');
    wasapiCaptureObj = new WasapiCapture();
} catch (e) {
    console.error('WASAPI Capture Native module load failed:', e.message);
}

let topBarWindow = null;
let widgetWindow = null;
let launcherWindow = null;
let tray = null;

// Current widget state (mirrors Main.qml's currentActive)
let currentWidget = 'hidden';

// ── Window Creation ──────────────────────────────────────────────────────────

function createTopBar() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;

    topBarWindow = new BrowserWindow({
        x: 4,
        y: 8,
        width: width - 8,
        height: 56,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        focusable: false,
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    topBarWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    // 初期状態は透過部分をクリックスルー
    topBarWindow.setIgnoreMouseEvents(true, { forward: true });
}

function createWidgetWindow() {
    widgetWindow = new BrowserWindow({
        x: -5000,
        y: -5000,
        width: 1,
        height: 1,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        show: false,
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    widgetWindow.loadFile(path.join(__dirname, 'renderer', 'widget.html'));
}

function createLauncherWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    launcherWindow = new BrowserWindow({
        x: Math.floor((width - 1200) / 2),
        y: Math.floor((height - 600) / 2),
        width: 1200,
        height: 600,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        show: false,
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    launcherWindow.loadFile(path.join(__dirname, 'renderer', 'launcher.html'));

    launcherWindow.on('blur', () => {
        launcherWindow.hide();
    });
}

// ── Widget Management (mirrors qs_manager.sh) ────────────────────────────────

const widgetLayouts = {
    battery: { w: 480, h: 760, anchor: 'top-right', offsetX: -20, offsetY: 70 },
    calendar: { w: 1450, h: 750, anchor: 'top-left', offsetX: 235, offsetY: 70 },
    music: { w: 700, h: 620, anchor: 'top-left', offsetX: 12, offsetY: 70 },
    network: { w: 900, h: 700, anchor: 'top-right', offsetX: -20, offsetY: 70 },
    wallpaper: { w: 0, h: 650, anchor: 'center', offsetX: 0, offsetY: 0 },
    focustime: { w: 900, h: 720, anchor: 'center', offsetX: 0, offsetY: 0 },
    monitors: { w: 850, h: 580, anchor: 'center', offsetX: 0, offsetY: 0 },
    settings: { w: 600, h: 520, anchor: 'center', offsetX: 0, offsetY: 0 },
};

function getWidgetPosition(name) {
    const layout = widgetLayouts[name];
    if (!layout) return null;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: mw, height: mh } = primaryDisplay.workAreaSize;
    const w = layout.w === 0 ? mw : layout.w;
    const h = layout.h;

    let x, y;
    switch (layout.anchor) {
        case 'top-left':
            x = layout.offsetX;
            y = layout.offsetY;
            break;
        case 'top-right':
            x = mw - w + layout.offsetX;
            y = layout.offsetY;
            break;
        case 'center':
            x = Math.floor((mw - w) / 2) + layout.offsetX;
            y = Math.floor((mh - h) / 2) + layout.offsetY;
            break;
        default:
            x = 0; y = 0;
    }

    return { x, y, w, h };
}

function toggleWidget(name) {
    if (!widgetWindow) return;

    if (currentWidget === name) {
        closeWidget();
    } else {
        const pos = getWidgetPosition(name);
        if (!pos) return;

        widgetWindow.setBounds({ x: pos.x, y: pos.y, width: pos.w, height: pos.h });
        widgetWindow.show();
        widgetWindow.focus();
        widgetWindow.webContents.send('widget:open', { name, ...pos });
        currentWidget = name;
    }

    if (topBarWindow && !topBarWindow.isDestroyed()) {
        topBarWindow.webContents.send('widget:state', currentWidget);
    }
}

function closeWidget() {
    if (!widgetWindow) return;
    widgetWindow.webContents.send('widget:close');
    setTimeout(() => {
        if (widgetWindow && !widgetWindow.isDestroyed()) {
            widgetWindow.hide();
            widgetWindow.setBounds({ x: -5000, y: -5000, width: 1, height: 1 });
        }
    }, 300);
    currentWidget = 'hidden';
    if (topBarWindow && !topBarWindow.isDestroyed()) {
        topBarWindow.webContents.send('widget:state', 'hidden');
    }
}

// ── Global Hotkeys ───────────────────────────────────────────────────────────
// Windows reserves Super key. Use Ctrl+Alt as modifier instead.

function registerHotkeys() {
    const tryRegister = (accel, cb) => {
        try {
            const ok = globalShortcut.register(accel, cb);
            if (!ok) console.warn(`ホットキー登録失敗: ${accel}`);
            else console.log(`  ✓ ${accel}`);
        } catch (e) {
            console.warn(`ホットキー登録エラー: ${accel}`, e.message);
        }
    };

    // Widget toggles
    tryRegister('CommandOrControl+Alt+S', () => toggleWidget('calendar'));
    tryRegister('CommandOrControl+Alt+Q', () => toggleWidget('music'));
    tryRegister('CommandOrControl+Alt+B', () => toggleWidget('battery'));
    tryRegister('CommandOrControl+Alt+N', () => toggleWidget('network'));
    tryRegister('CommandOrControl+Alt+W', () => toggleWidget('wallpaper'));
    tryRegister('CommandOrControl+Alt+T', () => toggleWidget('focustime'));
    tryRegister('CommandOrControl+Alt+M', () => toggleWidget('monitors'));

    // App launcher
    tryRegister('CommandOrControl+Alt+D', () => {
        if (launcherWindow) {
            if (launcherWindow.isVisible()) {
                launcherWindow.hide();
            } else {
                closeWidget();
                launcherWindow.show();
                launcherWindow.focus();
                launcherWindow.webContents.send('launcher:focus');
            }
        }
    });

    // Media controls
    tryRegister('CommandOrControl+Alt+Space', () => mediaService.togglePlayPause());
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

function setupIPC() {
    // Top bar data requests
    ipcMain.handle('get:system-info', async () => {
        const [volume, battery, wifi, bt, brightness, media, kb, weather] = await Promise.all([
            audioService.getInfo(),
            batteryService.getInfo(),
            networkService.getInfo(),
            bluetoothService.getInfo(),
            brightnessService.getInfo(),
            mediaService.getInfo(),
            keyboardService.getInfo(),
            weatherService.getInfo(),
        ]);
        return { volume, battery, wifi, bt, brightness, media, kb, weather };
    });

    // Individual service requests
    ipcMain.handle('get:volume', () => audioService.getInfo());
    ipcMain.handle('get:battery', () => batteryService.getInfo());
    ipcMain.handle('get:network', () => networkService.getInfo());
    ipcMain.handle('get:networks-list', () => networkService.getAvailableNetworks ? networkService.getAvailableNetworks() : []);
    ipcMain.handle('get:bluetooth', () => bluetoothService.getInfo());
    ipcMain.handle('get:bluetooth-devices', () => bluetoothService.getDevices ? bluetoothService.getDevices() : []);
    ipcMain.handle('get:brightness', () => brightnessService.getInfo());
    ipcMain.handle('get:media', () => mediaService.getInfo());
    ipcMain.handle('get:keyboard', () => keyboardService.getInfo());
    ipcMain.handle('get:weather', () => weatherService.getInfo());
    ipcMain.handle('get:apps', () => appLauncherService.getApps());
    ipcMain.handle('get:monitors', () => monitorsService.getInfo());
    ipcMain.handle('get:focustime', () => focustimeService.getStats());

    // Actions
    ipcMain.handle('action:set-volume', (_, vol) => audioService.setVolume(vol));
    ipcMain.handle('action:toggle-mute', () => audioService.toggleMute());
    ipcMain.handle('action:media-play-pause', () => mediaService.togglePlayPause());
    ipcMain.handle('action:media-next', () => mediaService.next());
    ipcMain.handle('action:media-previous', () => mediaService.previous());
    ipcMain.handle('action:set-brightness', (_, val) => brightnessService.setBrightness(val));
    ipcMain.handle('action:set-power-profile', (_, profile) => require('./services/battery').setPowerProfile(profile));
    
    // ガチ実装WASAPIイコライザ制御
    ipcMain.handle('eq:get-sessions', () => {
        if (!wasapiCaptureObj) return [];
        return require('./native/wasapi-capture/build/Release/wasapi_capture.node').WasapiCapture.getAudioSessions();
    });
    
    ipcMain.handle('eq:start', (event, pid) => {
        if (!wasapiCaptureObj) return false;
        try {
            wasapiCaptureObj.startCapture(pid, (pcmFloatArray) => {
                // Send visualizer data to renderer (only some slices to prevent IPC flooding)
                // Sending ~2048 float samples at 44.1kHz is fine, but if it causes lag, 
                // we can downsample. We'll send it to the widgetWindow.
                if (widgetWindow && !widgetWindow.isDestroyed()) {
                    widgetWindow.webContents.send('eq:visualizer-data', pcmFloatArray);
                }
            });
            return true;
        } catch (e) {
            console.error('WASAPI Start error', e);
            return false;
        }
    });

    ipcMain.handle('eq:stop', () => {
        if (wasapiCaptureObj) wasapiCaptureObj.stopCapture();
    });

    ipcMain.handle('eq:set-band', (_, { band, freq, gain, q }) => {
        if (wasapiCaptureObj) wasapiCaptureObj.setEqBand(band, freq, gain, q);
    });

    ipcMain.handle('action:set-equalizer', (_, bands) => {
        // Fallback for old mock sys-utils, now we route it to Wasapi if no explicit eq:set-band is used
        try { require('./native/sys-utils/build/Release/sys_utils.node').setAudioEqualizer(bands); } catch(e){}
    });
    ipcMain.handle('action:set-topology', (_, layouts) => monitorsService.setTopology(layouts));
    ipcMain.handle('action:launch-app', (_, appPath) => appLauncherService.launch(appPath));
    ipcMain.handle('action:run-command', (_, cmd) => require('child_process').exec(cmd));
    ipcMain.handle('action:set-wallpaper', (_, imgPath) => {
        const wallpaperService = require('./services/wallpaper');
        return wallpaperService.setWallpaper(imgPath);
    });

    // Desktop
    ipcMain.on('action:switch-desktop', (_, id) => {
        const virtualDesktopService = require('./services/virtual-desktops');
        virtualDesktopService.switchTo(id);
    });

    // Widget management from renderer
    ipcMain.on('widget:toggle', (_, name) => toggleWidget(name));
    ipcMain.on('widget:close', () => closeWidget());
    ipcMain.on('launcher:hide', () => { if (launcherWindow) launcherWindow.hide(); });

    // ── Settings IPC ──
    ipcMain.handle('settings:getAll', () => settingsService.getAll());
    ipcMain.handle('settings:setAll', (_, newSettings) => {
        settingsService.setAll(newSettings);
        return { ok: true };
    });

    // ── Google Calendar IPC ──
    ipcMain.handle('calendar:getEvents', () => googleCalendarService.getEvents());

    // Click-through management for top bar
    ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.setIgnoreMouseEvents(ignore, options);
    });

    // Launcher
    ipcMain.on('launcher:toggle', () => {
        if (!launcherWindow) return;
        if (launcherWindow.isVisible()) {
            launcherWindow.hide();
        } else {
            closeWidget();
            launcherWindow.show();
            launcherWindow.focus();
            launcherWindow.webContents.send('launcher:focus');
        }
    });
}

// ── System Tray ──────────────────────────────────────────────────────────────

function createTray() {
    try {
        const iconSize = 16;
        const buf = Buffer.alloc(iconSize * iconSize * 4);
        for (let i = 0; i < iconSize * iconSize; i++) {
            buf[i * 4] = 137;     // R
            buf[i * 4 + 1] = 180; // G
            buf[i * 4 + 2] = 250; // B
            buf[i * 4 + 3] = 255; // A
        }
        const icon = nativeImage.createFromBuffer(buf, { width: iconSize, height: iconSize });

        tray = new Tray(icon);

        const contextMenu = Menu.buildFromTemplate([
            { label: 'NixOS Desktop Port', enabled: false },
            { type: 'separator' },
            { label: 'Calendar  (Ctrl+Alt+S)', click: () => toggleWidget('calendar') },
            { label: 'Music     (Ctrl+Alt+Q)', click: () => toggleWidget('music') },
            { label: 'Network   (Ctrl+Alt+N)', click: () => toggleWidget('network') },
            { label: 'Battery   (Ctrl+Alt+B)', click: () => toggleWidget('battery') },
            { label: 'Monitors  (Ctrl+Alt+M)', click: () => toggleWidget('monitors') },
            { label: 'Launcher  (Ctrl+Alt+D)', click: () => {
                if (launcherWindow) { launcherWindow.show(); launcherWindow.focus(); launcherWindow.webContents.send('launcher:focus'); }
            }},
            { type: 'separator' },
            { label: 'DevTools (TopBar)', click: () => { if (topBarWindow) topBarWindow.webContents.openDevTools({ mode: 'detach' }); }},
            { label: 'DevTools (Widget)', click: () => { if (widgetWindow) widgetWindow.webContents.openDevTools({ mode: 'detach' }); }},
            { type: 'separator' },
            { label: 'Quit', click: () => app.quit() },
        ]);

        tray.setToolTip('NixOS Desktop');
        tray.setContextMenu(contextMenu);
    } catch (e) {
        console.error('トレイ作成エラー:', e.message);
    }
}

// ── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
    console.log('NixOS Desktop Port 起動中...');

    try {
        createTopBar();
        console.log('✓ トップバー作成完了');
    } catch (e) { console.error('✗ トップバーエラー:', e); }

    try {
        createWidgetWindow();
        console.log('✓ ウィジェットウィンドウ作成完了');
    } catch (e) { console.error('✗ ウィジェットエラー:', e); }

    try {
        createLauncherWindow();
        console.log('✓ ランチャー作成完了');
    } catch (e) { console.error('✗ ランチャーエラー:', e); }

    try {
        createTray();
        console.log('✓ システムトレイ作成完了');
    } catch (e) { console.error('✗ トレイエラー:', e); }

    console.log('ホットキー登録中...');
    try {
        registerHotkeys();
        console.log('✓ グローバルホットキー登録完了');
    } catch (e) { console.error('✗ ホットキーエラー:', e); }

    setupIPC();
    console.log('✓ IPC セットアップ完了');

    // DevTools（開発時のみ）
    if (process.argv.includes('--dev')) {
        topBarWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // Start periodic data push to top bar
    setInterval(async () => {
        if (topBarWindow && !topBarWindow.isDestroyed()) {
            try {
                const [volume, media, kb] = await Promise.all([
                    audioService.getInfo(),
                    mediaService.getInfo(),
                    keyboardService.getInfo(),
                ]);
                topBarWindow.webContents.send('fast-update', { volume, media, kb });
            } catch (e) { /* ignore */ }
        }
    }, 2000); // 2 second interval (PowerShell calls are expensive)

    setInterval(async () => {
        if (topBarWindow && !topBarWindow.isDestroyed()) {
            try {
                const [battery, wifi, bt] = await Promise.all([
                    batteryService.getInfo(),
                    networkService.getInfo(),
                    bluetoothService.getInfo(),
                ]);
                topBarWindow.webContents.send('slow-update', { battery, wifi, bt });
            } catch (e) { /* ignore */ }
        }
    }, 10000);

    setInterval(async () => {
        if (topBarWindow && !topBarWindow.isDestroyed()) {
            try {
                const weather = await weatherService.getInfo();
                topBarWindow.webContents.send('weather-update', weather);
            } catch (e) { /* ignore */ }
        }
    }, 150000);

    console.log('✓ 全サービス起動完了！');
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
