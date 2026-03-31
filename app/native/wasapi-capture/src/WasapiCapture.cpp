#include "WasapiCapture.h"
#include <wrl/client.h>
#include <wrl/implements.h>
#include <Psapi.h>
#include <iostream>
#include <initguid.h>

#ifndef VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK
#define VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK L"VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK"
#endif

#ifndef PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE
#define PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE 0
#define PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE 1
#endif

// Guard for older SDKs
#if !defined(_AUDCLNT_H_) || !defined(AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK)
typedef enum AUDIOCLIENT_ACTIVATION_TYPE {
    AUDIOCLIENT_ACTIVATION_TYPE_DEFAULT = 0,
    AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK = 1
} AUDIOCLIENT_ACTIVATION_TYPE;

typedef struct AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
    DWORD TargetProcessId;
    DWORD ProcessLoopbackMode;
} AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS;

typedef struct AUDIOCLIENT_ACTIVATION_PARAMS {
    AUDIOCLIENT_ACTIVATION_TYPE ActivationType;
    union {
        AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS ProcessLoopbackParams;
    } DUMMYUNIONNAME;
} AUDIOCLIENT_ACTIVATION_PARAMS;
#endif



#pragma comment(lib, "Mmdevapi.lib")
#pragma comment(lib, "ole32.lib")

using namespace Microsoft::WRL;

Napi::Object WasapiCapture::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "WasapiCapture", {
        InstanceMethod("startCapture", &WasapiCapture::StartCapture),
        InstanceMethod("stopCapture", &WasapiCapture::StopCapture),
        InstanceMethod("setEqBand", &WasapiCapture::SetEqBand),
        StaticMethod("getAudioSessions", &WasapiCapture::GetAudioSessions),
    });

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("WasapiCapture", func);
    return exports;
}

WasapiCapture::WasapiCapture(const Napi::CallbackInfo& info) : Napi::ObjectWrap<WasapiCapture>(info) {
    _isCapturing = false;
}

WasapiCapture::~WasapiCapture() {
    if (_isCapturing) {
        _isCapturing = false;
        if (_captureThread.joinable()) {
            _captureThread.join();
        }
    }
}

// Get Process Name helper
std::wstring GetProcessNameFast(DWORD processId) {
    std::wstring name = L"Unknown";
    HANDLE hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, FALSE, processId);
    if (hProcess) {
        WCHAR buffer[MAX_PATH];
        DWORD size = MAX_PATH;
        if (QueryFullProcessImageNameW(hProcess, 0, buffer, &size)) {
            std::wstring fullPath(buffer);
            size_t pos = fullPath.find_last_of(L"\\/");
            if (pos != std::wstring::npos) {
                name = fullPath.substr(pos + 1);
            } else {
                name = fullPath;
            }
        }
        CloseHandle(hProcess);
    }
    return name;
}

Napi::Value WasapiCapture::GetAudioSessions(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    bool coInit = SUCCEEDED(hr);

    ComPtr<IMMDeviceEnumerator> pEnumerator;
    hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), NULL, CLSCTX_ALL, IID_PPV_ARGS(&pEnumerator));
    
    ComPtr<IMMDevice> pDevice;
    hr = pEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &pDevice);

    ComPtr<IAudioSessionManager2> pSessionManager;
    hr = pDevice->Activate(__uuidof(IAudioSessionManager2), CLSCTX_ALL, NULL, (void**)&pSessionManager);

    ComPtr<IAudioSessionEnumerator> pSessionEnumerator;
    hr = pSessionManager->GetSessionEnumerator(&pSessionEnumerator);

    int count = 0;
    hr = pSessionEnumerator->GetCount(&count);

    Napi::Array result = Napi::Array::New(env, count);

    for (int i = 0; i < count; ++i) {
        ComPtr<IAudioSessionControl> pSessionCtrl;
        hr = pSessionEnumerator->GetSession(i, &pSessionCtrl);

        ComPtr<IAudioSessionControl2> pSessionCtrl2;
        hr = pSessionCtrl.As(&pSessionCtrl2);

        DWORD procId = 0;
        hr = pSessionCtrl2->GetProcessId(&procId);

        Napi::Object obj = Napi::Object::New(env);
        obj.Set("pid", Napi::Number::New(env, procId));
        
        std::wstring wname = GetProcessNameFast(procId);
        std::string name(wname.begin(), wname.end());
        obj.Set("name", Napi::String::New(env, name));
        
        result.Set(i, obj);
    }

    if (coInit) CoUninitialize();
    return result;
}

