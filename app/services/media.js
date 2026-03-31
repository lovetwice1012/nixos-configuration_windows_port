// ============================================================================
// メディアサービス — Windows Media Session 経由の再生情報取得
// playerctl を置換
// ============================================================================
const sysUtils = require('../native/sys-utils/build/Release/sys_utils.node');

let cachedInfo = { status: 'Stopped', title: '', artist: '', artUrl: '', timeStr: '00:00/00:00', position: 0, duration: 0, source: 'Offline' };

async function getInfo() {
    try {
        const media = sysUtils.getMediaInfo();
        if (media) {
            const m = Math.floor(media.position / 60);
            const s = media.position % 60;
            const dm = Math.floor(media.duration / 60);
            const ds = media.duration % 60;
            const posStr = `${m}:${s.toString().padStart(2, '0')}`;
            const durStr = `${dm}:${ds.toString().padStart(2, '0')}`;
            
            cachedInfo = {
                status: media.status || 'Stopped',
                title: media.title || '',
                artist: media.artist || '',
                artUrl: '', // WinRT provides Thumbnail, but we skip it here for performance or implement later
                timeStr: `${posStr}/${durStr}`,
                position: media.position || 0,
                duration: media.duration || 0,
                source: media.app || 'System'
            };
        } else {
            cachedInfo.status = 'Stopped';
            cachedInfo.source = 'Offline';
            cachedInfo.title = '';
            cachedInfo.artist = '';
            cachedInfo.position = 0;
            cachedInfo.duration = 0;
        }
    } catch (e) {
        console.error("Native Media Info Error:", e);
    }
    return cachedInfo;
}

async function togglePlayPause() {
    try { sysUtils.togglePlayPause(); } catch (e) {}
}

async function next() {
    try { sysUtils.next(); } catch (e) {}
}

async function previous() {
    try { sysUtils.previous(); } catch (e) {}
}

module.exports = { getInfo, togglePlayPause, next, previous };
