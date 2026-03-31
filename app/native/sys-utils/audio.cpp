#include <napi.h>
#include <windows.h>
#include <mmdeviceapi.h>
#include <endpointvolume.h>

using namespace Napi;

IAudioEndpointVolume* GetAudioEndpointVolume() {
    HRESULT hr = CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);
    if (FAILED(hr) && hr != RPC_E_CHANGED_MODE) return nullptr;

    IMMDeviceEnumerator* deviceEnumerator = nullptr;
    hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_INPROC_SERVER, __uuidof(IMMDeviceEnumerator), (LPVOID*)&deviceEnumerator);
    if (FAILED(hr) || !deviceEnumerator) { CoUninitialize(); return nullptr; }

    IMMDevice* defaultDevice = nullptr;
    hr = deviceEnumerator->GetDefaultAudioEndpoint(eRender, eMultimedia, &defaultDevice);
    deviceEnumerator->Release();
    if (FAILED(hr) || !defaultDevice) { CoUninitialize(); return nullptr; }

    IAudioEndpointVolume* endpointVolume = nullptr;
    hr = defaultDevice->Activate(__uuidof(IAudioEndpointVolume), CLSCTX_INPROC_SERVER, nullptr, (LPVOID*)&endpointVolume);
    defaultDevice->Release();
    if (FAILED(hr) || !endpointVolume) { CoUninitialize(); return nullptr; }

    return endpointVolume;
}

Value GetVolume(const CallbackInfo& info) {
    Env env = info.Env();
    
    IAudioEndpointVolume* epvol = GetAudioEndpointVolume();
    if (!epvol) return env.Null();
    
    float level = 0.0f;
    epvol->GetMasterVolumeLevelScalar(&level);
    
    BOOL mute = FALSE;
    epvol->GetMute(&mute);
    
    epvol->Release();
    CoUninitialize();

    Object obj = Object::New(env);
    obj.Set("volume", (int)(level * 100.0f));
    obj.Set("muted", mute == TRUE);
    return obj;
}

Value SetVolume(const CallbackInfo& info) {
    Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsNumber()) return Boolean::New(env, false);
    
    int target = info[0].As<Number>().Int32Value();
    float level = target / 100.0f;
    if (level < 0.0f) level = 0.0f;
    if (level > 1.0f) level = 1.0f;
    
    IAudioEndpointVolume* epvol = GetAudioEndpointVolume();
    if (!epvol) return Boolean::New(env, false);
    
    epvol->SetMasterVolumeLevelScalar(level, nullptr);
    epvol->SetMute(FALSE, nullptr);
    
    epvol->Release();
    CoUninitialize();
    return Boolean::New(env, true);
}

Value ToggleMute(const CallbackInfo& info) {
    Env env = info.Env();
    IAudioEndpointVolume* epvol = GetAudioEndpointVolume();
    if (!epvol) return Boolean::New(env, false);
    
    BOOL mute = FALSE;
    epvol->GetMute(&mute);
    epvol->SetMute(!mute, nullptr);
    
    epvol->Release();
    CoUninitialize();
    return Boolean::New(env, true);
}

Object InitAudio(Env env, Object exports) {
    exports.Set("getAudio", Function::New(env, GetVolume));
    exports.Set("setAudio", Function::New(env, SetVolume));
    exports.Set("toggleMute", Function::New(env, ToggleMute));
    return exports;
}