Napi::Value WasapiCapture::StartCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsFunction()) {
        Napi::TypeError::New(env, "Number (PID) and Function expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    DWORD targetPid = info[0].As<Napi::Number>().Uint32Value();
    Napi::Function callback = info[1].As<Napi::Function>();

    _tsfn = Napi::ThreadSafeFunction::New(
        env, callback, "WASAPICaptureCallback", 0, 1,
        [this](Napi::Env) {
            _captureThread.join();
        }
    );

    _isCapturing = true;
    _captureThread = std::thread(&WasapiCapture::CaptureThread, this, targetPid);

    return env.Null();
}

Napi::Value WasapiCapture::StopCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (_isCapturing) {
        _isCapturing = false;
        _tsfn.Release();
    }
    return env.Null();
}

Napi::Value WasapiCapture::SetEqBand(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 4) return env.Null();
    
    int band = info[0].As<Napi::Number>().Int32Value();
    float freq = info[1].As<Napi::Number>().FloatValue();
    float gain = info[2].As<Napi::Number>().FloatValue();
    float q = info[3].As<Napi::Number>().FloatValue();

    if (band >= 0 && band < 10) {
        std::lock_guard<std::mutex> lock(_eqMutex);
        _eqFilters[band][0].update(freq, gain, q, 48000.0f); // Default FS, updated dynamically later
        _eqFilters[band][1].update(freq, gain, q, 48000.0f);
        _eqActive = true;
    }
    return env.Null();
}

void WasapiCapture::ProcessFilters(float* audioData, UINT32 numFrames, WORD nChannels, DWORD sampleRate) {
    std::lock_guard<std::mutex> lock(_eqMutex);
    if (!_eqActive) return;

    for (UINT32 i = 0; i < numFrames; i++) {
        for (WORD c = 0; c < nChannels && c < 2; c++) {
            float in = audioData[i * nChannels + c];
            float out = in;
            
            // Apply all EQ bands sequentially
            for (int b = 0; b < 10; b++) {
                if (_eqFilters[b][c].f0 > 0) { // Active filter check
                    // Ensure sample rate matches
                    if (_eqFilters[b][c].fs != (float)sampleRate) {
                        _eqFilters[b][c].update(_eqFilters[b][c].f0, _eqFilters[b][c].gain, _eqFilters[b][c].q, (float)sampleRate);
                    }
                    out = _eqFilters[b][c].process(out);
                }
            }
            
            // To produce the purely "Difference" (the Phase Inverted Canceling sound):
            // Diff = EQ(in) - original_in
            // Diff Phase Inverted = (EQ(in) - in) * -1 = in - EQ(in)
            // Actually, the user wants the difference to be output so that Mix = in + diff = EQ(in).
            // So Diff = EQ(in) - in. We output this directly through our renderer!
            //Wait, if we emit Diff, the physical room mixes them. If we just output Diff over speaker, the mix is EQ.
            audioData[i * nChannels + c] = out - in; 
        }
    }
}

// ----- Capture Thread Logic -----
class AudioClientActivator : public RuntimeClass<RuntimeClassFlags<ClassicCom>, IActivateAudioInterfaceCompletionHandler> {
public:
    HANDLE hEvent;
    ComPtr<IAudioClient> pAudioClient;
    HRESULT hrActivate;

    AudioClientActivator() {
        hEvent = CreateEventEx(NULL, NULL, 0, EVENT_ALL_ACCESS);
        hrActivate = E_FAIL;
    }
    ~AudioClientActivator() {
        if (hEvent) CloseHandle(hEvent);
    }

    STDMETHODIMP ActivateCompleted(IActivateAudioInterfaceAsyncOperation *operation) override {
        ComPtr<IUnknown> punkAudioInterface;
        HRESULT hrActivateResult;
        HRESULT hr = operation->GetActivateResult(&hrActivateResult, &punkAudioInterface);
        if (SUCCEEDED(hr) && SUCCEEDED(hrActivateResult)) {
            punkAudioInterface.As(&pAudioClient);
        }
        hrActivate = hrActivateResult;
        SetEvent(hEvent);
        return S_OK;
    }
};

