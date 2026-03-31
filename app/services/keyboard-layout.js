// ============================================================================
// キーボードレイアウトサービス — 現在の入力言語検出
// ============================================================================
const sysUtils = require('../native/sys-utils/build/Release/sys_utils.node');

let cachedInfo = { layout: 'EN' };

async function getInfo() {
    try {
        const str = sysUtils.getKeyboardLayout();
        const shortStr = str.substring(0, 2).toUpperCase();
        cachedInfo = { layout: shortStr };
    } catch (e) {
        // Fallback to cache
    }
    return cachedInfo;
}

module.exports = { getInfo };
