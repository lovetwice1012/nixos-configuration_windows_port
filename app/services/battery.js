// ============================================================================
// バックエンド: バッテリーとシステム情報取得 (with Native Power Schemes)
// ============================================================================
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const sysUtils = require('../native/sys-utils/build/Release/sys_utils.node');

async function getInfo() {
    return new Promise(async (resolve) => {
        let capacity = 100;
        let status = 'AC Power';
        
        try {
            const batt = sysUtils.getBattery();
            if (batt) {
                capacity = batt.capacity;
                status = batt.status;
            }
        } catch (e) {
            console.error("Native GetBattery Error:", e);
        }

        const upSec = os.uptime();
        let upHours = Math.floor(upSec / 3600);
        let upMins = Math.floor((upSec % 3600) / 60);
        
        const currentUserName = os.userInfo().username;
        const powerProfile = sysUtils.getPowerProfile();

        resolve({ capacity, status, upHours, upMins, currentUserName, powerProfile });
    });
}

function setPowerProfile(profile) {
    try {
        sysUtils.setPowerProfile(profile);
        return true;
    } catch(e) {
        console.error("Native SetPowerProfile Error:", e);
        return false;
    }
}

module.exports = { getInfo, setPowerProfile };
