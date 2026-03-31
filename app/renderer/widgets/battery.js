// ============================================================================
// バッテリーウィジェット — Native C++ 完全対応プレミアム版
// ============================================================================

let batteryAnimFrame = null;
let currentBatteryPct = 0;
let uiCapacity = 0; // スムーズ補間用
let isChargingState = false;

// 描画関連
let pumpPhase = 0;
let dischargePhase = 1;
let lastTime = 0;
let isHoveringHero = false;

// 状態
let sysVolume = 0;
let sysMuted = false;
let sysBrightness = 0;
let isDraggingBri = false;
let isDraggingVol = false;

let powerProfileStr = 'balanced';

// Hold-to-confirm アクション群
const ACTIONS = [
    { cmd: "rundll32.exe user32.dll,LockWorkStation", icon: "", label: "Lock", c1: "var(--mauve)", c2: "var(--pink)", weight: 1.0, id: 'act-lock' },
    { cmd: "rundll32.exe powrprof.dll,SetSuspendState 0,1,0", icon: "ᶻ 𝗓 𐰁", label: "Sleep", c1: "var(--blue)", c2: "var(--sapphire)", weight: 1.5, id: 'act-sleep' },
    { cmd: "shutdown /r /t 0", icon: "󰑓", label: "Reboot", c1: "var(--yellow)", c2: "var(--peach)", weight: 2.5, id: 'act-reboot' },
    { cmd: "shutdown /s /t 0", icon: "", label: "Power", c1: "var(--red)", c2: "var(--maroon)", weight: 3.5, id: 'act-poweroff' }
];

let actionStates = {};

function renderBatteryWidget(container) {
    const batPanel = document.createElement('div');
    batPanel.className = 'widget-panel';
    batPanel.style.padding = '0';

    batPanel.innerHTML = `
    <div class="battery-widget">
        <!-- ── アンビエント照明 (Blobs) ── -->
        <div class="battery-ambient-bg">
            <div class="bat-blob-1" id="bat-blob-1"></div>
            <div class="bat-blob-2" id="bat-blob-2"></div>
            <div class="bat-radar-ring" id="bat-radar"></div>
        </div>

        <div class="battery-content">
            <!-- ── トップバー (稼働時間＆ログアウト) ── -->
            <div class="battery-top-bar" id="bat-top-bar">
                <div class="battery-uptime">
                    <div class="uptime-box"><span class="uptime-val" id="up-hr">00</span><span class="uptime-lbl">HR</span></div>
                    <div class="uptime-colon">:</div>
                    <div class="uptime-box"><span class="uptime-val" id="up-min">00</span><span class="uptime-lbl">MIN</span></div>
                </div>
                
                <button class="battery-logout-btn" id="logout-btn">
                    <span class="logout-text" id="username-text">User</span>
                    <span class="logout-icon">󰍃</span>
                </button>
            </div>

            <!-- ── 中央のバッテリーコア (Canvas連動) ── -->
            <div class="battery-core-wrap" id="bat-core-wrap">
                <div class="battery-core-halo" id="bat-halo"></div>
                <div class="battery-core" id="bat-hero">
                    <canvas class="battery-canvas" id="bat-canvas" width="260" height="260"></canvas>
                    <div class="battery-core-info">
                        <div class="battery-core-pct">
                            <span class="battery-core-icon" id="bat-core-icon">󰁹</span>
                            <span id="bat-core-val">--%</span>
                        </div>
                        <div class="battery-core-status" id="bat-core-status">UNKNOWN</div>
                    </div>
                </div>
            </div>

            <!-- ── 下部ハードウェアスライダー ── -->
            <div class="battery-hardware-dock" id="bat-hw-dock">
                <div class="hw-row">
                    <button class="hw-icon-wrap" id="bri-icon">󰃟</button>
                    <div class="hw-slider-container" id="bri-slider">
                        <div class="hw-slider-bg"><div class="hw-slider-fill" id="bri-fill"></div></div>
                    </div>
                </div>
                <div class="hw-row">
                    <button class="hw-icon-wrap" id="vol-icon">󰕾</button>
                    <div class="hw-slider-container" id="vol-slider">
                        <div class="hw-slider-bg"><div class="hw-slider-fill" id="vol-fill"></div></div>
                    </div>
                </div>
            </div>

            <!-- ── SYSTEM ACTIONS DOCK ── -->
            <div class="bat-action-dock" id="bat-action-dock">
                ${ACTIONS.map(a => `
                    <div class="action-capsule" id="${a.id}">
                        <canvas class="action-canvas" width="60" height="75"></canvas>
                        <span class="action-icon">${a.icon}</span>
                        <span class="action-label">${a.label}</span>
                        <div class="action-flash"></div>
                    </div>
                `).join('')}
            </div>

            <!-- ── POWER PROFILES DOCK ── -->
            <div class="bat-profile-dock" id="bat-prof-dock">
                <div class="profile-pill" id="prof-pill"></div>
                <div class="profile-btn active" data-prof="performance"><span class="p-icon">󰓅</span><span class="p-lbl">Perform</span></div>
                <div class="profile-btn" data-prof="balanced"><span class="p-icon">󰗑</span><span class="p-lbl">Balance</span></div>
                <div class="profile-btn" data-prof="power-saver"><span class="p-icon">󰌪</span><span class="p-lbl">Saver</span></div>
            </div>
        </div>
    </div>`;
    container.appendChild(batPanel);

    setupInteractions(batPanel);
    
    // First data load
    setTimeout(updateBatteryData, 50);
    window.widgetUpdateInterval = setInterval(updateBatteryData, 1500);

    // Canvas render loop
    lastTime = performance.now();
    batteryAnimFrame = requestAnimationFrame(renderCanvasLoop);
}

