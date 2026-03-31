// ============================================================================
// トップバー ロジック — TopBar.qml の全機能をJS/DOMで再現
// ============================================================================

// ── 状態変数 ──
let isStartupReady = false;
let startupCascadeFinished = false;
let typeInIndex = 0;
let fullDateStr = '';
let typewriterInterval = null;

// ── DOM 参照 ──
const $ = (id) => document.getElementById(id);

// ── 初期化 ──
document.addEventListener('DOMContentLoaded', () => {
    // 段階的入場アニメーション（TopBar.qml の staggered transition を再現）
    setTimeout(() => {
        isStartupReady = true;
        // 左
        setTimeout(() => {
            const el = $('bar-left');
            if (el) el.style.opacity = '1';
        }, 10);
        // 中央
        setTimeout(() => {
            const el = $('bar-center');
            if (el) el.style.opacity = '1';
        }, 150);
        // 右
        setTimeout(() => {
            const el = $('bar-right');
            if (el) el.style.opacity = '1';
        }, 250);
    }, 10);

    // カスケードアニメーション完了フラグ（1秒後）
    setTimeout(() => { startupCascadeFinished = true; }, 1000);

    // 時計の更新開始
    updateClock();
    setInterval(updateClock, 1000);

    // ワークスペース初期生成
    generateWorkspaces();

    // 初回データ取得
    fetchAllData();

    // イベントリスナー登録
    setupEventListeners();
    setupClickThroughHoverEvents();

    // IPC リスナー登録
    setupIPCListeners();

    // タイプライターエフェクト開始
    startTypewriter();
});

// ── 時計更新（Qt.formatDateTime 再現） ──
function updateClock() {
    const now = new Date();

    // hh:mm:ss AP フォーマット
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const timeStr = `${String(hours).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} ${ampm}`;
    const clockEl = $('clock-time');
    if (clockEl) clockEl.textContent = timeStr;

    // dddd, MMMM dd フォーマット
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const newDateStr = `${days[now.getDay()]}, ${months[now.getMonth()]} ${String(now.getDate()).padStart(2, '0')}`;

    if (newDateStr !== fullDateStr) {
        fullDateStr = newDateStr;
        typeInIndex = 0;
        startTypewriter();
    }
}

// ── 天気の定期取得 ──
async function updateTopWeather() {
    if (!window.electronAPI) return;
    try {
        const weather = await window.electronAPI.getWeather();
        if (weather) {
            const iconEl = $('top-weather-icon');
            const tempEl = $('top-weather-temp');
            if(iconEl) {
                iconEl.textContent = weather.icon || '󰖙';
                // Blend hex with mauve for tint (we'll just use hex directly or keep it mauve)
                iconEl.style.color = weather.hex || 'var(--mauve)';
            }
            if(tempEl) {
                tempEl.textContent = `${weather.temp}°`;
            }
        }
    } catch(e) {}
}

setInterval(updateTopWeather, 600000); // Poll every 10 min
setTimeout(updateTopWeather, 1000); // Fetch initial right after load

// ── タイプライターエフェクト（TopBar.qml typewriterTimer 再現） ──
function startTypewriter() {
    if (typewriterInterval) clearInterval(typewriterInterval);

    typewriterInterval = setInterval(() => {
        if (typeInIndex < fullDateStr.length) {
            typeInIndex++;
            $('clock-date').textContent = fullDateStr.substring(0, typeInIndex);
        } else {
            clearInterval(typewriterInterval);
            typewriterInterval = null;
        }
    }, 40);
}

// ── ワークスペース生成（workspacesModel 再現） ──
function generateWorkspaces(workspaceData = null) {
    const container = $('workspaces-container');
    if (!container) return;

    // デフォルト: 1-10のワークスペース（1がアクティブ）
    const data = workspaceData || [
        { id: '1', state: 'active' },
        { id: '2', state: 'empty' },
        { id: '3', state: 'empty' },
        { id: '4', state: 'empty' },
        { id: '5', state: 'empty' },
        { id: '6', state: 'empty' },
        { id: '7', state: 'empty' },
        { id: '8', state: 'empty' },
    ];

    // 既存要素の状態を更新（フリッカー防止 — TopBar.qml の SMART SYNC を再現）
    const existing = container.querySelectorAll('.workspace-pill');
    if (existing.length === data.length) {
        data.forEach((ws, i) => {
            const pill = existing[i];
            pill.textContent = ws.id;
            pill.className = `workspace-pill ${ws.state}`;
            if (startupCascadeFinished) pill.classList.add('show');
        });
        return;
    }

    // 要素数が変わった場合は再生成
    container.innerHTML = '';
    data.forEach((ws, index) => {
        const pill = document.createElement('div');
        pill.className = `workspace-pill ${ws.state} cascade`;
        pill.textContent = ws.id;
        pill.dataset.wsId = ws.id;

        pill.addEventListener('click', () => {
            if (window.electronAPI) window.electronAPI.closeWidget();
            
            // Visual state transition for workspace click
            document.querySelectorAll('.workspace-pill').forEach(p => {
                p.classList.remove('active');
                p.classList.add('empty');
            });
            pill.classList.remove('empty');
            pill.classList.add('active');
            
            // Invoke desktop switch (mocked to just move right on Windows for now)
            if (window.electronAPI && window.electronAPI.switchDesktop) {
                window.electronAPI.switchDesktop(ws.id);
            }
        });

        container.appendChild(pill);

        // カスケードアニメーション
        if (!startupCascadeFinished) {
            setTimeout(() => pill.classList.add('show'), index * 60);
        } else {
            pill.classList.add('show');
        }
    });
}

