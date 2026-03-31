// ============================================================================
// ウィジェットオーバーレイ エンジン — Main.qml の switchWidget/StackView を再現
// ============================================================================

// レンダラーは遅延バインディング（各ウィジェットJSの読み込み順に依存しない）
function getWidgetRenderer(name) {
    const map = {
        calendar: typeof renderCalendarWidget !== 'undefined' ? renderCalendarWidget : null,
        music: typeof renderMusicWidget !== 'undefined' ? renderMusicWidget : null,
        battery: typeof renderBatteryWidget !== 'undefined' ? renderBatteryWidget : null,
        network: typeof renderNetworkWidget !== 'undefined' ? renderNetworkWidget : null,
        wallpaper: typeof renderWallpaperWidget !== 'undefined' ? renderWallpaperWidget : null,
        focustime: typeof renderFocusTimeWidget !== 'undefined' ? renderFocusTimeWidget : null,
        monitors: typeof renderMonitorsWidget !== 'undefined' ? renderMonitorsWidget : null,
        settings: typeof renderSettingsWidget !== 'undefined' ? renderSettingsWidget : null,
    };
    return map[name] || null;
}

let currentWidgetName = 'hidden';
let widgetUpdateInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!window.electronAPI) return;

    window.electronAPI.onWidgetOpen((data) => {
        openWidget(data.name);
    });

    window.electronAPI.onWidgetClose(() => {
        closeWidget();
    });

    // ESCキーでウィジェットを閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (window.electronAPI) window.electronAPI.closeWidget();
        }
    });
});

function openWidget(name) {
    const container = document.getElementById('widget-container');
    if (!container) return;

    // 前のウィジェットの更新を停止
    if (widgetUpdateInterval) {
        clearInterval(widgetUpdateInterval);
        widgetUpdateInterval = null;
    }

    // コンテナをリセット
    container.classList.remove('visible', 'closing');
    container.innerHTML = '';

    // ウィジェットのレンダラーを呼び出し
    const renderer = getWidgetRenderer(name);
    if (renderer) {
        renderer(container);
    } else {
        container.innerHTML = `<div class="widget-panel" style="display:flex;align-items:center;justify-content:center;">
            <span style="font-size:18px;color:var(--subtext0);">ウィジェット「${name}」は準備中です</span>
        </div>`;
    }

    currentWidgetName = name;

    // フェードイン（Main.qml のopacity/scale遷移を再現）
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            container.classList.add('visible');
        });
    });
}

function closeWidget() {
    const container = document.getElementById('widget-container');
    if (!container) return;

    if (widgetUpdateInterval) {
        clearInterval(widgetUpdateInterval);
        widgetUpdateInterval = null;
    }

    container.classList.remove('visible');
    container.classList.add('closing');

    setTimeout(() => {
        container.innerHTML = '';
        container.classList.remove('closing');
        currentWidgetName = 'hidden';
    }, 300);
}
