// ============================================================================
// フォーカスタイムウィジェット — FocusTimePopup.qml 分析UI
// ============================================================================

function renderFocusTimeWidget(container) {
    const batPanel = document.createElement('div');
    batPanel.className = 'widget-panel';
    batPanel.style.padding = '0';
    batPanel.id = 'focustime-panel';

    container.appendChild(batPanel);
    
    // 初回・定期データ取得
    updateFocusTimeData();
    window.widgetUpdateInterval = setInterval(updateFocusTimeData, 15000); // 15秒ごとに更新
}

async function updateFocusTimeData() {
    if(!window.electronAPI) return;
    
    try {
        const stats = await window.electronAPI.getFocusTime();
        if(!stats) return;

        const panel = document.getElementById('focustime-panel');
        if(!panel) return;

        // Daily Avg
        const totalWk = stats.weekData.reduce((s, d) => s + d.totalSec, 0);
        let wkAvg = Math.floor((totalWk / 7) / 3600);
        let wkAvgM = Math.floor(((totalWk / 7) % 3600) / 60);

        // Today
        let tdH = Math.floor(stats.todayTotalSec / 3600);
        let tdM = Math.floor((stats.todayTotalSec % 3600) / 60);

        // Max for chart scaling
        const maxSec = Math.max(...stats.weekData.map(d => d.totalSec), 1);

        // ヒートマップ
        const todayStr = new Date().getDate();
        let heatmapCells = '';
        const curMonth = (new Date()).toLocaleString('en-US', {month: 'long'});
        for (let d = 1; d <= 31; d++) {
            let levelClass = '';
            if (d === todayStr) {
                // Approximate level based on today's relative use
                let ratio = stats.todayTotalSec / (8 * 3600); // assume 8h max
                if(ratio > 0.8) levelClass = 'l4';
                else if(ratio > 0.5) levelClass = 'l3';
                else if(ratio > 0.2) levelClass = 'l2';
                else if(ratio > 0) levelClass = 'l1';
            } else if (d < todayStr) {
                levelClass = `l${Math.ceil(Math.random() * 4)}`; // keep others random mock as we dont have full month DB yet
            }
            heatmapCells += `<div class="ft-heatmap-cell ${levelClass}"></div>`;
        }

        panel.innerHTML = `
        <div class="focustime-widget">
            <div class="ft-header">
                <div class="ft-nav">
                    <button class="ft-home-btn">󰋜</button>
                    <button class="ft-nav-btn">‹</button>
                </div>
                <span class="ft-day-label">Today Activity</span>
                <button class="ft-nav-btn">›</button>
            </div>

            <div class="ft-stats-row">
                <div class="ft-stat-card">
                    <div class="ft-stat-sublabel">Daily average</div>
                    <div class="ft-stat-value">${wkAvg}h ${wkAvgM}m</div>
                    <div class="ft-stat-sublabel" style="text-transform:lowercase">past 7 days</div>
                </div>
                <div class="ft-stat-card highlight">
                    <div class="ft-stat-value">${tdH}h ${tdM}m</div>
                    <div class="ft-stat-sublabel">ACTIVE TODAY</div>
                </div>
                <div class="ft-stat-card">
                    <div class="ft-stat-sublabel" style="color:var(--green)">✓ Tracked</div>
                    <div class="ft-stat-value" style="font-size:18px;">Live</div>
                </div>
            </div>

            <div class="ft-charts-row">
                <div class="ft-bar-chart">
                    ${stats.weekData.map((d, i) => {
                        let pctH = (d.totalSec / maxSec) * 100;
                        return `
                        <div class="ft-bar">
                            <div class="ft-bar-fill ${i === 6 ? 'today' : ''}" style="height:${pctH > 0 ? pctH : 2}%;"></div>
                            <span class="ft-bar-label">${d.label}</span>
                        </div>
                        `;
                    }).join('')}
                </div>
                <div class="ft-heatmap">
                    <div class="ft-heatmap-title">${curMonth}</div>
                    <div class="ft-heatmap-grid">${heatmapCells}</div>
                </div>
            </div>

            <div class="ft-app-list">
                ${stats.apps.length > 0 ? stats.apps.map(app => `
                    <div class="ft-app-item">
                        <div class="ft-app-icon">${app.icon}</div>
                        <div class="ft-app-info">
                            <div class="ft-app-name">${app.name}<span class="ft-app-time">${app.timeStr}</span></div>
                            <div class="ft-app-bar"><div class="ft-app-bar-fill" style="width:${app.pct}%"></div></div>
                        </div>
                    </div>
                `).join('') : '<div style="color:var(--subtext0); text-align:center; margin-top:20px; font-family:\'JetBrains Mono\'; font-size:12px;">No screen time tracked yet</div>'}
            </div>
        </div>`;

    } catch(e) { console.error("FocusTime Error:", e); }
}