// ── メディア情報更新 ──
function updateMedia(media) {
    const box = $('media-box');
    if (!media || media.status === 'Stopped' || !media.title) {
        box.classList.remove('showing');
        return;
    }

    box.classList.add('showing');

    $('media-title').textContent = media.title || '—';
    $('media-artist').textContent = media.artist || '';

    // アルバムアート
    const artImg = $('media-art-img');
    const artContainer = $('media-art');
    if (media.artUrl) {
        artImg.src = media.artUrl;
        artImg.style.display = 'block';
    } else {
        artImg.style.display = 'none';
    }

    // 再生中ボーダー
    if (media.status === 'Playing') {
        box.classList.add('playing');
    } else {
        box.classList.remove('playing');
    }
}

// ── システム情報更新 ──
function updateVolume(vol) {
    if (!vol) return;
    $('volume-icon').textContent = vol.icon || '󰕾';
    $('volume-percent').textContent = `${vol.percent || 0}%`;
    $('volume-icon').style.color = vol.isMuted ? 'var(--overlay0)' : '';
}

function updateBattery(bat) {
    if (!bat) return;
    const pct = bat.capacity !== undefined ? bat.capacity : (bat.percent || 100);
    const isCharging = bat.status === 'Charging' || bat.status === 'Full';
    
    // Battery icon based on capacity
    let batIcon = '󰁹';
    if (isCharging) batIcon = '󰂄';
    else if (pct <= 10) batIcon = '󰁾';
    else if (pct <= 20) batIcon = '󰂃';
    else if (pct <= 50) batIcon = '󰂁';
    
    $('battery-icon').textContent = batIcon;
    $('battery-percent').textContent = `${pct}%`;

    // 動的カラー（TopBar.qml batDynamicColor 再現）
    let color = 'var(--blue)';
    if (isCharging) {
        color = 'var(--green)';
    } else if (pct >= 70) {
        color = 'var(--blue)';
    } else if (pct >= 30) {
        color = 'var(--yellow)';
    } else {
        color = 'var(--red)';
    }
    $('battery-icon').style.color = color;
    $('battery-percent').style.color = color;
}

function updateWifi(wifi) {
    if (!wifi) return;
    $('wifi-icon').textContent = wifi.icon || '󰤮';
    $('wifi-ssid').textContent = wifi.isConnected ? (wifi.ssid || 'Connected') : 'Off';

    const wifiPill = $('wifi-pill');
    if (wifi.isConnected) {
        wifiPill.classList.add('wifi-on');
        $('wifi-icon').style.color = 'var(--green)';
    } else {
        wifiPill.classList.remove('wifi-on');
        $('wifi-icon').style.color = '';
    }
}

function updateBluetooth(bt) {
    if (!bt) return;
    $('bt-icon').textContent = bt.icon || '󰂒';
    
    const btLabel = $('bt-device');
    if (bt.isConnected) {
        btLabel.textContent = bt.device || 'Connected';
        btLabel.style.display = '';
        $('bt-pill').classList.add('bt-on');
        $('bt-icon').style.color = 'var(--blue)';
    } else {
        btLabel.style.display = 'none';
        $('bt-pill').classList.remove('bt-on');
        $('bt-icon').style.color = '';
    }
}

function updateKeyboard(kb) {
    if (!kb) return;
    $('kb-layout').textContent = kb.layout || 'EN';
}

function updateWeather(weather) {
    if (!weather) return;
    $('weather-icon').textContent = weather.icon || '󰖙';
    $('weather-temp').textContent = weather.temp || '--°';

    // 天気アイコンの色をブレンド（TopBar.qml Qt.tint 再現）
    if (weather.hex) {
        $('weather-icon').style.color = weather.hex;
    }
}

