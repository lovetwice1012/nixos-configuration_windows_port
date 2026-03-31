// ============================================================================
// アプリランチャー ロジック — Rofi drun モード再現
// ============================================================================

let allApps = [];
let filteredApps = [];
let selectedIndex = 0;

// アプリ名 → アイコン絵文字マッピング（Nerd Fontが使えない場合のフォールバック）
const APP_ICONS = {
    'firefox': '🔥', 'chrome': '🌐', 'edge': '🌊', 'brave': '🦁',
    'code': '💻', 'visual studio': '💜', 'notepad': '📝',
    'terminal': '⬛', 'powershell': '💙', 'cmd': '⬛',
    'explorer': '📁', 'file': '📂',
    'discord': '💬', 'telegram': '✈️', 'slack': '💼', 'teams': '👥',
    'spotify': '🎵', 'vlc': '🔶', 'music': '🎶',
    'steam': '🎮', 'epic': '🎮',
    'word': '📘', 'excel': '📊', 'powerpoint': '📙', 'outlook': '📧',
    'obsidian': '💎', 'notion': '📓',
    'gimp': '🎨', 'photoshop': '🖼️', 'paint': '🎨',
    'settings': '⚙️', 'control': '🎛️',
    'calculator': '🔢', 'clock': '🕐', 'calendar': '📅',
    'store': '🛍️', 'update': '🔄',
};

function getAppIcon(name) {
    const lower = name.toLowerCase();
    for (const [key, icon] of Object.entries(APP_ICONS)) {
        if (lower.includes(key)) return icon;
    }
    return '📦';
}

document.addEventListener('DOMContentLoaded', () => {
    const panel = document.getElementById('launcher-panel');
    const searchInput = document.getElementById('launcher-search');

    // 表示アニメーション
    if (window.electronAPI) {
        window.electronAPI.onLauncherFocus(() => {
            panel.classList.add('show');
            searchInput.value = '';
            searchInput.focus();
            selectedIndex = 0;
            loadApps();
        });
    }

    // 検索入力
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        if (query === '') {
            filteredApps = [...allApps];
        } else {
            filteredApps = allApps.filter(app =>
                app.name.toLowerCase().includes(query)
            );
        }
        selectedIndex = 0;
        renderGrid();
    });

    // キーボードナビゲーション
    document.addEventListener('keydown', (e) => {
        const cols = Math.floor((document.getElementById('launcher-grid')?.offsetWidth || 800) / 128);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + cols, filteredApps.length - 1);
            renderGrid();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - cols, 0);
            renderGrid();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, filteredApps.length - 1);
            renderGrid();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            renderGrid();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredApps[selectedIndex]) {
                launchApp(filteredApps[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            panel.classList.remove('show');
            if (window.electronAPI) window.electronAPI.hideLauncher();
        }
    });

    // モード切替
    document.querySelectorAll('.launcher-mode').forEach(mode => {
        mode.addEventListener('click', () => {
            document.querySelectorAll('.launcher-mode').forEach(m => m.classList.remove('active'));
            mode.classList.add('active');
        });
    });

    // 初期表示
    setTimeout(() => {
        panel.classList.add('show');
        loadApps();
    }, 100);
});

async function loadApps() {
    if (!window.electronAPI) {
        // デモ用アプリ一覧
        allApps = [
            { name: 'Firefox', path: '' },
            { name: 'Visual Studio Code', path: '' },
            { name: 'Windows Terminal', path: '' },
            { name: 'File Explorer', path: '' },
            { name: 'Discord', path: '' },
            { name: 'Spotify', path: '' },
            { name: 'Steam', path: '' },
            { name: 'Obsidian', path: '' },
            { name: 'Calculator', path: '' },
            { name: 'Settings', path: '' },
            { name: 'Microsoft Store', path: '' },
            { name: 'Telegram', path: '' },
        ];
    } else {
        try {
            allApps = await window.electronAPI.getApps();
        } catch (e) {
            allApps = [];
        }
    }

    filteredApps = [...allApps];
    renderGrid();
}

function renderGrid() {
    const grid = document.getElementById('launcher-grid');
    if (!grid) return;

    if (filteredApps.length === 0) {
        grid.innerHTML = `
            <div class="launcher-empty" style="grid-column:1/-1;">
                <span class="launcher-empty-icon">󰍉</span>
                <span class="launcher-empty-text">No applications found</span>
            </div>`;
        return;
    }

    grid.innerHTML = filteredApps.map((app, i) => `
        <div class="launcher-app ${i === selectedIndex ? 'selected' : ''}" data-index="${i}">
            <div class="launcher-app-icon">${getAppIcon(app.name)}</div>
            <span class="launcher-app-name" title="${app.name}">${app.name}</span>
        </div>
    `).join('');

    // クリックイベント
    grid.querySelectorAll('.launcher-app').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.index);
            if (filteredApps[idx]) launchApp(filteredApps[idx]);
        });
        el.addEventListener('mouseenter', () => {
            selectedIndex = parseInt(el.dataset.index);
            grid.querySelectorAll('.launcher-app').forEach(a => a.classList.remove('selected'));
            el.classList.add('selected');
        });
    });

    // 選択要素をスクロールに追従
    const selectedEl = grid.querySelector('.launcher-app.selected');
    if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function launchApp(app) {
    if (window.electronAPI && app.path) {
        window.electronAPI.launchApp(app.path);
        window.electronAPI.hideLauncher();
    }
    const panel = document.getElementById('launcher-panel');
    if (panel) panel.classList.remove('show');
}
