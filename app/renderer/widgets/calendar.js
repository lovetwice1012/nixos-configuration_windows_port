// ============================================================================
// カレンダー＆天気ダッシュボード — CalendarPopup.qml 完全再現
// Center: Giant Clock + Elliptical Orbit
// Left:   Glass Calendar Grid
// Right:  Weather Stats + 4 SVG Gauges
// Bottom: Schedule + Animated Sine Waves
// ============================================================================

let calendarAnimFrame = null;
let globalOrbitAngle = 0;
let calendarData = { hourly: [], current: {}, forecast: [] };

// Temp Lerp
let displayedTemp = 0;
let targetTemp = 0;

// Sine wave phases
let wavePhase1 = 0, wavePhase2 = 0, wavePhase3 = 0;

// Schedule data (fetched from Google Calendar API)
let scheduleData = {
    header: 'Loading schedule...',
    link: '',
    lessons: []
};

function getTimeColors(hour) {
    if (hour >= 5 && hour < 12) return { main: 'var(--peach)', accent: 'var(--yellow)', accentHex: '#f9e2af' };
    if (hour >= 12 && hour < 17) return { main: 'var(--sapphire)', accent: 'var(--teal)', accentHex: '#94e2d5' };
    if (hour >= 17 && hour < 21) return { main: 'var(--mauve)', accent: 'var(--pink)', accentHex: '#f5c2e7' };
    return { main: 'var(--blue)', accent: 'var(--mauve)', accentHex: '#cba6f7' };
}

