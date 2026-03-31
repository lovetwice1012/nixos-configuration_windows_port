// ============================================================================
// 壁紙サービス — Windows壁紙設定 + カラー抽出
// swww / mpvpaper + matugen を置換
// ============================================================================
const path = require('path');
const sysUtils = require('../native/sys-utils/build/Release/sys_utils.node');

async function setWallpaper(imagePath) {
    try {
        const absPath = path.resolve(imagePath);
        const res = sysUtils.setWallpaper(absPath);
        return { success: res };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// 現在の壁紙パスを取得
async function getCurrentWallpaper() {
    try {
        return sysUtils.getWallpaper();
    } catch (e) {
        return '';
    }
}

module.exports = { setWallpaper, getCurrentWallpaper };
