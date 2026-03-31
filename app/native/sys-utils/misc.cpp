#include <napi.h>
#include <windows.h>
#include <string>

using namespace Napi;

Value GetWallpaper(const CallbackInfo& info) {
    Env env = info.Env();
    WCHAR path[MAX_PATH];
    if (SystemParametersInfoW(SPI_GETDESKWALLPAPER, MAX_PATH, path, 0)) {
        std::wstring ws(path);
        std::string s(ws.begin(), ws.end());
        return String::New(env, s);
    }
    return String::New(env, "");
}

Value SetWallpaper(const CallbackInfo& info) {
    Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsString()) return Boolean::New(env, false);
    
    std::string pathStr = info[0].As<String>().Utf8Value();
    std::wstring ws(pathStr.begin(), pathStr.end());
    
    BOOL res = SystemParametersInfoW(SPI_SETDESKWALLPAPER, 0, (void*)ws.c_str(), SPIF_UPDATEINIFILE | SPIF_SENDCHANGE);
    return Boolean::New(env, res == TRUE);
}

Value GetKeyboardLayoutExt(const CallbackInfo& info) {
    Env env = info.Env();
    HWND hwnd = GetForegroundWindow();
    DWORD threadId = GetWindowThreadProcessId(hwnd, NULL);
    HKL hkl = GetKeyboardLayout(threadId);

    // If hwnd is null or invalid, fallback to current thread layout
    if (hkl == NULL) hkl = GetKeyboardLayout(0);

    // Extract language ID
    LANGID langId = LOWORD(hkl);
    
    WCHAR localeName[9];
    if (GetLocaleInfoW(langId, LOCALE_SISO639LANGNAME, localeName, 9)) {
        std::wstring ws(localeName);
        std::string s(ws.begin(), ws.end());
        // For Quickshell users 'en' or 'ja'
        return String::New(env, s);
    }

    return String::New(env, "en");
}

Value SimulateWorkspaceSwitch(const CallbackInfo& info) {
    Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsString()) return Boolean::New(env, false);
    
    std::string direction = info[0].As<String>().Utf8Value();
    BYTE vkDir = (direction == "left") ? VK_LEFT : VK_RIGHT;

    // Press Win + Ctrl + (Left or Right)
    keybd_event(VK_LWIN, 0, 0, 0);
    keybd_event(VK_LCONTROL, 0, 0, 0);
    keybd_event(vkDir, 0, 0, 0);

    // Release them
    keybd_event(vkDir, 0, KEYEVENTF_KEYUP, 0);
    keybd_event(VK_LCONTROL, 0, KEYEVENTF_KEYUP, 0);
    keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0);

    return Boolean::New(env, true);
}

Object InitMisc(Env env, Object exports) {
    exports.Set("getWallpaper", Function::New(env, GetWallpaper));
    exports.Set("setWallpaper", Function::New(env, SetWallpaper));
    exports.Set("getKeyboardLayout", Function::New(env, GetKeyboardLayoutExt));
    exports.Set("simulateWorkspaceSwitch", Function::New(env, SimulateWorkspaceSwitch));
    return exports;
}