function getBatteryColors(pct, isCharging) {
    if (isCharging) return { start: '#a6e3a1', end: '#bfe7bd', primary: '#a6e3a1', secondary: '#89b4fa' }; 
    if (pct >= 70) return { start: '#89b4fa', end: '#a2c4fc', primary: '#89b4fa', secondary: '#cba6f7' }; 
    if (pct >= 30) return { start: '#f9e2af', end: '#faeabf', primary: '#f9e2af', secondary: '#fab387' }; 
    return { start: '#f38ba8', end: '#f6a4bb', primary: '#f38ba8', secondary: '#eba0ac' }; 
}

function getProfileColors(prof) {
    if (prof === 'performance') return { s: '#f38ba8', e: '#f6a4bb' };
    if (prof === 'power-saver') return { s: '#a6e3a1', e: '#bfe7bd' };
    return { s: '#89b4fa', e: '#a2c4fc' };
}

// ----------------------------------------------------
// CANVAS RENDER LOOPS
// ----------------------------------------------------
function renderCanvasLoop(time) {
    let dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    // 1. BATTERY CORE
    if (document.getElementById('bat-canvas')) {
        uiCapacity += (currentBatteryPct - uiCapacity) * 8 * dt;
        if (isHoveringHero && isChargingState) { pumpPhase += 1.2 * dt; if (pumpPhase > 1) pumpPhase -= 1; }
        if (isHoveringHero && !isChargingState) { dischargePhase -= 0.8 * dt; if (dischargePhase < 0) dischargePhase += 1; }
        renderBatteryCanvas();
    }

    // 2. ACTION WAVES
    ACTIONS.forEach(a => {
        let st = actionStates[a.id];
        if(!st) return;
        
        let el = document.getElementById(a.id);
        if(!el) return;
        
        // Logical fill tweening
        if(st.isFilling) {
            st.fillLevel += dt * (1.2 / a.weight); 
            if(st.fillLevel >= 1.0) {
                st.fillLevel = 1.0;
                st.isFilling = false;
                st.triggered = true;
                // Execute action
                executeAction(a);
            }
        } else if(!st.triggered && st.fillLevel > 0) {
            st.fillLevel -= dt * 2.0;
            if(st.fillLevel < 0) st.fillLevel = 0;
        }

        // Draw Liquid Wave
        if(st.fillLevel > 0) {
            st.wavePhase += dt * 4;
            const cvs = el.querySelector('.action-canvas');
            if(cvs) renderActionWave(cvs, st.fillLevel, st.wavePhase, a.c1, a.c2);
        } else {
            const cvs = el.querySelector('.action-canvas');
            if(cvs) { const ctx = cvs.getContext('2d'); ctx.clearRect(0,0,cvs.width,cvs.height); }
        }
    });

    batteryAnimFrame = requestAnimationFrame(renderCanvasLoop);
}

