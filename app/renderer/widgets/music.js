// ============================================================================
// 音楽プレーヤーウィジェット — Native C++ 完全対応プレミアム版
// ============================================================================

const EQ_BANDS = ['31', '63', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
const EQ_PRESETS = {
    Flat:    [50,50,50,50,50,50,50,50,50,50],
    Bass:    [80,75,65,55,50,50,50,50,50,50],
    Treble:  [50,50,50,50,50,55,65,75,80,85],
    Vocal:   [40,45,55,70,75,75,65,55,45,40],
    Pop:     [60,65,55,50,55,60,65,60,55,50],
    Rock:    [70,65,50,45,55,60,65,65,60,55],
    Jazz:    [55,55,60,65,55,55,60,65,70,65],
    Classic: [60,55,50,55,50,45,50,60,65,65],
};

let currentPreset = 'Flat';
let eqValues = [...EQ_PRESETS.Flat];
let isSeeking = false;
let seekTimeout = null;
let lastArtUrl = '';

// Animation state
let animFrame = null;
let eqLightningProgress = 0;
let eqLightningFade = 1.0;
let eqLightningAnimating = false;
let startTime = 0;

function renderMusicWidget(container) {
    const panel = document.createElement('div');
    panel.className = 'widget-panel';
    panel.style.padding = '0'; 
    panel.innerHTML = `
    <div class="music-widget" id="music-widget">
        <!-- Ambient Background -->
        <div class="music-ambient-bg">
            <img class="music-blur-img" id="music-blur-img" src="" />
            <div class="music-flow-orbit primary" id="orbit-pri"></div>
            <div class="music-flow-orbit secondary" id="orbit-sec"></div>
        </div>

        <div class="music-top">
            <div class="music-art-container" id="music-art-container">
                <div class="music-art-glow"></div>
                <div class="music-art-img-wrap">
                    <img class="music-art-img" id="music-art-main" src="" />
                    <div class="music-art-placeholder" id="music-art-placeholder">󰎈</div>
                    <div class="music-art-dimmer"></div>
                </div>
            </div>

            <div class="music-info">
                <div class="music-song-title" id="music-song-title">No Media Playing</div>
                <div class="music-artist" id="music-artist-name">—</div>
                <div class="music-device-badges">
                    <div class="music-badge"><span class="badge-icon">󰂱</span> <span id="music-device">Speaker</span></div>
                    <div class="music-badge" style="color:var(--peach);"><span class="badge-icon">󰓃</span> <span id="music-source">Offline</span></div>
                </div>

                <div class="music-progress-container">
                    <span class="music-progress-time" id="music-time-current">00:00</span>
                    <div class="music-progress-bar" id="music-progress-bar">
                        <div class="music-progress-fill-mask" id="music-progress-fill">
                            <div class="music-progress-fill-gradient"></div>
                        </div>
                        <div class="music-progress-thumb" id="music-progress-thumb"></div>
                    </div>
                    <span class="music-progress-time" id="music-time-total">00:00</span>
                </div>

                <div class="music-controls">
                    <button class="music-ctrl-btn" id="music-btn-prev">󰒮</button>
                    <button class="music-ctrl-btn play" id="music-btn-play">󰐊</button>
                    <button class="music-ctrl-btn" id="music-btn-next">󰒭</button>
                </div>
            </div>
        </div>

        <div class="music-eq-section">
            <canvas class="eq-lightning-canvas" id="eq-lightning"></canvas>
            <div class="music-eq-header">
                <span class="music-eq-title">WASAPI Phase Canceller</span>
                <select id="eq-session-select" class="music-eq-session-select">
                    <option value="0">System Default Output</option>
                </select>
                <span class="music-eq-saved">Saved <span id="eq-preset-name">${currentPreset}</span></span>
            </div>
            <div class="music-eq-sliders" id="eq-sliders">
                ${EQ_BANDS.map((band, i) => `
                    <div class="music-eq-slider">
                        <div class="music-eq-track" data-band="${i}">
                            <div class="music-eq-fill" style="height:${eqValues[i]}%"></div>
                            <div class="music-eq-thumb" style="bottom:calc(${eqValues[i]}% - 7px)"></div>
                        </div>
                        <span class="music-eq-label">${band}</span>
                    </div>
                `).join('')}
            </div>
            <div class="music-eq-presets" id="eq-presets">
                ${Object.keys(EQ_PRESETS).map(p =>
                    `<div class="music-eq-preset${p === currentPreset ? ' active' : ''}" data-preset="${p}">${p}</div>`
                ).join('')}
            </div>
        </div>
    </div>`;

    container.appendChild(panel);

    setTimeout(() => {
        setupMusicEvents();
        updateMusicData();
        loadAudioSessions();
        window.widgetUpdateInterval = setInterval(updateMusicData, 500);
        triggerLightning(); // Sync canvas dimensions
        animFrame = requestAnimationFrame(renderLightningLoop);
        
        // Listen for true WASAPI audio visualizer data
        if (window.electronAPI) {
            window.electronAPI.onEqVisualizer((pcmFloatArray) => {
                if (!pcmFloatArray || pcmFloatArray.length === 0) return;
                // Compute RMS to detect peaks
                let sumSq = 0;
                for (let i = 0; i < pcmFloatArray.length; i++) {
                    sumSq += pcmFloatArray[i] * pcmFloatArray[i];
                }
                const rms = Math.sqrt(sumSq / pcmFloatArray.length);
                // Trigger lightning if peak is strong enough
                if (rms > 0.05 && !eqLightningAnimating) {
                    triggerLightning();
                }
            });
        }
    }, 50);
}

async function loadAudioSessions() {
    if (!window.electronAPI) return;
    const select = document.getElementById('eq-session-select');
    if (!select) return;
    try {
        const sessions = await window.electronAPI.eqGetSessions();
        sessions.forEach(s => {
            if (s.pid > 0 && s.name) {
                const opt = document.createElement('option');
                opt.value = s.pid;
                opt.textContent = `${s.name} (PID: ${s.pid})`;
                select.appendChild(opt);
            }
        });
        
        select.addEventListener('change', async (e) => {
            const pid = parseInt(e.target.value);
            await window.electronAPI.eqStop();
            // Map frequencies to bands
            commitToNative();
            if (pid > 0) {
                await window.electronAPI.eqStart(pid);
            }
        });
    } catch(e){}
}

function triggerLightning() {
    eqLightningAnimating = true;
    eqLightningProgress = 0;
    eqLightningFade = 0;
    startTime = performance.now();
    const cvs = document.getElementById('eq-lightning');
    if(cvs) { cvs.width = cvs.offsetWidth; cvs.height = cvs.offsetHeight; cvs.classList.add('flash'); }
}

function renderLightningLoop(time) {
    if (!eqLightningAnimating) {
        animFrame = requestAnimationFrame(renderLightningLoop);
        return;
    }

    const elapsed = time - startTime;
    // SequentialAnimation timing: Flash (650ms), hold (150ms), fade (800ms)
    
    if (elapsed < 650) {
        eqLightningProgress = (elapsed / 650) * 10.0;
        eqLightningFade = 0.0;
    } else if (elapsed < 800) {
        eqLightningProgress = 10.0;
        eqLightningFade = 0.0;
    } else if (elapsed < 1600) {
        eqLightningProgress = 10.0;
        eqLightningFade = (elapsed - 800) / 800; 
    } else {
        eqLightningProgress = 0;
        eqLightningFade = 1.0;
        eqLightningAnimating = false;
        const cvs = document.getElementById('eq-lightning');
        if(cvs) cvs.classList.remove('flash');
    }

    drawLightning();
    animFrame = requestAnimationFrame(renderLightningLoop);
}

function drawLightning() {
    const canvas = document.getElementById('eq-lightning');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0,0,w,h);
    
    if (eqLightningFade >= 1.0) return;

    ctx.save();
    ctx.globalAlpha = 1.0 - eqLightningFade;

    // Draw striking branches based on progress
    ctx.strokeStyle = '#cba6f7'; // Mauve lightning
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#cba6f7';

    // The lightning shoots across the EQ sliders horizontally
    ctx.beginPath();
    ctx.moveTo(10, h/2);
    
    let currentX = 10;
    let maxSegments = Math.floor(eqLightningProgress); // 0 to 10
    
    for(let i=1; i<=maxSegments; i++) {
        let nX = 10 + (w - 20) * (i / 10.0);
        let nY = (h/2) + (Math.random() * 40 - 20); 
        ctx.lineTo(nX, nY);
        currentX = nX;
    }
    
    ctx.stroke();

    // Additional secondary faint flashes
    if(maxSegments > 5) {
        ctx.fillStyle = 'rgba(203, 166, 247, 0.15)';
        ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
}

function setupMusicEvents() {
    const btnPrev = document.getElementById('music-btn-prev');
    const btnPlay = document.getElementById('music-btn-play');
    const btnNext = document.getElementById('music-btn-next');

    if (btnPrev) btnPrev.addEventListener('click', () => { if (window.electronAPI) window.electronAPI.mediaPrevious(); });
    if (btnPlay) btnPlay.addEventListener('click', () => { if (window.electronAPI) window.electronAPI.mediaPlayPause(); });
    if (btnNext) btnNext.addEventListener('click', () => { if (window.electronAPI) window.electronAPI.mediaNext(); });

    // Progress Bar Seeking
    const progBar = document.getElementById('music-progress-bar');
    if (progBar) {
        let dragging = false;
        const commitSeek = (clientX) => {
            const rect = progBar.getBoundingClientRect();
            let pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            
            const fill = document.getElementById('music-progress-fill');
            const thumb = document.getElementById('music-progress-thumb');
            if (fill) fill.style.width = `${pct * 100}%`;
            if (thumb) thumb.style.left = `${pct * 100}%`;

            clearTimeout(seekTimeout);
            seekTimeout = setTimeout(() => {
                isSeeking = false;
            }, 500);
        };
        progBar.addEventListener('mousedown', (e) => { isSeeking = true; dragging = true; commitSeek(e.clientX); });
        document.addEventListener('mousemove', (e) => { if (dragging) commitSeek(e.clientX); });
        document.addEventListener('mouseup', () => { dragging = false; });
    }

    // NATIVE C++ EQ PRESETS
    document.querySelectorAll('.music-eq-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            if (EQ_PRESETS[preset]) {
                currentPreset = preset;
                eqValues = [...EQ_PRESETS[preset]];
                
                // Update UI + Trigger Canvas
                updateEQSliders();
                triggerLightning();
                
                document.querySelectorAll('.music-eq-preset').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (document.getElementById('eq-preset-name')) document.getElementById('eq-preset-name').textContent = preset;

                commitToNative();
            }
        });
    });

    // EQ Sliders Drag
    document.querySelectorAll('.music-eq-track').forEach(track => {
        let dragging = false;
        const bandIndex = parseInt(track.dataset.band);
        const updateFromY = (clientY) => {
            const rect = track.getBoundingClientRect();
            const pct = Math.max(0, Math.min(100, ((rect.bottom - clientY) / rect.height) * 100));
            eqValues[bandIndex] = Math.round(pct);
            updateEQSliders();
        };

        track.addEventListener('mousedown', (e) => { dragging = true; updateFromY(e.clientY); });
        document.addEventListener('mousemove', (e) => { if (dragging) updateFromY(e.clientY); });
        document.addEventListener('mouseup', () => { if(dragging){ dragging = false; commitToNative(); }});
        track.addEventListener('mouseleave', () => { if(dragging){ dragging = false; commitToNative(); }});
    });
}

