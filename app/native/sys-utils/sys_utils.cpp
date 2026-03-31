#include <napi.h>
#include <windows.h>
#include <string>
#include <vector>
#include <psapi.h>
#include <powrprof.h>
#include <iostream>

#pragma comment(lib, "user32.lib")
#pragma comment(lib, "psapi.lib")
#pragma comment(lib, "powrprof.lib")

using namespace Napi;

// ---------------------------------------------------------
// Focus Tracker
// ---------------------------------------------------------
Value GetActiveWindowApp(const CallbackInfo& info) {
    Env env = info.Env();
    HWND hwnd = GetForegroundWindow();
    if (hwnd == NULL) return String::New(env, "Desktop");

    DWORD pid;
    GetWindowThreadProcessId(hwnd, &pid);
    HANDLE processHandle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, pid);
    if (processHandle == NULL) return String::New(env, "Unknown");

    WCHAR path[MAX_PATH];
    if (GetModuleBaseNameW(processHandle, NULL, path, MAX_PATH)) {
        CloseHandle(processHandle);
        std::wstring ws(path);
        std::string s(ws.begin(), ws.end());
        // Remove .exe
        size_t lastindex = s.find_last_of("."); 
        if(lastindex != std::string::npos) s = s.substr(0, lastindex);
        return String::New(env, s);
    }
    CloseHandle(processHandle);
    return String::New(env, "System");
}

// ---------------------------------------------------------
// Power Profiles
// ---------------------------------------------------------
Value GetPowerProfile(const CallbackInfo& info) {
    Env env = info.Env();
    GUID* activePolicyGuid;
    if (PowerGetActiveScheme(NULL, &activePolicyGuid) == ERROR_SUCCESS) {
        // High Performance: 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
        // Balanced: 381b4222-f694-41f0-9685-ff5bb260df2e
        // Power Saver: a1841308-3541-4fab-bc81-f71556f20b4a
        
        wchar_t strGuid[50];
        StringFromGUID2(*activePolicyGuid, strGuid, 50);
        std::wstring ws(strGuid);
        std::string res(ws.begin(), ws.end());
        LocalFree(activePolicyGuid);

        if (res.find("8c5e7fda") != std::string::npos) return String::New(env, "performance");
        if (res.find("a1841308") != std::string::npos) return String::New(env, "power-saver");
        return String::New(env, "balanced");
    }
    return String::New(env, "balanced");
}

Value SetPowerProfile(const CallbackInfo& info) {
    Env env = info.Env();
    std::string profile = info[0].As<String>().Utf8Value();
    
    GUID perf = { 0x8c5e7fda, 0xe8bf, 0x4a96, { 0x9a, 0x85, 0xa6, 0xe2, 0x3a, 0x8c, 0x63, 0x5c } };
    GUID bal = { 0x381b4222, 0xf694, 0x41f0, { 0x96, 0x85, 0xff, 0x5b, 0xb2, 0x60, 0xdf, 0x2e } };
    GUID sav = { 0xa1841308, 0x3541, 0x4fab, { 0xbc, 0x81, 0xf7, 0x15, 0x56, 0xf2, 0x0b, 0x4a } };
    
    GUID* tgt = &bal;
    if (profile == "performance") tgt = &perf;
    else if(profile == "power-saver") tgt = &sav;

    PowerSetActiveScheme(NULL, tgt);
    return Boolean::New(env, true);
}

// ---------------------------------------------------------
// Monitors Topology
// ---------------------------------------------------------
Value GetDisplays(const CallbackInfo& info) {
    Env env = info.Env();
    Array arr = Array::New(env);

    DISPLAY_DEVICEW dd;
    dd.cb = sizeof(dd);
    DWORD deviceNum = 0;
    int arrIndex = 0;

    while (EnumDisplayDevicesW(NULL, deviceNum, &dd, 0)) {
        if ((dd.StateFlags & DISPLAY_DEVICE_ATTACHED_TO_DESKTOP) && 
            !(dd.StateFlags & DISPLAY_DEVICE_MIRRORING_DRIVER)) {
            
            DEVMODEW dm;
            dm.dmSize = sizeof(dm);
            dm.dmDriverExtra = 0;
            if (EnumDisplaySettingsW(dd.DeviceName, ENUM_CURRENT_SETTINGS, &dm)) {
                std::wstring devW(dd.DeviceName);
                std::string dev(devW.begin(), devW.end());
                std::wstring strW(dd.DeviceString);
                std::string str(strW.begin(), strW.end());

                Object obj = Object::New(env);
                obj.Set("id", dev);
                obj.Set("name", str);
                obj.Set("isPrimary", (bool)(dd.StateFlags & DISPLAY_DEVICE_PRIMARY_DEVICE));
                
                Object bounds = Object::New(env);
                bounds.Set("x", dm.dmPosition.x);
                bounds.Set("y", dm.dmPosition.y);
                bounds.Set("width", dm.dmPelsWidth);
                bounds.Set("height", dm.dmPelsHeight);
                obj.Set("bounds", bounds);
                
                obj.Set("scaleFactor", 1.0); // Native doesn't expose DPI scaling factor trivially, Electron is better
                
                arr.Set(arrIndex++, obj);
            }
        }
        deviceNum++;
    }
    return arr;
}

