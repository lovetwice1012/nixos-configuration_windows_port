// ============================================================================
// モニターレイアウト管理 — MonitorPopup.qml マルチディスプレイ配置エディタ
// ============================================================================

let currentDisplays = [];
let draggingId = null;
let startX = 0, startY = 0;
let ix = 0, iy = 0;
let scaleFactor = 0.08; // 仮想空間(UI)と物理ピクセル空間の変換比率
let selectedId = null;
let hasModified = false;

function renderMonitorsWidget(container) {
    const batPanel = document.createElement('div');
    batPanel.className = 'widget-panel';
    batPanel.style.padding = '0';

    batPanel.innerHTML = `
    <div class="monitors-widget">
        <!-- ── Header ── -->
        <div class="mon-header">
            <div class="mon-title">
                <span class="mon-title-icon">󰍹</span> Displays
            </div>
            <button class="mon-apply-btn" id="mon-apply" style="display:none">APPLY CHANGES</button>
        </div>

        <!-- ── Layout Editor ── -->
        <div class="mon-workspace-wrap">
            <div class="mon-workspace" id="mon-workspace">
                <!-- Guide Lines -->
                <div class="mon-snap-guide-x" id="guide-x"></div>
                <div class="mon-snap-guide-y" id="guide-y"></div>
                <!-- JS Inject Screens Here -->
            </div>
        </div>

        <!-- ── Properties Panel ── -->
        <div class="mon-props-panel" id="mon-props">
            <div class="mon-prop-card">
                <div class="mon-prop-title">RESOLUTION</div>
                <div class="mon-prop-val" id="prop-res">0x0</div>
                <div class="mon-prop-sub" id="prop-scale">Scale: --</div>
            </div>
            <div class="mon-prop-card">
                <div class="mon-prop-title">POSITION</div>
                <div class="mon-prop-val" id="prop-pos">0, 0</div>
                <div class="mon-prop-sub">X, Y Coordinates</div>
            </div>
            <div class="mon-prop-card">
                <div class="mon-prop-title">STATUS</div>
                <div class="mon-prop-val" id="prop-primary">Active</div>
                <div class="mon-prop-sub" id="prop-freq">Refresh Rate</div>
            </div>
        </div>
    </div>`;

    container.appendChild(batPanel);

    setupMonitorsInteractions();
    loadMonitorsData();
}

async function loadMonitorsData() {
    if (!window.electronAPI) return;
    try {
        currentDisplays = await window.electronAPI.getMonitors();
        
        // Auto calculate scaleFactor so they all fit in the workspace
        if (currentDisplays.length > 0) {
            let maxX = 0, maxY = 0;
            currentDisplays.forEach(d => {
                let r = d.bounds.x + d.bounds.width;
                let b = d.bounds.y + d.bounds.height;
                if(r > maxX) maxX = r;
                if(b > maxY) maxY = b;
            });
            // Fixed roughly to fit inside 850x300 container
            scaleFactor = Math.min(600 / maxX, 250 / maxY) * 0.8;
            if(scaleFactor === 0 || !isFinite(scaleFactor)) scaleFactor = 0.08;
            selectedId = currentDisplays[0].id;
        }

        renderDisplayBlocks();
        updatePropertiesPanel();
    } catch (e) {
        console.error("Monitors Load Error", e);
    }
}