function commitToNative() {
    if (!window.electronAPI) return;
    const bandFreqs = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    for (let i = 0; i < eqValues.length; i++) {
        // Values are 0-100. Let's map 50 to 0dB, 100 to +12dB, 0 to -12dB.
        const gainDB = (eqValues[i] - 50.0) * (24.0 / 50.0);
        window.electronAPI.eqSetBand(i, bandFreqs[i], gainDB, 1.414);
    }
}

function updateEQSliders() {
    document.querySelectorAll('.music-eq-track').forEach((track, i) => {
        const fill = track.querySelector('.music-eq-fill');
        const thumb = track.querySelector('.music-eq-thumb');
        if (fill) fill.style.height = `${eqValues[i]}%`;
        if (thumb) thumb.style.bottom = `calc(${eqValues[i]}% - 7px)`;
    });
}

async function updateMusicData() {
    if (!window.electronAPI) return;
    try {
        const media = await window.electronAPI.getMedia();
        const titleEl = document.getElementById('music-song-title');
        const artistEl = document.getElementById('music-artist-name');
        const playBtn = document.getElementById('music-btn-play');
        const artContainer = document.getElementById('music-art-container');
        const blurImg = document.getElementById('music-blur-img');
        const mainImg = document.getElementById('music-art-main');
        const orbit1 = document.getElementById('orbit-pri');
        const orbit2 = document.getElementById('orbit-sec');
        
        const isPlaying = media.status === 'Playing';

        if (titleEl) titleEl.textContent = media.title || 'No Media Playing';
        if (artistEl) artistEl.textContent = media.artist ? `BY ${media.artist}` : '—';
        if (playBtn) playBtn.textContent = isPlaying ? '󰏤' : '󰐊';
        if (document.getElementById('music-source')) document.getElementById('music-source').textContent = media.source || 'Offline';

        if (artContainer) {
            if (isPlaying) artContainer.classList.add('playing');
            else artContainer.classList.remove('playing');
        }
        if (orbit1) orbit1.classList.toggle('active', isPlaying);
        if (orbit2) orbit2.classList.toggle('active', isPlaying);

        if (media.artUrl && media.artUrl !== lastArtUrl) {
            lastArtUrl = media.artUrl;
            if (mainImg) {
                mainImg.src = media.artUrl;
                mainImg.classList.add('visible');
            }
            if (blurImg) {
                blurImg.src = media.artUrl;
                blurImg.classList.add('visible');
            }
        } else if (!media.artUrl && lastArtUrl) {
            lastArtUrl = '';
            if (mainImg) mainImg.classList.remove('visible');
            if (blurImg) blurImg.classList.remove('visible');
        }

        if (!isSeeking && media.duration > 0) {
            document.getElementById('music-time-current').textContent = formatTime(media.position);
            document.getElementById('music-time-total').textContent = formatTime(media.duration);
            const pct = (media.position / media.duration) * 100;
            document.getElementById('music-progress-fill').style.width = `${pct}%`;
            document.getElementById('music-progress-thumb').style.left = `${pct}%`;
        }

    } catch(e) {}
}

function formatTime(secs) {
    if (!secs || isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
