// ============================================================================
// ネットワークウィジェット — NetworkPopup.qml 完全復元 (Info Cards + Radar)
// ============================================================================

let currentNetTab = 'wifi'; // 'wifi' or 'bluetooth'
let netAnimFrame = null;
let lastNetTime = performance.now();
let activeNodes = [];
let centerCorePos = { x: 0, y: 0 };
let currentSystemState = { wifi: null, bt: null };
let showInfoView = false; // true = info cards, false = device list

function renderNetworkWidget(container) {
    const batPanel = document.createElement('div');
    batPanel.className = 'widget-panel';
    batPanel.style.padding = '0'; 

    batPanel.innerHTML = `
    <div class="network-widget">
        <!-- ── レーダー背景 ── -->
        <div class="net-radar-bg">
            <div class="net-radar-ring"></div>
            <div class="net-radar-ring"></div>
            <div class="net-radar-ring"></div>
        </div>

        <canvas class="net-canvas" id="net-canvas"></canvas>

        <!-- ── ノード群 ── -->
        <div id="net-nodes-container" style="position:absolute; inset:0; z-index:3; pointer-events:none;">
        </div>

        <!-- ── 中央コア ── -->
        <div class="net-center-core" id="net-core">
            <span class="net-core-icon" id="net-core-icon">󰤨</span>
            <div class="net-core-label" id="net-core-label">WIFI</div>
            <div class="net-core-sub" id="net-core-sub">SCANNING</div>
        </div>

        <!-- ── 下部タブナビゲーション ── -->
        <div class="net-tabs-dock">
            <div class="net-tab active" data-tab="wifi" id="tab-w">
                <span class="net-tab-icon">󰤨</span> Wi-Fi
            </div>
            <div class="net-tab" data-tab="bluetooth" id="tab-b">
                <span class="net-tab-icon">󰂯</span> Bluetooth
            </div>
            <button class="net-power-btn" id="net-power-btn" title="Toggle Power">
                <span class="net-power-icon">⏻</span>
            </button>
        </div>
        
        <!-- 余剰リスト -->
        <div class="net-overflow-list" id="net-overflow" style="pointer-events:auto;"></div>
    </div>`;
    
    container.appendChild(batPanel);

    setupNetworkInteractions(batPanel);

    // Initial load
    updateNetworkData();
    window.widgetUpdateInterval = setInterval(updateNetworkData, 4000);

    // Canvas loop
    const canvas = document.getElementById('net-canvas');
    if (canvas) {
        const resize = () => {
            const rect = batPanel.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            centerCorePos = { x: rect.width / 2, y: rect.height / 2 - 30 };
        };
        window.addEventListener('resize', resize);
        resize();
    }
    lastNetTime = performance.now();
    netAnimFrame = requestAnimationFrame(renderNetworkCanvas);
}

function buildInfoNodes(tab, mainInfo) {
    const nodes = [];
    
    if (tab === 'wifi' && mainInfo.isConnected) {
        if (mainInfo.signal !== undefined) {
            nodes.push({ id: 'sig', name: mainInfo.signal + '%', icon: mainInfo.icon || '󰤨', action: 'Signal Strength', color: 'var(--green)' });
        }
        if (mainInfo.security) {
            nodes.push({ id: 'sec', name: mainInfo.security, icon: '󰦝', action: 'Security', color: 'var(--blue)' });
        }
        if (mainInfo.ip) {
            nodes.push({ id: 'ip', name: mainInfo.ip, icon: '󰩟', action: 'IP Address', color: 'var(--sapphire)' });
        }
        if (mainInfo.freq) {
            nodes.push({ id: 'freq', name: mainInfo.freq, icon: '󰖧', action: 'Band', color: 'var(--mauve)' });
        }
        // Scan Devices action card
        nodes.push({ id: 'scan', name: 'Scan Devices', icon: '󰍉', action: 'Switch View', color: 'var(--text)', isAction: true });
    } else if (tab === 'bluetooth') {
        const btMain = currentSystemState.bt?.main;
        if (btMain && btMain.isConnected) {
            // We need MAC address etc. from the device list
            const btDevices = currentSystemState.bt?.list || [];
            const connDevice = btDevices.find(d => d.status === 'Connected') || {};
            
            if (connDevice.mac) {
                nodes.push({ id: 'mac', name: connDevice.mac, icon: '󰒋', action: 'MAC Address', color: 'var(--pink)' });
            }
            if (connDevice.profile) {
                nodes.push({ id: 'prof', name: connDevice.profile, icon: connDevice.profile === 'Hi-Fi (A2DP)' ? '󰓃' : '󰋎', action: 'Audio Profile', color: 'var(--mauve)' });
            }
            if (connDevice.battery !== undefined) {
                nodes.push({ id: 'bat', name: connDevice.battery + '%', icon: '󰥉', action: 'Battery', color: 'var(--green)' });
            }
            nodes.push({ id: 'scan', name: 'Scan Devices', icon: '󰍉', action: 'Switch View', color: 'var(--text)', isAction: true });
        }
    }
    
    return nodes;
}

