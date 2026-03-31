// ============================================================================
// アプリランチャーサービス — スタートメニューからアプリをインデックス
// Rofi drun モードを置換
// ============================================================================
const { shell } = require('electron');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

let cachedApps = [];
let lastIndexTime = 0;
const INDEX_INTERVAL = 60000; // 1分ごとにリフレッシュ

// .lnk ショートカットからアプリ情報を抽出
async function indexApps() {
    const now = Date.now();
    if (now - lastIndexTime < INDEX_INTERVAL && cachedApps.length > 0) {
        return cachedApps;
    }

    const apps = [];
    const searchDirs = [
        path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
        path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    ];

    for (const dir of searchDirs) {
        try {
            await scanDir(dir, apps);
        } catch (e) { /* ディレクトリが存在しない */ }
    }

    // 重複除去（名前ベース）
    const seen = new Set();
    cachedApps = apps.filter(app => {
        const key = app.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).sort((a, b) => a.name.localeCompare(b.name));

    lastIndexTime = now;
    return cachedApps;
}

async function scanDir(dir, apps) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await scanDir(fullPath, apps);
        } else if (entry.name.endsWith('.lnk')) {
            const name = entry.name.replace('.lnk', '');
            // アンインストーラーやヘルプファイルを除外
            if (name.toLowerCase().includes('uninstall') ||
                name.toLowerCase().includes('help') ||
                name.toLowerCase().includes('readme')) {
                continue;
            }
            apps.push({
                name,
                path: fullPath,
                type: 'shortcut',
            });
        }
    }
}

async function getApps() {
    return indexApps();
}

async function launch(appPath) {
    try {
        await shell.openPath(appPath);
    } catch (e) { console.error('Launch failed:', e); }
}

module.exports = { getApps, launch };
