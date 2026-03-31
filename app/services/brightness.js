// ============================================================================
// 画面輝度サービス — WMI 経由の輝度制御
// brightnessctl を置換
// ============================================================================
const sysUtils = require('../native/sys-utils/build/Release/sys_utils.node');

let cachedInfo = { percent: 100, icon: '󰃟' };

async function getInfo() {
    try {
        const val = sysUtils.getBrightness();
        if (val !== null && typeof val === 'number') {
            cachedInfo = { percent: val, icon: '󰃟' };
        }
    } catch (e) {
        // Desktop monitors etc.
        console.error("Native GetBrightness error:", e);
    }
    return cachedInfo;
}

async function setBrightness(percent) {
    const val = Math.max(0, Math.min(100, percent));
    try {
        sysUtils.setBrightness(val);
    } catch (e) { 
        console.error("Native SetBrightness error:", e);
    }
}

module.exports = { getInfo, setBrightness };
