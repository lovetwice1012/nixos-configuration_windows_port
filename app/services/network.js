// ============================================================================
// ネットワークサービス — netsh 経由のWiFi情報取得（拡張版）
// IP, Band, Security, Signal を含む詳細情報を提供
// ============================================================================
const sysUtils = require('../native/sys-utils/build/Release/sys_utils.node');

let cachedInfo = { status: 'Off', icon: '󰤮', ssid: '', signal: 0, isConnected: false, ip: '', freq: '', security: '', bssid: '' };

async function getInfo() {
    try {
        const net = sysUtils.getNetworkInfo();
        if (net && net.ssid) {
            cachedInfo = net;
        } else {
            cachedInfo = { status: 'Off', icon: '󰤮', ssid: '', signal: 0, isConnected: false, ip: '', freq: '', security: '', bssid: '' };
        }
    } catch (e) {
        console.error("Native Network Error:", e);
    }
    return cachedInfo;
}

async function getAvailableNetworks() {
    try {
        return sysUtils.getAvailableNetworks();
    } catch (e) {
        console.error("Native Network Available Error:", e);
        return [];
    }
}

module.exports = { getInfo, getAvailableNetworks };