// ── データ取得 ──
async function fetchAllData() {
    if (!window.electronAPI) return;

    try {
        const info = await window.electronAPI.getSystemInfo();
        updateVolume(info.volume);
        updateBattery(info.battery);
        updateWifi(info.wifi);
        updateBluetooth(info.bt);
        updateMedia(info.media);
        updateKeyboard(info.kb);
        updateWeather(info.weather);
    } catch (e) {
        console.error('データ取得エラー:', e);
    }
}

// ── IPC リスナー ──
function setupIPCListeners() {
    if (!window.electronAPI) return;

    // 高速ポーラー（200ms間隔: 音量、メディア、キーボード）
    window.electronAPI.onFastUpdate((data) => {
        updateVolume(data.volume);
        updateMedia(data.media);
        updateKeyboard(data.kb);
    });

    // 低速ポーラー（5秒間隔: バッテリー、WiFi、BT）
    window.electronAPI.onSlowUpdate((data) => {
        updateBattery(data.battery);
        updateWifi(data.wifi);
        updateBluetooth(data.bt);
    });

    // 天気ポーラー（2.5分間隔）
    window.electronAPI.onWeatherUpdate((weather) => {
        updateWeather(weather);
    });
}

// ── イベントリスナー ──
function setupEventListeners() {
    // ランチャーボタン (ハンバーガーメニュー)
    if ($('btn-launcher')) {
        $('btn-launcher').addEventListener('click', () => {
            if (window.electronAPI) window.electronAPI.toggleLauncher();
        });
    }

    // 検索ボタン (TODO: 実装)
    if ($('btn-search')) {
        $('btn-search').addEventListener('click', () => {
            if (window.electronAPI) window.electronAPI.toggleWidget('search');
        });
    }

    // 通知ボタン (TODO: システムトレイ等への連携)
    if ($('btn-notifications')) {
        $('btn-notifications').addEventListener('click', (e) => {
            if (window.electronAPI) window.electronAPI.toggleWidget('notif');
        });
    }

    // メディア情報クリック → 音楽ウィジェット
    if ($('media-info-click')) {
        $('media-info-click').addEventListener('click', () => {
            if (window.electronAPI) window.electronAPI.toggleWidget('music');
        });
    }

    // センターボックス → カレンダーウィジェット
    if ($('clock-pill')) {
        $('clock-pill').addEventListener('click', () => {
            if (window.electronAPI) window.electronAPI.toggleWidget('calendar');
        });
    }

    // WiFiピル → ネットワークウィジェット
    $('wifi-pill').addEventListener('click', () => {
        if (window.electronAPI) window.electronAPI.toggleWidget('network');
    });

    // BTピル → ネットワークウィジェット（BTタブ）
    $('bt-pill').addEventListener('click', () => {
        if (window.electronAPI) window.electronAPI.toggleWidget('network');
    });

    // バッテリーピル → バッテリーウィジェット
    $('battery-pill').addEventListener('click', () => {
        if (window.electronAPI) window.electronAPI.toggleWidget('battery');
    });

    // 設定ピル → 設定ウィジェット
    const settingsPill = $('settings-pill');
    if (settingsPill) settingsPill.addEventListener('click', () => {
        if (window.electronAPI) window.electronAPI.toggleWidget('settings');
    });

    // ボリュームピル — ホイールで音量調整
    $('volume-pill').addEventListener('wheel', async (e) => {
        if (!window.electronAPI) return;
        const current = parseInt($('volume-percent').textContent) || 50;
        const delta = e.deltaY < 0 ? 5 : -5;
        const newVol = Math.max(0, Math.min(100, current + delta));
        await window.electronAPI.setVolume(newVol);
    });

    // ボリュームピル — クリックでミュートトグル
    $('volume-pill').addEventListener('click', () => {
        if (window.electronAPI) window.electronAPI.toggleMute();
    });
}

// ── 透明ウィンドウクリックスルー制御 ──
// Windowsでは透明部分を背面に透過させるため、マウスがあたった要素だけクリックを受け付けるよう通知
function setupClickThroughHoverEvents() {
    if (!window.electronAPI) return;
    
    // クリックを受け付けるべき全要素
    const interactiveElements = document.querySelectorAll('.pill, .sub-pill, .center-box, .media-info, .workspace-pill');
    
    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            window.electronAPI.setIgnoreMouseEvents(false);
        });
        el.addEventListener('mouseleave', () => {
            window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
        });
    });
}
