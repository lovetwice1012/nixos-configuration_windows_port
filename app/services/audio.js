// ============================================================================
// オーディオサービス — Windows Core Audio API 経由の音量制御
// sys_info.sh --volume / --volume-icon / --is-muted を置換
// ============================================================================

const sysUtils = require('../native/sys-utils/build/Release/sys_utils.node');

let cachedInfo = { percent: 50, isMuted: false, icon: '󰕾' };

async function getInfo() {
    try {
        const audio = sysUtils.getAudio();
        if (audio) {
            const percent = audio.volume;
            const isMuted = audio.muted;

            let icon = '󰕾';
            if (isMuted || percent === 0) icon = '󰖁';
            else if (percent < 33) icon = '󰕿';
            else if (percent < 66) icon = '󰖀';

            cachedInfo = { percent, isMuted, icon };
        }
    } catch (e) {
        console.error("Native GetAudio Error:", e);
    }
    return cachedInfo;
}

async function setVolume(percent) {
    try {
        sysUtils.setAudio(Math.max(0, Math.min(100, percent)));
    } catch (e) {
        console.error("Native SetAudio Error:", e);
    }
}

async function toggleMute() {
    try {
        sysUtils.toggleMute();
    } catch (e) {
        console.error("Native ToggleMute Error:", e);
    }
}

module.exports = { getInfo, setVolume, toggleMute };