function renderBatteryCanvas() {
    const canvas = document.getElementById('bat-canvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width; const h = canvas.height;
    const cx = w/2; const cy = h/2; const r = cx - 18;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 2); // Start bottom
    
    const endAngle = (uiCapacity / 100) * 2 * Math.PI;
    const colors = getBatteryColors(uiCapacity, isChargingState);

    // Track
    ctx.lineCap = 'round'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 2*Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.stroke();

    if (endAngle > 0.05) {
        // Fill
        const fillGrad = ctx.createLinearGradient(0, r, 0, -r);
        fillGrad.addColorStop(0, colors.start); fillGrad.addColorStop(1, colors.end);

        ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(0, 0, r, 0, endAngle);
        ctx.strokeStyle = fillGrad; ctx.globalAlpha = 1.0; ctx.stroke();

        // VFX
        if (isHoveringHero) {
            if (isChargingState) {
                let sA = pumpPhase * (endAngle + 0.6) - 0.3;
                if (sA > 0 && sA < endAngle) {
                    let sS = Math.max(0, sA - 0.4); let sE = Math.min(endAngle, sA + 0.4);
                    ctx.beginPath(); ctx.arc(0, 0, r, sS, sE); ctx.lineWidth = 22; ctx.strokeStyle = colors.start;
                    ctx.globalAlpha = 0.5 * Math.sin(pumpPhase * Math.PI); ctx.stroke();

                    sS = Math.max(0, sA - 0.2); sE = Math.min(endAngle, sA + 0.2);
                    ctx.beginPath(); ctx.arc(0, 0, r, sS, sE); ctx.lineWidth = 28; ctx.strokeStyle = colors.end;
                    ctx.globalAlpha = 0.8 * Math.sin(pumpPhase * Math.PI); ctx.stroke();
                }
                if (pumpPhase > 0.7) {
                    let fP = (pumpPhase - 0.7) / 0.3;
                    let hX = Math.cos(endAngle) * r; let hY = Math.sin(endAngle) * r;
                    ctx.beginPath(); ctx.arc(hX, hY, 7 + (fP * 15), 0, 2*Math.PI);
                    ctx.fillStyle = colors.end; ctx.globalAlpha = (1.0 - fP) * 0.6; ctx.fill();
                }
            } else {
                let dC = dischargePhase * endAngle;
                for (let d = 0; d < 2; d++) {
                    let dS = 0.2 + (d * 0.15);
                    let st = Math.max(0, dC - dS); let ed = Math.min(endAngle, dC + dS);
                    if (st < ed) {
                        ctx.beginPath(); ctx.arc(0, 0, r, st, ed); ctx.lineWidth = 14 + (1 - d) * 2;
                        ctx.strokeStyle = colors.end; ctx.globalAlpha = 0.2 * Math.sin(dischargePhase * Math.PI); ctx.stroke();
                    }
                }
            }
        }
    }
    ctx.restore();
}