function processAndRender(tab, mainInfo, arrayData) {
    const root = document.querySelector('.network-widget');
    const coreIcon = document.getElementById('net-core-icon');
    const coreLabel = document.getElementById('net-core-label');
    const coreSub = document.getElementById('net-core-sub');

    if (tab === 'wifi') {
        const isConn = mainInfo.isConnected;
        if (coreIcon) coreIcon.innerHTML = mainInfo.icon || '󰤯';
        if (coreLabel) coreLabel.textContent = isConn ? mainInfo.ssid : "DISCONNECTED";
        if (coreSub) coreSub.textContent = isConn ? 'Connected' : "Wi-Fi";
        if (root) {
            root.style.setProperty('--accent-glow', isConn ? 'rgba(116, 199, 236, 0.4)' : 'rgba(137, 180, 250, 0.2)');
            root.style.setProperty('--accent-color', isConn ? 'var(--sapphire)' : 'var(--blue)');
        }

        // Determine view: info cards or device list
        showInfoView = isConn;
        
        if (showInfoView) {
            const infoNodes = buildInfoNodes('wifi', mainInfo);
            distributeInfoNodes(infoNodes);
        } else {
            const nodePool = (arrayData || []).map(nw => ({
                id: nw.ssid,
                name: nw.ssid,
                status: nw.signal ? `${nw.signal}% (${nw.auth || ''})` : '',
                icon: nw.signal > 50 ? '󰤥' : '󰤢',
                isConnected: false,
                color: 'var(--text)'
            }));
            distributeDeviceNodes(nodePool);
        }
    } else {
        const isConn = mainInfo.isConnected;
        let cName = mainInfo.device || "NO DEVICE";
        if (!mainInfo.isOn) cName = "BT OFF";
        if (coreIcon) coreIcon.innerHTML = isConn ? '󰋋' : (mainInfo.isOn ? '󰂯' : '󰂲');
        if (coreLabel) coreLabel.textContent = cName;
        if (coreSub) coreSub.textContent = isConn ? "Connected" : (mainInfo.isOn ? "DISCONNECTED" : "ADAPTER OFF");
        if (root) {
            root.style.setProperty('--accent-glow', isConn ? 'rgba(203, 166, 247, 0.4)' : 'rgba(243, 139, 168, 0.2)');
            root.style.setProperty('--accent-color', isConn ? 'var(--mauve)' : 'var(--red)');
        }

        showInfoView = isConn;
        
        if (showInfoView) {
            const infoNodes = buildInfoNodes('bluetooth', mainInfo);
            distributeInfoNodes(infoNodes);
        } else {
            const nodePool = (arrayData || []).map(bt => ({
                id: bt.name,
                name: bt.name,
                status: bt.status,
                icon: bt.status === 'Connected' ? '󰂱' : '󰂯',
                isConnected: bt.status === 'Connected',
                color: bt.status === 'Connected' ? 'var(--green)' : 'var(--blue)'
            }));
            distributeDeviceNodes(nodePool);
        }
    }
}