Value SetTopology(const CallbackInfo& info) {
    Env env = info.Env();
    Array layouts = info[0].As<Array>();

    // Prepare CDS_UPDATEREGISTRY | CDS_NORESET
    for (uint32_t i = 0; i < layouts.Length(); i++) {
        Object item = layouts.Get(i).As<Object>();
        std::string devName = item.Get("id").As<String>().Utf8Value();
        Object bounds = item.Get("bounds").As<Object>();
        int nx = bounds.Get("x").As<Number>().Int32Value();
        int ny = bounds.Get("y").As<Number>().Int32Value();
        int nw = bounds.Get("width").As<Number>().Int32Value();
        int nh = bounds.Get("height").As<Number>().Int32Value();

        std::wstring wDevName(devName.length(), L' ');
        std::copy(devName.begin(), devName.end(), wDevName.begin());

        DEVMODEW dm;
        dm.dmSize = sizeof(dm);
        dm.dmDriverExtra = 0;
        
        if (EnumDisplaySettingsW(wDevName.c_str(), ENUM_CURRENT_SETTINGS, &dm)) {
            dm.dmFields = DM_POSITION | DM_PELSWIDTH | DM_PELSHEIGHT;
            dm.dmPosition.x = nx;
            dm.dmPosition.y = ny;
            dm.dmPelsWidth = nw;
            dm.dmPelsHeight = nh;
            
            // Set for registry without resetting yet
            int res = ChangeDisplaySettingsExW(wDevName.c_str(), &dm, NULL, CDS_UPDATEREGISTRY | CDS_NORESET, NULL);
            if (res != DISP_CHANGE_SUCCESSFUL) {
                // Return false silently or handle error
            }
        }
    }

    // Apply geometry all at once
    ChangeDisplaySettingsEx(NULL, NULL, NULL, 0, NULL);
    
    return Boolean::New(env, true);
}


// ---------------------------------------------------------
// System Audio Equalizer (Stub for WASAPI sAPO integration)
// ---------------------------------------------------------
Value SetAudioEqualizer(const CallbackInfo& info) {
    Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsArray()) {
        TypeError::New(env, "Expected an array of 10 bands").ThrowAsJavaScriptException();
        return env.Null();
    }
    Array bands = info[0].As<Array>();
    std::vector<int> eqValues;
    for (uint32_t i = 0; i < bands.Length(); i++) {
        eqValues.push_back(bands.Get(i).As<Number>().Int32Value());
    }
    
    // Here we will eventually dispatch to the user's custom WasapiCapture APO or Windows Audio Session API
    std::cout << "[Native EQ] Applying 10-Band EQ Profile: ";
    for (int v : eqValues) std::cout << v << " ";
    std::cout << std::endl;

    return Boolean::New(env, true);
}


extern Object InitBattery(Env env, Object exports);
extern Object InitAudio(Env env, Object exports);
extern Object InitMisc(Env env, Object exports);
extern Object InitBrightness(Env env, Object exports);
extern Object InitMedia(Env env, Object exports);
extern Object InitNetwork(Env env, Object exports);
extern Object InitBluetooth(Env env, Object exports);

Object Init(Env env, Object exports) {
    exports.Set("getActiveWindowApp", Function::New(env, GetActiveWindowApp));
    exports.Set("getPowerProfile", Function::New(env, GetPowerProfile));
    exports.Set("setPowerProfile", Function::New(env, SetPowerProfile));
    exports.Set("getDisplays", Function::New(env, GetDisplays));
    exports.Set("setTopology", Function::New(env, SetTopology));
    exports.Set("setAudioEqualizer", Function::New(env, SetAudioEqualizer));

    InitBattery(env, exports);
    InitAudio(env, exports);
    InitMisc(env, exports);
    InitBrightness(env, exports);
    InitMedia(env, exports);
    InitNetwork(env, exports);
    InitBluetooth(env, exports);

    return exports;
}

NODE_API_MODULE(sys_utils, Init)