function renderActionWave(cvs, fillLvl, wavePhase, c1, c2) {
    const ctx = cvs.getContext('2d');
    const w = cvs.width; const h = cvs.height;
    ctx.clearRect(0, 0, w, h);
    
    // Convert css var(--foo) to actual hex approx if needed, but linearGrad accepts text strings
    // In canvas we must use actual computed colors, so lets get them:
    const comp1 = getComputedStyle(document.body).getPropertyValue(c1.match(/var\((.+)\)/)[1]);
    const comp2 = getComputedStyle(document.body).getPropertyValue(c2.match(/var\((.+)\)/)[1]);

    const fillY = h * (1.0 - fillLvl);
    ctx.beginPath();
    ctx.moveTo(0, fillY);
    
    if(fillLvl < 0.99) {
        const waveAmp = 5 * Math.sin(fillLvl * Math.PI);
        const cp1y = fillY + Math.sin(wavePhase) * waveAmp;
        const cp2y = fillY + Math.cos(wavePhase + Math.PI) * waveAmp;
        
        ctx.bezierCurveTo(w * 0.33, cp2y, w * 0.66, cp1y, w, fillY);
    } else {
        ctx.lineTo(w, fillY);
    }
    
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, comp1 || '#fff');
    grad.addColorStop(1, comp2 || '#ccc');
    ctx.fillStyle = grad;
    ctx.fill();
}

// ----------------------------------------------------
// UI DATA FETCH & EVENTS
// ----------------------------------------------------
async function updateBatteryData() {
    if (!window.electronAPI) return;
    try {
        const info = await window.electronAPI.getBattery();
        if (!info) return;
        
        currentBatteryPct = info.capacity || 0;
        isChargingState = info.status === 'Charging';
        powerProfileStr = info.powerProfile || 'balanced';

        const el = (id) => document.getElementById(id);
        if (el('username-text')) el('username-text').innerText = info.currentUserName || 'User';
        if (el('bat-core-val')) el('bat-core-val').innerText = `${info.capacity}%`;
        if (el('bat-core-status')) el('bat-core-status').innerText = (info.status || 'Unknown').toUpperCase();
        if (el('bat-core-icon')) el('bat-core-icon').innerText = isChargingState ? '󰂄' : (info.capacity > 20 ? '󰁹' : '󰂃');

        if (el('up-hr')) el('up-hr').innerText = (info.upHours || 0).toString().padStart(2, '0');
        if (el('up-min')) el('up-min').innerText = (info.upMins || 0).toString().padStart(2, '0');

        updateCSSVariables(info.capacity, isChargingState);
        updateProfileDock();

        // Background APIs — Brightness
        if (!isDraggingBri) {
            try {
                const bInfo = await window.electronAPI.getBrightness();
                sysBrightness = bInfo?.brightness || 0;
                if (el('bri-fill')) el('bri-fill').style.width = Math.max(2, sysBrightness) + '%';
                if (el('bri-icon')) el('bri-icon').innerText = sysBrightness > 66 ? '󰃠' : (sysBrightness > 33 ? '󰃟' : '󰃞');
            } catch(e) {}
        }
        // Background APIs — Volume
        if (!isDraggingVol) {
            try {
                const volInfo = await window.electronAPI.getVolume();
                sysVolume = volInfo?.percent || 0;
                sysMuted = volInfo?.isMuted || false;
                if (el('vol-fill')) el('vol-fill').style.width = Math.max(2, sysVolume) + '%';
                if (el('vol-fill')) el('vol-fill').style.opacity = sysMuted ? 0.3 : 1.0;
                if (el('vol-icon')) el('vol-icon').innerText = sysMuted || sysVolume === 0 ? '󰖁' : (sysVolume > 50 ? '󰕾' : '󰖀');
            } catch(e) {}
        }

    } catch(e) { console.error('Bat Update Err', e); }
}

function updateCSSVariables(pct, isCharging) {
    const c = getBatteryColors(pct, isCharging);
    const root = document.querySelector('.battery-widget');
    if (root) {
        root.style.setProperty('--bat-color-start', c.start);
        root.style.setProperty('--bat-color-end', c.end);
        root.style.setProperty('--blob-color', c.primary);
    }
}