function distributeInfoNodes(infoNodes) {
    const container = document.getElementById('net-nodes-container');
    const overflowList = document.getElementById('net-overflow');
    if (!container || !overflowList) return;
    
    container.innerHTML = '';
    overflowList.innerHTML = '';
    overflowList.style.display = 'none';
    activeNodes = [];

    const numNodes = infoNodes.length;
    const baseR = 185;

    for (let i = 0; i < numNodes; i++) {
        const n = infoNodes[i];
        // Arrange in ring around core
        const angle = (Math.PI * 2 * i) / numNodes - (Math.PI / 2);
        const rVariance = (i % 2 === 0) ? baseR : baseR + 40;
        const tgtX = centerCorePos.x + Math.cos(angle) * rVariance;
        const tgtY = centerCorePos.y + Math.sin(angle) * rVariance;

        const nodeEl = document.createElement('div');
        nodeEl.className = `net-orbit-node net-info-card ${n.isAction ? 'net-action-card' : ''}`;
        nodeEl.style.transform = 'translate(-50%, -50%)';
        nodeEl.style.left = `${centerCorePos.x}px`;
        nodeEl.style.top = `${centerCorePos.y}px`;
        nodeEl.style.opacity = '0';
        nodeEl.style.pointerEvents = n.isAction ? 'auto' : 'none';

        nodeEl.innerHTML = `
            <span class="net-node-icon" style="color:${n.color}">${n.icon}</span>
            <div class="net-node-info">
                <span class="net-node-name">${n.name}</span>
                <span class="net-node-status">${n.action}</span>
            </div>
        `;

        if (n.isAction) {
            nodeEl.addEventListener('click', () => {
                showInfoView = false;
                updateNetworkData();
            });
        }

        container.appendChild(nodeEl);

        activeNodes.push({
            el: nodeEl,
            x: centerCorePos.x,
            y: centerCorePos.y,
            tgtX, tgtY,
            phase: Math.random() * Math.PI * 2,
            isConnected: true,
            color: n.color === 'var(--green)' ? '#A6E3A1' : 
                   n.color === 'var(--blue)' ? '#89B4FA' :
                   n.color === 'var(--sapphire)' ? '#74C7EC' :
                   n.color === 'var(--mauve)' ? '#CBA6F7' :
                   n.color === 'var(--pink)' ? '#F5C2E7' :
                   '#CDD6F4'
        });

        setTimeout(() => {
            nodeEl.style.transition = 'left 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease';
            nodeEl.style.left = tgtX + 'px';
            nodeEl.style.top = tgtY + 'px';
            nodeEl.style.opacity = '1';
        }, 50 * i);
    }
}

function distributeDeviceNodes(nodePool) {
    const container = document.getElementById('net-nodes-container');
    const overflowList = document.getElementById('net-overflow');
    if (!container || !overflowList) return;
    
    container.innerHTML = '';
    overflowList.innerHTML = '';
    
    nodePool.sort((a,b) => (b.isConnected ? 1 : 0) - (a.isConnected ? 1 : 0));
    
    const numOrbits = Math.min(nodePool.length, 6);
    activeNodes = [];

    const r1 = 180;
    const r2 = 280;

    for (let i = 0; i < nodePool.length; i++) {
        const n = nodePool[i];
        if (i < numOrbits) {
            const angle = (Math.PI * 2 * i) / numOrbits - (Math.PI / 2);
            const myR = (i % 2 === 0) ? r1 : r2;
            const tgtX = centerCorePos.x + Math.cos(angle) * myR;
            const tgtY = centerCorePos.y + Math.sin(angle) * myR;
            
            const nodeEl = document.createElement('div');
            nodeEl.className = `net-orbit-node ${n.isConnected ? 'net-node-active' : ''}`;
            nodeEl.style.transform = `translate(-50%, -50%)`;
            nodeEl.style.left = `${centerCorePos.x}px`;
            nodeEl.style.top = `${centerCorePos.y}px`;
            nodeEl.style.opacity = '0';
            nodeEl.style.pointerEvents = 'auto';
            
            nodeEl.innerHTML = `
                <span class="net-node-icon" style="color:${n.color}">${n.icon}</span>
                <div class="net-node-info">
                    <span class="net-node-name">${n.name}</span>
                    <span class="net-node-status">${n.status}</span>
                </div>
            `;
            container.appendChild(nodeEl);
            
            activeNodes.push({
                el: nodeEl,
                x: centerCorePos.x, y: centerCorePos.y,
                tgtX, tgtY,
                phase: Math.random() * Math.PI * 2,
                isConnected: n.isConnected,
                color: n.isConnected ? '#A6E3A1' : (currentNetTab === 'wifi' ? '#BAC2DE' : '#89B4FA')
            });
            
            setTimeout(() => {
                nodeEl.style.transition = 'left 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease';
                nodeEl.style.left = tgtX + 'px';
                nodeEl.style.top = tgtY + 'px';
                nodeEl.style.opacity = '1';
            }, 50 * i);
            
        } else {
            overflowList.style.display = 'flex';
            const li = document.createElement('div');
            li.className = 'net-list-item';
            li.innerHTML = `<span class="net-tab-icon" style="color:${n.color}">${n.icon}</span> <div style="display:flex; flex-direction:column"><span style="font-family:'JetBrains Mono';font-size:12px;color:var(--text)">${n.name}</span><span style="font-family:'JetBrains Mono';font-size:10px;color:var(--subtext0)">${n.status}</span></div>`;
            overflowList.appendChild(li);
        }
    }
    
    if (numOrbits >= nodePool.length) {
        overflowList.style.display = 'none';
    }
}

