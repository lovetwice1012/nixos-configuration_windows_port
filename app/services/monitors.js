// ============================================================================
// ディスプレイ展開サービス — Native C++ Backend
// ============================================================================
const sysUtils = require('../native/sys-utils/build/Release/sys_utils.node');

function getInfo() {
    try {
        const displays = sysUtils.getDisplays();
        return displays;
    } catch (e) {
        console.error("Native sysUtils Error:", e);
        return [];
    }
}

// IPC endpoint expects input format matching Native SetTopology requirements
// { "id": "\.\DISPLAY1", "bounds": { x: 0, y: 0, width: 1920, height: 1080 } }
async function setTopology(displays) {
    try {
        console.log("Applying Native Topology:", displays);
        const result = sysUtils.setTopology(displays);
        return result;
    } catch (e) {
        console.error("Native SetTopology Error:", e);
        return false;
    }
}

module.exports = { getInfo, setTopology };
