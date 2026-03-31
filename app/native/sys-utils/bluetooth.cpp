#include <napi.h>
#include <windows.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Devices.Bluetooth.h>
#include <winrt/Windows.Devices.Enumeration.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <string>

using namespace Napi;
using namespace winrt;
using namespace winrt::Windows::Devices::Enumeration;
using namespace winrt::Windows::Devices::Bluetooth;

std::string ws2s(const std::wstring& wstr) {
    if(wstr.empty()) return std::string();
    int size_needed = WideCharToMultiByte(CP_UTF8, 0, &wstr[0], (int)wstr.size(), NULL, 0, NULL, NULL);
    std::string strTo(size_needed, 0);
    WideCharToMultiByte(CP_UTF8, 0, &wstr[0], (int)wstr.size(), &strTo[0], size_needed, NULL, NULL);
    return strTo;
}

Value GetBluetoothInfo(const CallbackInfo& info) {
    Env env = info.Env();
    
    std::string deviceName = "";
    bool isOn = false;
    bool isConnected = false;

    try {
        init_apartment();
        auto filter = BluetoothAdapter::GetDeviceSelector();
        auto adapters = DeviceInformation::FindAllAsync(filter).get();
        if (adapters.Size() > 0) {
            isOn = true;
            // Now get connected devices
            auto pairedFilter = BluetoothDevice::GetDeviceSelectorFromPairingState(true);
            auto pairedDevices = DeviceInformation::FindAllAsync(pairedFilter).get();
            for (auto const& dev : pairedDevices) {
                // To check if connected, we need to try getting the BluetoothDevice object
                try {
                    auto btDev = BluetoothDevice::FromIdAsync(dev.Id()).get();
                    if (btDev && btDev.ConnectionStatus() == BluetoothConnectionStatus::Connected) {
                        isConnected = true;
                        deviceName = ws2s(std::wstring(btDev.Name()));
                        break;
                    }
                } catch(...) {}
            }
        }
    } catch (...) {}

    std::string icon = "󰂲";
    if (isOn) icon = isConnected ? "󰂱" : "󰂯";
    
    Object result = Object::New(env);
    result.Set("status", isOn ? "Enabled" : "Off");
    result.Set("icon", icon);
    result.Set("device", deviceName);
    result.Set("isOn", isOn);
    result.Set("isConnected", isConnected);
    return result;
}

Value GetAvailableDevices(const CallbackInfo& info) {
    Env env = info.Env();
    Array arr = Array::New(env);
    uint32_t idx = 0;

    try {
        init_apartment();
        auto pairedFilter = BluetoothDevice::GetDeviceSelectorFromPairingState(true);
        auto pairedDevices = DeviceInformation::FindAllAsync(pairedFilter).get();
        
        for (auto const& dev : pairedDevices) {
            Object obj = Object::New(env);
            obj.Set("name", ws2s(std::wstring(dev.Name())));
            std::string statusStr = "Paired";
            
            try {
                auto btDev = BluetoothDevice::FromIdAsync(dev.Id()).get();
                if (btDev && btDev.ConnectionStatus() == BluetoothConnectionStatus::Connected) {
                    statusStr = "Connected";
                }
            } catch(...) {}
            
            obj.Set("status", statusStr);
            arr.Set(idx++, obj);
        }
    } catch (...) {}

    return arr;
}

Object InitBluetooth(Env env, Object exports) {
    exports.Set("getBluetoothInfo", Function::New(env, GetBluetoothInfo));
    exports.Set("getAvailableDevices", Function::New(env, GetAvailableDevices));
    return exports;
}
