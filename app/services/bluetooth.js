// ============================================================================
// Bluetoothサービス — PowerShell 経由のBT情報取得
// sys_info.sh --bt-status / --bt-icon / --bt-connected を置換
// ============================================================================
const sysUtils = require('../native/sys-utils/build/Release/sys_utils.node');

let cachedInfo = { status: 'Off', icon: '󰂲', device: '', isOn: false, isConnected: false };

async function getInfo() {
    try {
        const bt = sysUtils.getBluetoothInfo();
        if (bt) {
            cachedInfo = bt;
        }
    } catch (e) {
        console.error("Native Bluetooth Error:", e);
    }
    return cachedInfo;
}

async function getDevices() {
    try {
        return sysUtils.getAvailableDevices();
    } catch (e) {
        console.error("Native Bluetooth Devices Error:", e);
        return [];
    }
}

module.exports = { getInfo, getDevices };
