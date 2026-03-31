#include <napi.h>
#include <windows.h>
#include <string>
#include <Wbemidl.h>

#pragma comment(lib, "wbemuuid.lib")

using namespace Napi;

// Setup generic Wbem Services
IWbemServices* GetWbemServices() {
    HRESULT hr = CoInitializeEx(0, COINIT_MULTITHREADED);
    
    IWbemLocator* pLoc = NULL;
    hr = CoCreateInstance(CLSID_WbemLocator, 0, CLSCTX_INPROC_SERVER, IID_IWbemLocator, (LPVOID*)&pLoc);
    if (FAILED(hr)) return nullptr;

    IWbemServices* pSvc = NULL;
    BSTR bstrRootWmi = SysAllocString(L"ROOT\\WMI");
    hr = pLoc->ConnectServer(bstrRootWmi, NULL, NULL, 0, NULL, 0, 0, &pSvc);
    SysFreeString(bstrRootWmi);
    if (FAILED(hr)) { pLoc->Release(); return nullptr; }

    hr = CoSetProxyBlanket(pSvc, RPC_C_AUTHN_WINNT, RPC_C_AUTHZ_NONE, NULL, RPC_C_AUTHN_LEVEL_CALL, RPC_C_IMP_LEVEL_IMPERSONATE, NULL, EOAC_NONE);
    if (FAILED(hr)) { pSvc->Release(); pLoc->Release(); return nullptr; }

    pLoc->Release();
    return pSvc;
}

Value GetBrightness(const CallbackInfo& info) {
    Env env = info.Env();
    IWbemServices* pSvc = GetWbemServices();
    if (!pSvc) return env.Null();

    IEnumWbemClassObject* pEnumerator = NULL;
    BSTR bstrQueryLang = SysAllocString(L"WQL");
    BSTR bstrQuery = SysAllocString(L"SELECT * FROM WmiMonitorBrightness");
    HRESULT hr = pSvc->ExecQuery(bstrQueryLang, bstrQuery, WBEM_FLAG_FORWARD_ONLY | WBEM_FLAG_RETURN_IMMEDIATELY, NULL, &pEnumerator);
    SysFreeString(bstrQueryLang);
    SysFreeString(bstrQuery);
    
    if (FAILED(hr)) { pSvc->Release(); return env.Null(); }

    IWbemClassObject* pclsObj = NULL;
    ULONG uReturn = 0;
    int brightness = 50;

    while (pEnumerator) {
        hr = pEnumerator->Next(WBEM_INFINITE, 1, &pclsObj, &uReturn);
        if (0 == uReturn) break;

        VARIANT vtProp;
        hr = pclsObj->Get(L"CurrentBrightness", 0, &vtProp, 0, 0);
        if (SUCCEEDED(hr) && vtProp.vt == VT_UI1) {
            brightness = vtProp.bVal;
        }
        VariantClear(&vtProp);
        pclsObj->Release();
        break; // Just the first monitor
    }

    pEnumerator->Release();
    pSvc->Release();
    CoUninitialize();

    return Number::New(env, brightness);
}

Value SetBrightness(const CallbackInfo& info) {
    Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsNumber()) return Boolean::New(env, false);
    
    int level = info[0].As<Number>().Int32Value();
    if (level < 0) level = 0;
    if (level > 100) level = 100;

    IWbemServices* pSvc = GetWbemServices();
    if (!pSvc) return Boolean::New(env, false);

    IEnumWbemClassObject* pEnumerator = NULL;
    BSTR bstrQueryLang = SysAllocString(L"WQL");
    BSTR bstrQuery = SysAllocString(L"SELECT * FROM WmiMonitorBrightnessMethods");
    HRESULT hr = pSvc->ExecQuery(bstrQueryLang, bstrQuery, WBEM_FLAG_FORWARD_ONLY | WBEM_FLAG_RETURN_IMMEDIATELY, NULL, &pEnumerator);
    SysFreeString(bstrQueryLang);
    SysFreeString(bstrQuery);

    if (FAILED(hr)) { pSvc->Release(); return Boolean::New(env, false); }

    IWbemClassObject* pclsObj = NULL;
    ULONG uReturn = 0;

    while (pEnumerator) {
        hr = pEnumerator->Next(WBEM_INFINITE, 1, &pclsObj, &uReturn);
        if (0 == uReturn) break;

        VARIANT vtPath;
        pclsObj->Get(L"__PATH", 0, &vtPath, 0, 0);

        BSTR bstrWmiSetBrightness = SysAllocString(L"WmiSetBrightness");
        BSTR bstrMethodClass = SysAllocString(L"WmiMonitorBrightnessMethods");

        IWbemClassObject* pClass = NULL;
        hr = pSvc->GetObject(bstrMethodClass, 0, NULL, &pClass, NULL);
        
        if (SUCCEEDED(hr) && pClass) {
            IWbemClassObject* pInParamsDefinition = NULL;
            hr = pClass->GetMethod(bstrWmiSetBrightness, 0, &pInParamsDefinition, NULL);
            
            if (SUCCEEDED(hr) && pInParamsDefinition) {
                IWbemClassObject* pClassInstance = NULL;
                pInParamsDefinition->SpawnInstance(0, &pClassInstance);

                VARIANT varTo, varBr;
                varTo.vt = VT_UI4; varTo.ulVal = 1;
                varBr.vt = VT_UI1; varBr.bVal = level;

                pClassInstance->Put(L"Timeout", 0, &varTo, 0);
                pClassInstance->Put(L"Brightness", 0, &varBr, 0);

                hr = pSvc->ExecMethod(vtPath.bstrVal, bstrWmiSetBrightness, 0, NULL, pClassInstance, NULL, NULL);

                pClassInstance->Release();
                pInParamsDefinition->Release();
            }
            pClass->Release();
        }

        SysFreeString(bstrWmiSetBrightness);
        SysFreeString(bstrMethodClass);

        VariantClear(&vtPath);
        pclsObj->Release();
    }

    pEnumerator->Release();
    pSvc->Release();
    CoUninitialize();

    return Boolean::New(env, true);
}

Object InitBrightness(Env env, Object exports) {
    exports.Set("getBrightness", Function::New(env, GetBrightness));
    exports.Set("setBrightness", Function::New(env, SetBrightness));
    return exports;
}