function renderDisplayBlocks() {
    const workspace = document.getElementById('mon-workspace');
    if (!workspace) return;
    
    // Clear old displays
    Array.from(workspace.children).forEach(c => {
        if (c.className.includes('mon-screen')) c.remove();
    });

    // 仮想空間のオフセット (0,0 を中央付近に配置)
    const baseOffsetX = workspace.offsetWidth / 2 - 200;
    const baseOffsetY = workspace.offsetHeight / 2 - 100;

    currentDisplays.forEach((d, index) => {
        const el = document.createElement('div');
        el.className = \`mon-screen \${d.isPrimary ? 'primary' : ''} \${d.id === selectedId ? 'selected' : ''}\`;
        el.id = \`mon-screen-\${d.id}\`;
        
        // Size mapping
        const w = d.bounds.width * scaleFactor;
        const h = d.bounds.height * scaleFactor;
        el.style.width = \`\${w}px\`;
        el.style.height = \`\${h}px\`;
        
        // Pos mapping
        const xp = baseOffsetX + (d.bounds.x * scaleFactor);
        const yp = baseOffsetY + (d.bounds.y * scaleFactor);
        el.style.left = \`\${xp}px\`;
        el.style.top = \`\${yp}px\`;
        
        // Inner Content
        el.innerHTML = \`
            <div class="mon-id" >\${index + 1}</div>
            <div class="mon-label">\${d.name} \${d.isPrimary ? '★' : ''}</div>
            <div class="mon-res">\${d.bounds.width}x\${d.bounds.height}</div>
        \`;

        // Interaction
        el.addEventListener('mousedown', (e) => {
            draggingId = d.id;
            selectedId = d.id;
            renderDisplayBlocks(); // update selection classes
            updatePropertiesPanel();
            
            startX = e.clientX;
            startY = e.clientY;
            ix = parseFloat(el.style.left);
            iy = parseFloat(el.style.top);
            
            workspace.style.cursor = 'grabbing';
            e.stopPropagation();
        });

        workspace.appendChild(el);
    });
}

function setupMonitorsInteractions() {
    const workspace = document.getElementById('mon-workspace');
    const gx = document.getElementById('guide-x');
    const gy = document.getElementById('guide-y');
    const applyBtn = document.getElementById('mon-apply');

    document.addEventListener('mousemove', (e) => {
        if (draggingId === null) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        let newX = ix + dx;
        let newY = iy + dy;

        // --- Snapping Logic (getPerimeterSnap equivalent) ---
        const SNAP_DIST = 15;
        const target = currentDisplays.find(d => d.id === draggingId);
        const tw = target.bounds.width * scaleFactor;
        const th = target.bounds.height * scaleFactor;
        
        // Find closest edge to snap among OTHER displays
        let snapXMatch = false, snapYMatch = false;

        currentDisplays.forEach(other => {
            if(other.id === draggingId) return;
            const elOther = document.getElementById(\`mon-screen-\${other.id}\`);
            if(!elOther) return;
            
            const ox = parseFloat(elOther.style.left);
            const oy = parseFloat(elOther.style.top);
            const ow = parseFloat(elOther.style.width);
            const oh = parseFloat(elOther.style.height);

            // Check Left/Right edges
            if (Math.abs(newX - ox) < SNAP_DIST) { newX = ox; snapXMatch = true; gx.style.left = newX + 'px'; } // Left-to-Left
            if (Math.abs(newX - (ox + ow)) < SNAP_DIST) { newX = ox + ow; snapXMatch = true; gx.style.left = newX + 'px'; } // Left-to-Right
            if (Math.abs((newX + tw) - ox) < SNAP_DIST) { newX = ox - tw; snapXMatch = true; gx.style.left = ox + 'px'; } // Right-to-Left
            if (Math.abs((newX + tw) - (ox + ow)) < SNAP_DIST) { newX = ox + ow - tw; snapXMatch = true; gx.style.left = (ox + ow) + 'px'; } // Right-to-Right
            
            // Check Top/Bottom edges
            if (Math.abs(newY - oy) < SNAP_DIST) { newY = oy; snapYMatch = true; gy.style.top = newY + 'px'; } 
            if (Math.abs(newY - (oy + oh)) < SNAP_DIST) { newY = oy + oh; snapYMatch = true; gy.style.top = newY + 'px'; } 
            if (Math.abs((newY + th) - oy) < SNAP_DIST) { newY = oy - th; snapYMatch = true; gy.style.top = oy + 'px'; } 
            if (Math.abs((newY + th) - (oy + oh)) < SNAP_DIST) { newY = oy + oh - th; snapYMatch = true; gy.style.top = (oy + oh) + 'px'; } 
        });

        gx.style.opacity = snapXMatch ? '1' : '0';
        gy.style.opacity = snapYMatch ? '1' : '0';

        const elDrag = document.getElementById(\`mon-screen-\${draggingId}\`);
        if(elDrag) {
            elDrag.style.left = newX + 'px';
            elDrag.style.top = newY + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        if(gx) gx.style.opacity = '0';
        if(gy) gy.style.opacity = '0';
        if(workspace) workspace.style.cursor = 'default';

        if (draggingId !== null) {
            // Write visual coordinate changes back to abstract data layer
            const elDrag = document.getElementById(\`mon-screen-\${draggingId}\`);
            const target = currentDisplays.find(d => d.id === draggingId);
            if (elDrag && target) {
                const baseOffsetX = workspace.offsetWidth / 2 - 200;
                const baseOffsetY = workspace.offsetHeight / 2 - 100;
                
                const cssX = parseFloat(elDrag.style.left);
                const cssY = parseFloat(elDrag.style.top);
                
                // Reverse translate physical bounds
                target.bounds.x = Math.round((cssX - baseOffsetX) / scaleFactor);
                target.bounds.y = Math.round((cssY - baseOffsetY) / scaleFactor);
                
                hasModified = true;
                if(applyBtn) applyBtn.style.display = 'block';
                updatePropertiesPanel();
            }
            draggingId = null;
        }
    });
    
    // Apply Button Native IPC Bridge
    if(applyBtn) {
        applyBtn.addEventListener('click', async () => {
             // Submits topology changes directly to system backend
             if(window.electronAPI) {
                 applyBtn.textContent = 'APPLYING...';
                 const res = await window.electronAPI.setTopology(currentDisplays);
                 setTimeout(() => {
                    applyBtn.textContent = res ? 'APPLIED!' : 'ERROR';
                    setTimeout(() => applyBtn.style.display = 'none', 1500);
                 }, 400);
                 hasModified = false;
             }
        });
    }
}

function updatePropertiesPanel() {
    const props = document.getElementById('mon-props');
    if (!props) return;
    
    if (selectedId === null) {
        props.classList.remove('visible');
        return;
    }
    
    const d = currentDisplays.find(x => x.id === selectedId);
    if (!d) return;

    document.getElementById('prop-res').textContent = \`\${d.bounds.width}x\${d.bounds.height}\`;
    document.getElementById('prop-scale').textContent = \`Scale: \${d.scaleFactor * 100}%\`;
    document.getElementById('prop-pos').textContent = \`\${d.bounds.x}, \${d.bounds.y}\`;
    document.getElementById('prop-primary').textContent = d.isPrimary ? 'Primary Display' : 'Extended';
    document.getElementById('prop-primary').style.color = d.isPrimary ? 'var(--green)' : 'var(--text)';
    
    props.classList.add('visible');
}