function updateProfileDock() {
    const pill = document.getElementById('prof-pill');
    const btns = document.querySelectorAll('.profile-btn');
    
    // Pill positioning
    const wd = (100 / 3);
    const lefts = { 'performance': 0, 'balanced': wd, 'power-saver': wd*2 };
    if(pill) pill.style.left = `calc(${lefts[powerProfileStr]}% + 1px)`;
    pill.style.width = `calc(${wd}% - 2px)`;
    
    // Cccent colors
    const pc = getProfileColors(powerProfileStr);
    const root = document.querySelector('.battery-widget');
    if(root) {
        root.style.setProperty('--profile-color', pc.s);
        root.style.setProperty('--profile-color-end', pc.e);
    }

    btns.forEach(b => {
        if(b.dataset.prof === powerProfileStr) b.classList.add('active');
        else b.classList.remove('active');
    });
}

function setupInteractions(panel) {
    // Hero Core
    const hero = panel.querySelector('#bat-hero');
    hero.addEventListener('pointerenter', () => isHoveringHero = true);
    hero.addEventListener('pointerleave', () => isHoveringHero = false);

    // Profile Dock
    const pBtns = panel.querySelectorAll('.profile-btn');
    pBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tgt = btn.dataset.prof;
            powerProfileStr = tgt;
            updateProfileDock();
            if(window.electronAPI) window.electronAPI.setPowerProfile(tgt);
        });
    });

    // Actions Dock
    ACTIONS.forEach(a => {
        actionStates[a.id] = { fillLevel: 0, isFilling: false, triggered: false, wavePhase: 0 };
        const el = panel.querySelector(`#${a.id}`);
        if(el) {
            el.addEventListener('pointerdown', () => { if(!actionStates[a.id].triggered) actionStates[a.id].isFilling = true; });
            document.addEventListener('pointerup', () => { if(actionStates[a.id]) actionStates[a.id].isFilling = false; });
            el.addEventListener('pointerleave', () => { actionStates[a.id].isFilling = false; });
        }
    });

    // Sliders
    setupSlider(panel.querySelector('#bri-slider'), panel.querySelector('#bri-fill'), 
        val => { sysBrightness = val; isDraggingBri = true; },
        val => { if(window.electronAPI) window.electronAPI.setBrightness(val); },
        () => isDraggingBri = false
    );
    setupSlider(panel.querySelector('#vol-slider'), panel.querySelector('#vol-fill'), 
        val => { sysVolume = val; isDraggingVol = true; },
        val => { if(window.electronAPI) window.electronAPI.setVolume(val); },
        () => isDraggingVol = false
    );
}

function setupSlider(container, fill, onDrag, onChange, onDrop) {
    if (!container) return;
    let isActive = false;
    let throttleTimer = null;

    const updateFromEvent = (e) => {
        const rect = container.getBoundingClientRect();
        const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
        const val = Math.round(pct * 100);
        fill.style.width = Math.max(2, val) + '%';
        onDrag(val);

        if (!throttleTimer) {
            throttleTimer = setTimeout(() => {
                onChange(val);
                throttleTimer = null;
            }, 50);
        }
    };

    container.addEventListener('pointerdown', (e) => { isActive = true; container.setPointerCapture(e.pointerId); updateFromEvent(e); });
    container.addEventListener('pointermove', (e) => { if (isActive) updateFromEvent(e); });
    container.addEventListener('pointerup', (e) => { if (isActive) { isActive = false; container.releasePointerCapture(e.pointerId); onDrop(); } });
}

function executeAction(a) {
    const el = document.getElementById(a.id);
    if(el) {
        const flash = el.querySelector('.action-flash');
        if(flash) {
            flash.style.opacity = '0.6';
            setTimeout(() => flash.style.opacity = '0', 500);
        }
    }
    // Launch detached cmd
    if(window.electronAPI) window.electronAPI.runCommand(a.cmd);
}
