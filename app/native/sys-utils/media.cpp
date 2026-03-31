#include <napi.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Media.Control.h>
#include <iostream>
#include <algorithm>

using namespace Napi;
using namespace winrt;
using namespace winrt::Windows::Media::Control;

Value GetMediaInfo(const CallbackInfo& info) {
    Env env = info.Env();

    try {
        init_apartment();
        auto manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync().get();
        auto session = manager.GetCurrentSession();
        if (!session) return env.Null();
        
        auto props = session.TryGetMediaPropertiesAsync().get();
        auto playbackInfo = session.GetPlaybackInfo();
        auto timeline = session.GetTimelineProperties();
        
        Object obj = Object::New(env);
        obj.Set("title", props ? to_string(props.Title()) : "");
        obj.Set("artist", props ? to_string(props.Artist()) : "");
        
        std::string sourceStr = to_string(session.SourceAppUserModelId());
        std::string srcLower = sourceStr;
        std::transform(srcLower.begin(), srcLower.end(), srcLower.begin(), ::tolower);
        
        std::string cleanSource = "System";
        if (srcLower.find("brave") != std::string::npos) cleanSource = "Brave";
        else if (srcLower.find("firefox") != std::string::npos) cleanSource = "Firefox";
        else if (srcLower.find("chrome") != std::string::npos) cleanSource = "Chrome";
        else if (srcLower.find("spotify") != std::string::npos) cleanSource = "Spotify";
        else cleanSource = sourceStr;
        
        obj.Set("app", cleanSource);

        std::string statusStr = "Stopped";
        if (playbackInfo) {
            auto state = playbackInfo.PlaybackStatus();
            if (state == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing) statusStr = "Playing";
            else if (state == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused) statusStr = "Paused";
        }
        obj.Set("status", statusStr);

        int pos = 0, dur = 0;
        if (timeline) {
            pos = timeline.Position().count() / 10000000;
            dur = timeline.EndTime().count() / 10000000;
        }
        obj.Set("position", pos);
        obj.Set("duration", dur);
        
        return obj;
    } catch (...) {
        return env.Null();
    }
}

Value TogglePlayPause(const CallbackInfo& info) {
    Env env = info.Env();
    try {
        init_apartment();
        auto manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync().get();
        auto session = manager.GetCurrentSession();
        if (session) session.TryTogglePlayPauseAsync().get();
    } catch (...) {}
    return Boolean::New(env, true);
}

Value NextMedia(const CallbackInfo& info) {
    Env env = info.Env();
    try {
        init_apartment();
        auto manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync().get();
        auto session = manager.GetCurrentSession();
        if (session) session.TrySkipNextAsync().get();
    } catch (...) {}
    return Boolean::New(env, true);
}

Value PrevMedia(const CallbackInfo& info) {
    Env env = info.Env();
    try {
        init_apartment();
        auto manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync().get();
        auto session = manager.GetCurrentSession();
        if (session) session.TrySkipPreviousAsync().get();
    } catch (...) {}
    return Boolean::New(env, true);
}

Object InitMedia(Env env, Object exports) {
    exports.Set("getMediaInfo", Function::New(env, GetMediaInfo));
    exports.Set("togglePlayPause", Function::New(env, TogglePlayPause));
    exports.Set("next", Function::New(env, NextMedia));
    exports.Set("previous", Function::New(env, PrevMedia));
    return exports;
}
