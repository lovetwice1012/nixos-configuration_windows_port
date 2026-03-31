// ============================================================================
// フォーカスタイム サービス — Native C++ Backend
// ============================================================================
const fs = require('fs');
const path = require('path');
const os = require('os');
const sysUtils = require('../native/sys-utils/build/Release/sys_utils.node');

// In-memory stats database { dateString: { appName: seconds } }
let statsDB = {};
const DB_PATH = path.join(os.homedir(), '.nixos-windows-port-focustime.json');

// Load DB
try {
    if (fs.existsSync(DB_PATH)) {
        statsDB = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
} catch (e) {
    statsDB = {};
}

const PING_INTERVAL = 1000; // Native C++ allows much faster polling safely (1 sec)

function startDaemon() {
    setInterval(() => {
        try {
            const appName = sysUtils.getActiveWindowApp();
            recordAppFocus(appName);
        } catch(e) {
            console.error("Focus Tracker Native Error:", e);
        }
    }, PING_INTERVAL);
}

function recordAppFocus(appName) {
    if (!appName || appName === 'Unknown' || appName === 'System' || appName === 'SearchHost' || appName === 'explorer') return;
    
    const d = new Date();
    const ymd = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;

    if (!statsDB[ymd]) statsDB[ymd] = {};
    if (!statsDB[ymd][appName]) statsDB[ymd][appName] = 0;
    
    statsDB[ymd][appName] += (PING_INTERVAL / 1000); // add 1 second
    
    // Periodically save
    if (Math.random() < 0.05) { // 5% chance per second (~ every 20s)
        fs.writeFile(DB_PATH, JSON.stringify(statsDB), () => {});
    }
}

// Format exactly for the UI
function getStats() {
    const d = new Date();
    const todayYmd = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    const todayData = statsDB[todayYmd] || {};
    
    // Safety check: Filter out null/undefined/NaN
    const apps = Object.entries(todayData)
        .filter(([name, timeSec]) => name && name !== 'undefined' && name !== 'null' && typeof timeSec === 'number' && !isNaN(timeSec))
        .map(([name, timeSec]) => ({ name, timeSec }));
        
    apps.sort((a,b) => b.timeSec - a.timeSec);
    
    const totalToday = apps.reduce((sum, a) => sum + (a && typeof a.timeSec === 'number' ? a.timeSec : 0), 0);
    
    const uiApps = apps.slice(0, 10).map(a => {
        if (!a || !a.name) return { name: "Unknown", timeSec: 0, timeStr: "0m", pct: 0, icon: '📦' };
        
        let hrs = Math.floor(a.timeSec / 3600);
        let mins = Math.floor((a.timeSec % 3600) / 60);
        let timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
        let pct = totalToday > 0 ? Math.round((a.timeSec / totalToday) * 100) : 0;
        
        let icon = '📦';
        let n = a.name.toLowerCase();
        if(n.includes('msedge') || n.includes('chrome') || n.includes('firefox')) icon = '🌐';
        if(n.includes('code') || n.includes('idea')) icon = '💻';
        if(n.includes('discord') || n.includes('slack')) icon = '💬';
        if(n.includes('obsidian') || n.includes('notion')) icon = '📝';
        if(n.includes('spotify') || n.includes('music')) icon = '🎵';

        return { name: a.name, timeSec: a.timeSec, timeStr, pct, icon };
    });

    const weekData = [];
    for(let i=6; i>=0; i--) {
        const past = new Date(d);
        past.setDate(d.getDate() - i);
        const pYmd = `${past.getFullYear()}-${(past.getMonth()+1).toString().padStart(2, '0')}-${past.getDate().toString().padStart(2, '0')}`;
        
        let dayTotal = 0;
        if(statsDB[pYmd]) {
            dayTotal = Object.values(statsDB[pYmd]).reduce((s, x) => s + x, 0);
        }
        
        const label = past.toLocaleDateString('en-US', { weekday: 'short' });
        weekData.push({ label, totalSec: dayTotal });
    }

    return {
        todayTotalSec: totalToday,
        apps: uiApps,
        weekData
    };
}

startDaemon();

module.exports = { getStats };
