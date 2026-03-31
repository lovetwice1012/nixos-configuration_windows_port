#pragma once

#include <napi.h>
#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <audiopolicy.h>
#include <string>
#include <vector>
#include <thread>
#include <atomic>
#include <mutex>

struct AudioSessionInfo {
    DWORD processId;
    std::wstring processName;
};

struct BiquadFilter {
    float f0, gain, q, fs;
    float b0, b1, b2, a1, a2;
    float x1, x2, y1, y2;

    BiquadFilter() { reset(); }
    void reset() { x1 = x2 = y1 = y2 = 0.0f; }
    void update(float freq, float dbGain, float qFactor, float sampleRate) {
        f0 = freq; gain = dbGain; q = qFactor; fs = sampleRate;
        float A = pow(10.0f, gain / 40.0f);
        float w0 = 2.0f * 3.14159265358979f * f0 / fs;
        float alpha = sin(w0) / (2.0f * q);
        float a0 = 1.0f + alpha / A;
        b0 = (1.0f + alpha * A) / a0;
        b1 = (-2.0f * cos(w0)) / a0;
        b2 = (1.0f - alpha * A) / a0;
        a1 = (-2.0f * cos(w0)) / a0;
        a2 = (1.0f - alpha / A) / a0;
    }
    float process(float in) {
        float out = b0 * in + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = in; y2 = y1; y1 = out;
        return out;
    }
};


class WasapiCapture : public Napi::ObjectWrap<WasapiCapture> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    WasapiCapture(const Napi::CallbackInfo& info);
    ~WasapiCapture();

private:
    // JS Methods
    Napi::Value StartCapture(const Napi::CallbackInfo& info);
    Napi::Value StopCapture(const Napi::CallbackInfo& info);
    Napi::Value SetEqBand(const Napi::CallbackInfo& info);
    static Napi::Value GetAudioSessions(const Napi::CallbackInfo& info);

    // Audio Capture Thread
    void CaptureThread(DWORD targetProcessId);

    // Filter Logic
    void ProcessFilters(float* audioData, UINT32 numFrames, WORD nChannels, DWORD sampleRate);

    // Thread Safety & Context
    Napi::ThreadSafeFunction _tsfn;
    std::thread _captureThread;
    std::atomic<bool> _isCapturing;

    std::mutex _eqMutex;
    // up to 10 bands, 2 channels
    BiquadFilter _eqFilters[10][2];
    bool _eqActive = false;

    // Buffer to send over N-API
    std::vector<float> _pcmBuffer;
};
