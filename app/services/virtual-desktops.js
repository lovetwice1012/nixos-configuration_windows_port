// ============================================================================
// 仮想デスクトップサービス — Windows 10/11 仮想デスクトップ切り替え
// Hyprlandのworkspace切り替えを置換
// ============================================================================
const sysUtils = require('../native/sys-utils/build/Release/sys_utils.node');

async function switchTo(desktopNumber) {
    try {
        // Here we just simulate switching 'right' as the simplest implementation.
        // The original script was blindly sending 'Win+Ctrl+Right'.
        sysUtils.simulateWorkspaceSwitch('right');
    } catch (e) { /* ignore */ }
}

async function getInfo() {
    return {
        current: 1,
        total: 1,
        workspaces: [{ id: 1, state: 'active' }],
    };
}

module.exports = { switchTo, getInfo };
