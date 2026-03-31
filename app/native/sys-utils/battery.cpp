#include <napi.h>
#include <windows.h>
#include <string>

using namespace Napi;

Value GetBatteryData(const CallbackInfo& info) {
    Env env = info.Env();
    SYSTEM_POWER_STATUS sps;
    if (GetSystemPowerStatus(&sps)) {
        Object obj = Object::New(env);
        obj.Set("capacity", sps.BatteryLifePercent == 255 ? 100 : sps.BatteryLifePercent);
        obj.Set("isCharging", sps.ACLineStatus == 1);
        
        std::string statusStr = "Unknown";
        if (sps.ACLineStatus == 1) statusStr = "Charging";
        else if (sps.BatteryFlag & 128) statusStr = "No System Battery";
        else if (sps.BatteryFlag & 8) statusStr = "Charging";
        else statusStr = "Discharging";
        
        if (sps.BatteryLifePercent == 100) statusStr = "Full";

        obj.Set("status", statusStr);
        return obj;
    }
    return env.Null();
}

Object InitBattery(Env env, Object exports) {
    exports.Set("getBattery", Function::New(env, GetBatteryData));
    return exports;
}