async function updateNetworkData() {
    if (!window.electronAPI) return;
    
    try {
        if (currentNetTab === 'wifi') {
            const main = await window.electronAPI.getNetwork();
            const list = await window.electronAPI.getNetworkList();
            currentSystemState.wifi = { main, list };
            processAndRender('wifi', main, list);
        } else {
            const main = await window.electronAPI.getBluetooth();
            const list = await window.electronAPI.getBluetoothDevices();
            currentSystemState.bt = { main, list };
            processAndRender('bluetooth', main, list);
        }
    } catch (e) {
        console.error("Net Graph Error", e);
    }
}

function setupNetworkInteractions(batPanel) {
    const tabW = document.getElementById('tab-w');
    const tabB = document.getElementById('tab-b');
    
    const switchTab = (name) => {
        if (currentNetTab === name) return;
        currentNetTab = name;
        showInfoView = false;
        
        if (name === 'wifi') {
            tabW.classList.add('active'); tabB.classList.remove('active');
        } else {
            tabB.classList.add('active'); tabW.classList.remove('active');
        }
        
        activeNodes.forEach(an => {
            an.el.style.left = centerCorePos.x + 'px';
            an.el.style.top = centerCorePos.y + 'px';
            an.el.style.opacity = '0';
        });
        
        setTimeout(() => updateNetworkData(), 300);
    };

    if(tabW) tabW.addEventListener('click', () => switchTab('wifi'));
    if(tabB) tabB.addEventListener('click', () => switchTab('bluetooth'));

    const observer = new MutationObserver((mutations) => {
        if (!document.body.contains(batPanel)) {
            cancelAnimationFrame(netAnimFrame);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function renderNetworkCanvas(time) {
    const canvas = document.getElementById('net-canvas');
    if (!canvas) return;

    let dt = Math.min((time - lastNetTime) / 1000, 0.1);
    lastNetTime = time;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    activeNodes.forEach(node => {
        node.phase += dt * 2.0;
        
        const rect = node.el.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        const nx = rect.left - canvasRect.left + rect.width / 2;
        const ny = rect.top - canvasRect.top + rect.height / 2;
        
        const waveAmp = node.isConnected ? 35 : 15;
        const freq = node.isConnected ? 4.0 : 2.0;

        // Base line
        ctx.beginPath();
        ctx.moveTo(centerCorePos.x, centerCorePos.y);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = node.isConnected ? 0.3 : 0.05;
        ctx.stroke();

        // Animated sine strand
        ctx.beginPath();
        ctx.moveTo(centerCorePos.x, centerCorePos.y);
        
        const dist = Math.hypot(nx - centerCorePos.x, ny - centerCorePos.y);
        const segments = 20;
        
        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const px = centerCorePos.x + (nx - centerCorePos.x) * t;
            const py = centerCorePos.y + (ny - centerCorePos.y) * t;
            
            const dx = (nx - centerCorePos.x) / (dist || 1);
            const dy = (ny - centerCorePos.y) / (dist || 1);
            const perpX = -dy;
            const perpY = dx;
            
            const envelope = Math.sin(t * Math.PI);
            const w = Math.sin(t * Math.PI * freq - node.phase) * waveAmp * envelope;
            
            ctx.lineTo(px + perpX * w, py + perpY * w);
        }

        ctx.strokeStyle = node.color;
        ctx.lineWidth = node.isConnected ? 3 : 1.5;
        ctx.globalAlpha = node.isConnected ? 0.8 : 0.3;
        ctx.stroke();
        
        // Particle
        let partT = (node.phase / freq) % 1;
        if (partT < 1) {
            const bx = centerCorePos.x + (nx - centerCorePos.x) * partT;
            const by = centerCorePos.y + (ny - centerCorePos.y) * partT;
            ctx.beginPath();
            ctx.arc(bx, by, node.isConnected ? 4 : 2, 0, Math.PI*2);
            ctx.fillStyle = node.color;
            ctx.globalAlpha = 1;
            ctx.fill();
        }
    });

    netAnimFrame = requestAnimationFrame(renderNetworkCanvas);
}