void WasapiCapture::CaptureThread(DWORD targetProcessId) {
    CoInitializeEx(NULL, COINIT_MULTITHREADED);
    
    // Fallback: System Loopback if PID == 0, else Process Loopback
    // For simplicity, building standard system loopback if process loopback is missing in SDK
    // Let's implement full Process Loopback
    
    // Windows 10 Build 20348+ (Process Loopback API)
    AUDIOCLIENT_ACTIVATION_PARAMS params = {};
    params.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
    params.ProcessLoopbackParams.TargetProcessId = targetProcessId;
    params.ProcessLoopbackParams.ProcessLoopbackMode = PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;

    PROPVARIANT var;
    PropVariantInit(&var);
    var.vt = VT_BLOB;
    var.blob.cbSize = sizeof(params);
    var.blob.pBlobData = (BYTE*)&params;

    ComPtr<AudioClientActivator> activator = Make<AudioClientActivator>();
    ComPtr<IActivateAudioInterfaceAsyncOperation> asyncOp;

    HRESULT hr = ActivateAudioInterfaceAsync(
        VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK, // PCWSTR deviceInterfacePath
        __uuidof(IAudioClient),
        &var,
        activator.Get(),
        &asyncOp
    );

    if (SUCCEEDED(hr)) {
        WaitForSingleObject(activator->hEvent, INFINITE);
    }

    ComPtr<IAudioClient> pAudioClient = activator->pAudioClient;
    if (!pAudioClient) {
        CoUninitialize();
        return; // failed
    }

    WAVEFORMATEX* pwfx = NULL;
    hr = pAudioClient->GetMixFormat(&pwfx);

    hr = pAudioClient->Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
        0, 0, pwfx, NULL
    );

    HANDLE hAudioEvent = CreateEvent(NULL, FALSE, FALSE, NULL);
    pAudioClient->SetEventHandle(hAudioEvent);

    ComPtr<IAudioCaptureClient> pCaptureClient;
    hr = pAudioClient->GetService(__uuidof(IAudioCaptureClient), (void**)&pCaptureClient);

    // --- Initialize WASAPI Render for outputting the Diff wave ---
    ComPtr<IMMDeviceEnumerator> pEnumerator;
    hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), NULL, CLSCTX_ALL, IID_PPV_ARGS(&pEnumerator));
    ComPtr<IMMDevice> pOutputDevice;
    hr = pEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &pOutputDevice);
    
    ComPtr<IAudioClient> pRenderAudioClient;
    hr = pOutputDevice->Activate(__uuidof(IAudioClient), CLSCTX_ALL, NULL, (void**)&pRenderAudioClient);
    
    hr = pRenderAudioClient->Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        0, 0, 0, pwfx, NULL
    );
    
    ComPtr<IAudioRenderClient> pRenderClient;
    hr = pRenderAudioClient->GetService(__uuidof(IAudioRenderClient), (void**)&pRenderClient);
    
    if (SUCCEEDED(hr)) {
        pRenderAudioClient->Start();
    }
    // -----------------------------------------------------------------

    hr = pAudioClient->Start();

    while (_isCapturing) {
        DWORD waitResult = WaitForSingleObject(hAudioEvent, 100);
        if (waitResult == WAIT_OBJECT_0) {
            BYTE* pData;
            UINT32 numFramesAvailable;
            DWORD flags;
            hr = pCaptureClient->GetBuffer(&pData, &numFramesAvailable, &flags, NULL, NULL);

            if (SUCCEEDED(hr) && numFramesAvailable > 0) {
                if (pwfx->wFormatTag == WAVE_FORMAT_EXTENSIBLE || pwfx->wFormatTag == WAVE_FORMAT_IEEE_FLOAT) {
                    float* pFloatData = (float*)pData;
                    
                    // In-place filter processing (to create Diff wave)
                    ProcessFilters(pFloatData, numFramesAvailable, pwfx->nChannels, pwfx->nSamplesPerSec);
                    
                    // Write to WASAPI Render
                    if (pRenderClient && _eqActive) {
                        BYTE* pRenderData = nullptr;
                        hr = pRenderClient->GetBuffer(numFramesAvailable, &pRenderData);
                        if (SUCCEEDED(hr)) {
                            memcpy(pRenderData, pFloatData, numFramesAvailable * pwfx->nChannels * sizeof(float));
                            pRenderClient->ReleaseBuffer(numFramesAvailable, 0);
                        }
                    }

                    int samples = numFramesAvailable * pwfx->nChannels;
                    std::vector<float>* pBuffer = new std::vector<float>(pFloatData, pFloatData + samples);
                    
                    _tsfn.NonBlockingCall(pBuffer, [](Napi::Env env, Napi::Function jsCb, std::vector<float>* data) {
                        Napi::Float32Array array = Napi::Float32Array::New(env, data->size());
                        memcpy(array.Data(), data->data(), data->size() * sizeof(float));
                        jsCb.Call({ array });
                        delete data;
                    });
                }
                pCaptureClient->ReleaseBuffer(numFramesAvailable);
            }
        }
    }

    pAudioClient->Stop();
    if (pRenderAudioClient) pRenderAudioClient->Stop();
    CloseHandle(hAudioEvent);
    CoTaskMemFree(pwfx);
    CoUninitialize();
}