function renderCalendarWidget(container) {
    const now = new Date();
    let viewYear = now.getFullYear();
    let viewMonth = now.getMonth();

    const panel = document.createElement('div');
    panel.className = 'widget-panel';
    panel.style.padding = '0';
    panel.innerHTML = `<div class="cal-widget" id="cal-widget-root">${buildDashboardHTML(viewYear, viewMonth, now)}</div>`;
    container.appendChild(panel);

    fetchWeatherData();
    fetchScheduleData();

    // ── Animation Loop ──
    let lastTime = performance.now();
    const animate = (time) => {
        const dt = (time - lastTime) / 1000;
        lastTime = time;

        globalOrbitAngle += (Math.PI * 2) * (dt / 90); // 90s full rotation
        if (globalOrbitAngle > Math.PI * 2) globalOrbitAngle -= Math.PI * 2;

        updateOrbitPositions();
        updateTempLerp(dt);
        drawScheduleWaves(dt);

        calendarAnimFrame = requestAnimationFrame(animate);
    };
    calendarAnimFrame = requestAnimationFrame(animate);

    // ── Clock update every second ──
    window.widgetUpdateInterval = setInterval(() => {
        const d = new Date();
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        const s = String(d.getSeconds()).padStart(2, '0');

        const clkEl = document.getElementById('cal-hero-clock');
        const secEl = document.getElementById('cal-hero-seconds');
        if (clkEl) clkEl.textContent = `${h}:${m}`;
        if (secEl) {
            secEl.textContent = `:${s}`;
            secEl.classList.remove('pulse');
            void secEl.offsetWidth;
            secEl.classList.add('pulse');
        }

        const dateEl = document.getElementById('cal-hero-date');
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        if (dateEl) dateEl.textContent = `${days[d.getDay()]}, ${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;

        applyTimeColors(d.getHours());
    }, 1000);

    applyTimeColors(now.getHours());

    // ── Calendar Navigation ──
    setTimeout(() => {
        const prevBtn = document.getElementById('cal-nav-prev');
        const nextBtn = document.getElementById('cal-nav-next');
        const homeBtn = document.getElementById('cal-nav-home');
        const plusBtn = document.getElementById('cal-nav-plus');

        if (prevBtn) prevBtn.addEventListener('click', () => { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } updateCalGrid(viewYear, viewMonth, now); });
        if (nextBtn) nextBtn.addEventListener('click', () => { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } updateCalGrid(viewYear, viewMonth, now); });
        if (homeBtn) homeBtn.addEventListener('click', () => { viewYear = now.getFullYear(); viewMonth = now.getMonth(); updateCalGrid(viewYear, viewMonth, now); });

        // Day nav
        const dayPrev = document.getElementById('weather-nav-prev');
        const dayNext = document.getElementById('weather-nav-next');
        if (dayPrev) dayPrev.addEventListener('click', () => switchWeatherDay(-1));
        if (dayNext) dayNext.addEventListener('click', () => switchWeatherDay(1));

        // Staggered intro
        setTimeout(() => { const el = document.querySelector('.cal-hero-hub'); if (el) el.classList.add('show'); }, 250);
        setTimeout(() => { const el = document.querySelector('.cal-glass-calendar'); if (el) el.classList.add('show'); }, 350);
        setTimeout(() => { const el = document.querySelector('.cal-weather-section'); if (el) el.classList.add('show'); }, 400);
        setTimeout(() => { const el = document.querySelector('.cal-schedule-section'); if (el) el.classList.add('show'); }, 500);

        // Draw orbit ellipse
        drawOrbitEllipse();
    }, 50);

    // Cleanup observer
    const observer = new MutationObserver(() => {
        if (!document.body.contains(panel)) { cancelAnimationFrame(calendarAnimFrame); observer.disconnect(); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// ── Current weather day view ──
let weatherViewIdx = 0;

function switchWeatherDay(dir) {
    const newIdx = weatherViewIdx + dir;
    if (newIdx < 0 || newIdx > 4) return;
    weatherViewIdx = newIdx;
    updateWeatherDisplay();
}

// ── Build Dashboard HTML ──
function buildDashboardHTML(year, month, today) {
    const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    const weekdays = ['Mo','Tu','We','Th','Fr','Sa','Su'];
    const h = String(today.getHours()).padStart(2, '0');
    const m = String(today.getMinutes()).padStart(2, '0');
    const s = String(today.getSeconds()).padStart(2, '0');
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const mNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dateStr = `${days[today.getDay()]}, ${mNames[today.getMonth()]} ${String(today.getDate()).padStart(2, '0')}`;

    return `
    <!-- Ambient Blobs -->
    <div class="cal-ambient-blobs">
        <div class="ambient-blob weather" id="amb-weather"></div>
        <div class="ambient-blob time" id="amb-time"></div>
        <div class="ambient-blob accent" id="amb-accent"></div>
    </div>

    <!-- Big Background Icon -->
    <div class="cal-bg-weather-icon" id="cal-bg-icon">󰖙</div>

    <!-- ═══════ CENTER: Hero Clock + Orbit ═══════ -->
    <div class="cal-hero-section">
        <div class="cal-hero-hub" id="cal-hero-hub">
            <canvas class="cal-orbit-canvas" id="cal-orbit-canvas" width="640" height="280"></canvas>

            <div class="cal-hero-time-row">
                <span class="cal-hero-clock" id="cal-hero-clock">${h}:${m}</span>
                <span class="cal-hero-seconds pulse" id="cal-hero-seconds">:${s}</span>
            </div>
            <div class="cal-hero-date" id="cal-hero-date">${dateStr}</div>

            <div class="cal-orbit-container" id="cal-orbit-container"></div>
        </div>
    </div>

    <!-- ═══════ LEFT: Glass Calendar ═══════ -->
    <div class="cal-glass-calendar" id="cal-glass-calendar">
        <div class="cal-glass-cal-header">
            <div class="cal-glass-nav-btn" id="cal-nav-home">󰃭</div>
            <div class="cal-glass-nav-btn" id="cal-nav-prev"></div>
            <div class="cal-glass-month" id="cal-month-title">${months[month]} ${year}</div>
            <div class="cal-glass-nav-btn" id="cal-nav-next"></div>
            <div class="cal-glass-nav-btn" id="cal-nav-plus" style="font-size:32px;">+</div>
        </div>
        <div class="cal-glass-weekdays">${weekdays.map(d => `<div>${d}</div>`).join('')}</div>
        <div class="cal-glass-days" id="cal-days-grid">${buildDaysGrid(year, month, today)}</div>
    </div>

    <!-- ═══════ RIGHT: Weather Stats ═══════ -->
    <div class="cal-weather-section" id="cal-weather-section">
        <div class="cal-weather-nav">
            <button class="cal-weather-nav-btn" id="weather-nav-prev"></button>
            <span class="cal-weather-day-label" id="weather-day-label">FRIDAY</span>
            <button class="cal-weather-nav-btn" id="weather-nav-next"></button>
        </div>

        <div class="cal-weather-temp-block">
            <div class="cal-weather-big-temp" id="weather-big-temp">--°</div>
            <div class="cal-weather-desc" id="weather-desc">Loading...</div>
        </div>

        <div style="flex:1"></div>

        <div class="cal-weather-gauges" id="weather-gauges">
            ${buildGaugeHTML('', '--', 'WIND', 0)}
            ${buildGaugeHTML('', '--%', 'HUMID', 0)}
            ${buildGaugeHTML('', '--%', 'RAIN', 0)}
            ${buildGaugeHTML('', '--°', 'FEELS', 0)}
        </div>
    </div>

    <!-- ═══════ BOTTOM: Schedule ═══════ -->
    <div class="cal-schedule-section" id="cal-schedule-section">
        <div class="cal-schedule-gradient"></div>
        <div class="cal-schedule-divider"></div>
        <canvas class="cal-schedule-waves" id="cal-schedule-waves"></canvas>

        <div class="cal-schedule-content">
            <div class="cal-schedule-header">
                <div class="cal-schedule-icon-bubble" id="schedule-icon"></div>
                <div class="cal-schedule-title" id="schedule-title">${scheduleData.header}</div>
                <div class="cal-schedule-link" id="schedule-link">
                    <span>Open Web</span>
                    <span class="link-icon"></span>
                </div>
            </div>

            <div class="cal-schedule-items" id="schedule-items">
                ${buildScheduleItems()}
            </div>
        </div>
    </div>`;
}

function buildGaugeHTML(icon, val, label, fill) {
    return `
    <div class="cal-gauge-item" data-fill="${fill}" data-label="${label}">
        <div class="cal-gauge-circle">
            <canvas width="136" height="136" style="width:68px;height:68px;"></canvas>
            <div class="cal-gauge-value">${val}</div>
        </div>
        <div class="cal-gauge-label">
            <span class="gauge-icon">${icon}</span>
            <span>${label}</span>
        </div>
    </div>`;
}

function buildScheduleItems() {
    if (!scheduleData.lessons || scheduleData.lessons.length === 0) {
        return '<div class="cal-schedule-empty">Data stream offline. No scheduled events.</div>';
    }
    return scheduleData.lessons.map(item => {
        if (item.type === 'gap') {
            return `<div class="cal-schedule-gap"><div class="cal-schedule-gap-line"></div></div>`;
        }
        return `
        <div class="cal-schedule-class">
            <div class="cal-schedule-accent-bar"></div>
            <div class="cal-schedule-class-info">
                <div class="cal-schedule-subject">${item.subject || ''}</div>
                <div class="cal-schedule-meta">
                    <span class="meta-icon">󰅐</span>
                    <span>${item.time || ''}</span>
                </div>
                ${item.room ? `<div class="cal-schedule-meta">
                    <span class="meta-icon cal-schedule-room-icon"></span>
                    <span class="cal-schedule-room">${item.room}</span>
                </div>` : ''}
            </div>
        </div>`;
    }).join('');
}

// ── Calendar Day Grid ──
function buildDaysGrid(year, month, today) {
    const firstDay = new Date(year, month, 1);
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    let html = '';
    for (let i = startDay - 1; i >= 0; i--) html += `<div class="cal-glass-day other-month">${daysInPrevMonth - i}</div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        html += `<div class="cal-glass-day${isToday ? ' today' : ''}">${d}</div>`;
    }
    const totalCells = startDay + daysInMonth;
    const remaining = (Math.ceil(totalCells / 7) * 7) - totalCells;
    for (let d = 1; d <= remaining; d++) html += `<div class="cal-glass-day other-month">${d}</div>`;
    // Fill to 42
    const existing = startDay + daysInMonth + remaining;
    for (let i = 0; i < 42 - existing; i++) html += `<div class="cal-glass-day other-month"></div>`;
    return html;
}

function updateCalGrid(year, month, today) {
    const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    const grid = document.getElementById('cal-days-grid');
    const title = document.getElementById('cal-month-title');
    if (grid) grid.innerHTML = buildDaysGrid(year, month, today);
    if (title) title.textContent = `${months[month]} ${year}`;
    applyTimeColors(new Date().getHours());
}

// ── Draw Dashed Ellipse ──
function drawOrbitEllipse() {
    const canvas = document.getElementById('cal-orbit-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 640, 280);
    ctx.beginPath();
    for (let i = 0; i <= Math.PI * 2; i += 0.05) {
        const x = 320 + Math.cos(i) * 320;
        const y = 140 + Math.sin(i) * 140;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const colors = getTimeColors(new Date().getHours());
    ctx.strokeStyle = colors.accentHex || 'rgba(205, 214, 244, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 10]);
    ctx.globalAlpha = 0.35;
    ctx.stroke();
}

// ── Time-of-day coloring ──
function applyTimeColors(h) {
    const c = getTimeColors(h);
    const timeBlob = document.getElementById('amb-time');
    const accentBlob = document.getElementById('amb-accent');
    const heroSec = document.getElementById('cal-hero-seconds');
    const schedIcon = document.getElementById('schedule-icon');

    if (timeBlob) timeBlob.style.background = c.main;
    if (accentBlob) accentBlob.style.background = c.accent;
    if (heroSec) heroSec.style.color = c.accent;
    if (schedIcon) schedIcon.style.color = c.accent;

    const todayPill = document.querySelector('.cal-glass-day.today');
    if (todayPill) { todayPill.style.background = c.accent; todayPill.style.color = 'var(--base)'; }

    const descEl = document.getElementById('weather-desc');
    if (descEl) descEl.style.color = c.accent;
}

// ── Fetch Weather Data ──
async function fetchWeatherData() {
    if (!window.electronAPI) { setMockWeather(); return; }
    try {
        const data = await window.electronAPI.getWeather();
        if (data) {
            // Build forecast array (the QML expects forecast[0..4])
            const maxTemp = parseFloat(data.temp);
            const today = {
                day_full: new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(),
                max: isNaN(maxTemp) ? 0 : maxTemp,
                desc: data.description || 'Unknown',
                icon: data.icon || '󰖙',
                hex: data.hex || '#f9e2af',
                wind: data.wind || 0,
                humidity: data.humidity || 0,
                pop: data.rain || 0,
                feels_like: data.feelsLike || 0,
                hourly: data.hourly && data.hourly.length > 0 ? data.hourly : generateMockHourly(),
            };
            calendarData.forecast = [today]; // Only today for current API
            calendarData.current = data;
            weatherViewIdx = 0;
            updateWeatherDisplay();
            buildOrbitElements();

            // Giant bg icon
            const bgIcon = document.getElementById('cal-bg-icon');
            const ambWeather = document.getElementById('amb-weather');
            if (bgIcon) { bgIcon.textContent = today.icon; bgIcon.style.color = today.hex; }
            if (ambWeather) ambWeather.style.background = today.hex;
        } else {
            setMockWeather();
        }
    } catch (e) { setMockWeather(); }
}

function generateMockHourly() {
    const h = new Date().getHours();
    const arr = [];
    for (let i = 0; i < 8; i++) {
        const hr = (h + i) % 24;
        arr.push({ time: `${String(hr).padStart(2, '0')}:00`, icon: '󰖐', temp: 8 + Math.round(Math.random() * 10), hex: '#7f849c' });
    }
    return arr;
}

function setMockWeather() {
    calendarData.forecast = [{
        day_full: new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(),
        max: 10.4, desc: 'Overcast Clouds', icon: '󰖐', hex: '#7f849c',
        wind: 3, humidity: 70, pop: 0, feels_like: 9.2,
        hourly: generateMockHourly(),
    }];
    calendarData.current = { icon: '󰖐', hex: '#7f849c' };
    weatherViewIdx = 0;
    updateWeatherDisplay();
    buildOrbitElements();

    const bgIcon = document.getElementById('cal-bg-icon');
    const ambWeather = document.getElementById('amb-weather');
    if (bgIcon) { bgIcon.textContent = '󰖐'; bgIcon.style.color = '#7f849c'; }
    if (ambWeather) ambWeather.style.background = '#7f849c';
}

// ── Update Weather Right Panel ──
function updateWeatherDisplay() {
    const fc = calendarData.forecast[weatherViewIdx];
    if (!fc) return;

    const dayLabel = document.getElementById('weather-day-label');
    const bigTemp = document.getElementById('weather-big-temp');
    const descEl = document.getElementById('weather-desc');

    if (dayLabel) dayLabel.textContent = fc.day_full || 'TODAY';

    // Trigger temp lerp
    targetTemp = fc.max;

    if (descEl) descEl.textContent = fc.desc || '';

    // Update gauges
    updateGauges(fc);

    // Update orbit hourly pills
    if (fc.hourly && fc.hourly.length > 0) {
        calendarData.hourly = fc.hourly.slice(0, 8);
        buildOrbitElements();
    }
}

function updateGauges(fc) {
    const gaugesContainer = document.getElementById('weather-gauges');
    if (!gaugesContainer) return;

    const gaugeData = [
        { icon: '', val: `${fc.wind}m/s`, lbl: 'WIND', fill: Math.min(1.0, fc.wind / 25.0) },
        { icon: '', val: `${fc.humidity}%`, lbl: 'HUMID', fill: fc.humidity / 100.0 },
        { icon: '', val: `${fc.pop}%`, lbl: 'RAIN', fill: fc.pop / 100.0 },
        { icon: '', val: `${fc.feels_like}°`, lbl: 'FEELS', fill: Math.max(0, Math.min(1.0, (fc.feels_like + 15) / 55.0)) },
    ];

    gaugesContainer.innerHTML = gaugeData.map(g => buildGaugeHTML(g.icon, g.val, g.lbl, g.fill)).join('');

    // Animate gauge canvases
    setTimeout(() => {
        const items = gaugesContainer.querySelectorAll('.cal-gauge-item');
        items.forEach((item, idx) => {
            const canvas = item.querySelector('canvas');
            if (!canvas) return;
            const targetFill = gaugeData[idx].fill;
            animateGauge(canvas, targetFill);
        });
    }, 50);
}

function animateGauge(canvas, targetFill) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const r = w / 2;
    let currentFill = 0;
    const startTime = performance.now();
    const duration = 1500;
    const colors = getTimeColors(new Date().getHours());

    const drawFrame = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        // Expo out easing
        const eased = 1 - Math.pow(1 - t, 4);
        currentFill = eased * targetFill;

        ctx.clearRect(0, 0, w, h);

        // Background circle
        ctx.beginPath();
        ctx.arc(r, r, r - 8, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(205, 214, 244, 0.1)';
        ctx.lineWidth = 6;
        ctx.stroke();

        // Progress arc
        if (currentFill > 0) {
            ctx.save();
            ctx.translate(r, r);
            ctx.rotate(-Math.PI / 2);
            ctx.translate(-r, -r);

            ctx.beginPath();
            ctx.arc(r, r, r - 8, 0, currentFill * 2 * Math.PI);
            const grad = ctx.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, colors.accentHex || '#94e2d5');
            grad.addColorStop(1, '#89b4fa');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.restore();
        }

        if (t < 1) requestAnimationFrame(drawFrame);
    };
    requestAnimationFrame(drawFrame);
}

// ── Temp Lerp ──
function updateTempLerp(dt) {
    const bigTemp = document.getElementById('weather-big-temp');
    if (!bigTemp) return;

    if (Math.abs(displayedTemp - targetTemp) > 0.1) {
        const diff = targetTemp - displayedTemp;
        displayedTemp += diff * 4 * dt;
        if (Math.abs(targetTemp - displayedTemp) < 0.1) displayedTemp = targetTemp;

        bigTemp.textContent = `${displayedTemp.toFixed(1)}°`;

        if (targetTemp > displayedTemp) {
            bigTemp.classList.add('heating'); bigTemp.classList.remove('cooling');
        } else {
            bigTemp.classList.add('cooling'); bigTemp.classList.remove('heating');
        }
    } else {
        displayedTemp = targetTemp;
        bigTemp.textContent = `${displayedTemp.toFixed(1)}°`;
        bigTemp.classList.remove('heating', 'cooling');
    }
}

// ── Orbit Elements ──
function buildOrbitElements() {
    const container = document.getElementById('cal-orbit-container');
    if (!container) return;
    container.innerHTML = '';

    const ch = new Date().getHours();
    let bestIdx = 0, minDiff = 999;

    calendarData.hourly.forEach((item, i) => {
        const tp = parseInt(item.time.split(':')[0]);
        const diff = Math.abs(tp - ch);
        if (diff < minDiff) { minDiff = diff; bestIdx = i; }
    });

    calendarData.hourly.forEach((item, index) => {
        const el = document.createElement('div');
        const isHighlighted = index === bestIdx;
        el.className = `cal-orbit-item${isHighlighted ? ' active-hour' : ''}`;
        el.dataset.index = index;
        el.dataset.relIdx = index - bestIdx;
        el.innerHTML = `
            <div class="cal-orbit-time">${item.time}</div>
            <div class="cal-orbit-icon" style="color:${isHighlighted ? 'var(--base)' : (item.hex || 'var(--text)')}">${item.icon || '󰖙'}</div>
            <div class="cal-orbit-temp">${item.temp}°</div>
        `;
        container.appendChild(el);
    });

    updateOrbitPositions();
}

function updateOrbitPositions() {
    const container = document.getElementById('cal-orbit-container');
    if (!container) return;
    const items = container.querySelectorAll('.cal-orbit-item');
    if (!items.length) return;

    const rx = 320, ry = 140;

    items.forEach(el => {
        const index = parseInt(el.dataset.index);
        const relIdx = parseInt(el.dataset.relIdx);
        const isHighlighted = el.classList.contains('active-hour');

        // QML: targetAngleDeg = 65 + (relIdx * 30), osc = sin(globalOrbitAngle * 10 + index) * 5
        const targetAngleDeg = 65 + (relIdx * 30);
        const osc = Math.sin(globalOrbitAngle * 10 + index) * 5;
        const rad = (targetAngleDeg + osc) * (Math.PI / 180);

        const x = Math.cos(rad) * rx;
        const y = Math.sin(rad) * ry;
        const z = Math.sin(rad) * 100;

        const baseScale = 0.95 + 0.20 * Math.sin(rad);
        const finalScale = isHighlighted ? 1.4 : baseScale;
        const opacity = isHighlighted ? 1.0 : (0.7 + 0.3 * ((Math.sin(rad) + 1) / 2));

        el.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%)) scale(${finalScale})`;
        el.style.zIndex = Math.floor(z + 200);
        el.style.opacity = opacity;
    });
}

// ── Schedule Sine Waves ──
function drawScheduleWaves(dt) {
    const canvas = document.getElementById('cal-schedule-waves');
    if (!canvas) return;

    // Resize to container
    if (canvas.width !== canvas.parentElement.clientWidth || canvas.height !== canvas.parentElement.clientHeight) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    }

    wavePhase1 += dt * (Math.PI * 2 / 4);   // 4s period
    wavePhase2 += dt * (Math.PI * 2 / 5.5); // 5.5s period
    wavePhase3 += dt * (Math.PI * 2 / 7);   // 7s period
    if (wavePhase1 > Math.PI * 2) wavePhase1 -= Math.PI * 2;
    if (wavePhase2 > Math.PI * 2) wavePhase2 -= Math.PI * 2;
    if (wavePhase3 > Math.PI * 2) wavePhase3 -= Math.PI * 2;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Wave 1 - Mauve
    ctx.beginPath();
    ctx.moveTo(0, cy);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, cy + Math.sin(x / 100 + wavePhase1) * 30);
    ctx.strokeStyle = '#cba6f7'; ctx.lineWidth = 2; ctx.stroke();

    // Wave 2 - Sapphire
    ctx.beginPath();
    ctx.moveTo(0, cy);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, cy + Math.sin(x / 120 - wavePhase2) * 40);
    ctx.strokeStyle = '#74c7ec'; ctx.lineWidth = 2; ctx.stroke();

    // Wave 3 - Peach
    ctx.beginPath();
    ctx.moveTo(0, cy);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, cy + Math.sin(x / 80 + wavePhase3) * 20);
    ctx.strokeStyle = '#fab387'; ctx.lineWidth = 2; ctx.stroke();
}

// ── Google Calendar Schedule Fetching ──
async function fetchScheduleData() {
    if (!window.electronAPI || !window.electronAPI.getCalendarEvents) return;
    try {
        const data = await window.electronAPI.getCalendarEvents();
        if (data) {
            scheduleData = data;
            // Re-render schedule items
            const itemsEl = document.getElementById('schedule-items');
            const titleEl = document.getElementById('schedule-title');
            if (itemsEl) itemsEl.innerHTML = buildScheduleItems();
            if (titleEl) titleEl.textContent = scheduleData.header || '';
        }
    } catch (e) {
        console.error('Calendar fetch error:', e);
    }
}
