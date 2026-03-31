#include <napi.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <wlanapi.h>
#include <iphlpapi.h>
#include <string>
#include <vector>

#pragma comment(lib, "wlanapi.lib")
#pragma comment(lib, "iphlpapi.lib")
#pragma comment(lib, "ws2_32.lib")

using namespace Napi;

// Helper to get IP Address
std::string GetWiFiIPAddress() {
    std::string ipAddr = "";
    ULONG outBufLen = 15000;
    PIP_ADAPTER_ADDRESSES pAddresses = (IP_ADAPTER_ADDRESSES*)HeapAlloc(GetProcessHeap(), 0, outBufLen);
    if (!pAddresses) return ipAddr;

    DWORD dwRetVal = GetAdaptersAddresses(AF_INET, GAA_FLAG_INCLUDE_PREFIX, NULL, pAddresses, &outBufLen);
    if (dwRetVal == ERROR_BUFFER_OVERFLOW) {
        HeapFree(GetProcessHeap(), 0, pAddresses);
        pAddresses = (IP_ADAPTER_ADDRESSES*)HeapAlloc(GetProcessHeap(), 0, outBufLen);
        if (!pAddresses) return ipAddr;
        dwRetVal = GetAdaptersAddresses(AF_INET, GAA_FLAG_INCLUDE_PREFIX, NULL, pAddresses, &outBufLen);
    }

    if (dwRetVal == NO_ERROR) {
        PIP_ADAPTER_ADDRESSES pCurrAddresses = pAddresses;
        while (pCurrAddresses) {
            if (pCurrAddresses->IfType == IF_TYPE_IEEE80211 && pCurrAddresses->OperStatus == IfOperStatusUp) {
                PIP_ADAPTER_UNICAST_ADDRESS pUnicast = pCurrAddresses->FirstUnicastAddress;
                if (pUnicast) {
                    sockaddr_in* sa_in = (sockaddr_in*)pUnicast->Address.lpSockaddr;
                    char ipStr[INET_ADDRSTRLEN];
                    if (inet_ntop(AF_INET, &(sa_in->sin_addr), ipStr, INET_ADDRSTRLEN)) {
                        ipAddr = ipStr;
                        break;
                    }
                }
            }
            pCurrAddresses = pCurrAddresses->Next;
        }
    }
    HeapFree(GetProcessHeap(), 0, pAddresses);
    return ipAddr;
}

Value GetNetworkInfo(const CallbackInfo& info) {
    Env env = info.Env();
    Object result = Object::New(env);
    
    // Default values
    result.Set("status", "Off");
    result.Set("icon", "󰤮");
    result.Set("ssid", "");
    result.Set("signal", 0);
    result.Set("isConnected", false);
    result.Set("ip", "");
    result.Set("freq", "");
    result.Set("security", "");
    result.Set("bssid", "");

    HANDLE hClient = NULL;
    DWORD dwMaxClient = 2;
    DWORD dwCurVersion = 0;
    if (WlanOpenHandle(dwMaxClient, NULL, &dwCurVersion, &hClient) != ERROR_SUCCESS) {
        return result;
    }

    PWLAN_INTERFACE_INFO_LIST pIfList = NULL;
    if (WlanEnumInterfaces(hClient, NULL, &pIfList) == ERROR_SUCCESS) {
        for (int i = 0; i < (int)pIfList->dwNumberOfItems; i++) {
            PWLAN_INTERFACE_INFO pIfInfo = (PWLAN_INTERFACE_INFO)&pIfList->InterfaceInfo[i];
            
            if (pIfInfo->isState == wlan_interface_state_connected) {
                // Get Connection Attributes
                PWLAN_CONNECTION_ATTRIBUTES pConnectInfo = NULL;
                DWORD connectInfoSize = sizeof(WLAN_CONNECTION_ATTRIBUTES);
                if (WlanQueryInterface(hClient, &pIfInfo->InterfaceGuid, wlan_intf_opcode_current_connection, NULL, &connectInfoSize, (PVOID*)&pConnectInfo, NULL) == ERROR_SUCCESS) {
                    
                    std::string ssid(pConnectInfo->wlanAssociationAttributes.dot11Ssid.ucSSID, pConnectInfo->wlanAssociationAttributes.dot11Ssid.ucSSID + pConnectInfo->wlanAssociationAttributes.dot11Ssid.uSSIDLength);
                    int signal = pConnectInfo->wlanAssociationAttributes.wlanSignalQuality;
                    
                    std::string freq = "";
                    if (pConnectInfo->wlanAssociationAttributes.dot11PhyType == dot11_phy_type_ofdm || 
                        pConnectInfo->wlanAssociationAttributes.dot11PhyType == dot11_phy_type_he || 
                        pConnectInfo->wlanAssociationAttributes.dot11PhyType == dot11_phy_type_ht) {
                        freq = "5 GHz"; // Naive simplification, but matches old netsh parse
                    } else {
                        freq = "2.4 GHz";
                    }

                    std::string security = "Protected";
                    if (pConnectInfo->wlanSecurityAttributes.dot11AuthAlgorithm == DOT11_AUTH_ALGO_80211_OPEN) {
                        security = "Open";
                    } else if (pConnectInfo->wlanSecurityAttributes.dot11AuthAlgorithm == DOT11_AUTH_ALGO_WPA3 ||
                               pConnectInfo->wlanSecurityAttributes.dot11AuthAlgorithm == DOT11_AUTH_ALGO_WPA3_ENT ||
                               pConnectInfo->wlanSecurityAttributes.dot11AuthAlgorithm == DOT11_AUTH_ALGO_WPA3_SAE) {
                        security = "WPA3";
                    } else if (pConnectInfo->wlanSecurityAttributes.dot11AuthAlgorithm == DOT11_AUTH_ALGO_RSNA_PSK ||
                               pConnectInfo->wlanSecurityAttributes.dot11AuthAlgorithm == DOT11_AUTH_ALGO_WPA ||
                               pConnectInfo->wlanSecurityAttributes.dot11AuthAlgorithm == DOT11_AUTH_ALGO_WPA_PSK) {
                        security = "WPA2";
                    }
                    
                    char bssidStr[18];
                    sprintf_s(bssidStr, "%02X:%02X:%02X:%02X:%02X:%02X", 
                        pConnectInfo->wlanAssociationAttributes.dot11Bssid[0],
                        pConnectInfo->wlanAssociationAttributes.dot11Bssid[1],
                        pConnectInfo->wlanAssociationAttributes.dot11Bssid[2],
                        pConnectInfo->wlanAssociationAttributes.dot11Bssid[3],
                        pConnectInfo->wlanAssociationAttributes.dot11Bssid[4],
                        pConnectInfo->wlanAssociationAttributes.dot11Bssid[5]);
                        
                    std::string icon = "󰤮";
                    if (signal >= 75) icon = "󰤨";
                    else if (signal >= 50) icon = "󰤥";
                    else if (signal >= 25) icon = "󰤢";
                    else icon = "󰤟";

                    result.Set("status", "Enabled");
                    result.Set("icon", icon);
                    result.Set("ssid", ssid);
                    result.Set("signal", signal);
                    result.Set("isConnected", true);
                    result.Set("freq", freq);
                    result.Set("security", security);
                    result.Set("bssid", bssidStr);
                    result.Set("ip", GetWiFiIPAddress());
                    
                    WlanFreeMemory(pConnectInfo);
                    break; // Just use first connected interface
                }
            }
        }
        WlanFreeMemory(pIfList);
    }
    WlanCloseHandle(hClient, NULL);
    
    return result;
}

Value GetAvailableNetworks(const CallbackInfo& info) {
    Env env = info.Env();
    Array result = Array::New(env);

    HANDLE hClient = NULL;
    DWORD dwMaxClient = 2;
    DWORD dwCurVersion = 0;
    if (WlanOpenHandle(dwMaxClient, NULL, &dwCurVersion, &hClient) != ERROR_SUCCESS) {
        return result;
    }

    PWLAN_INTERFACE_INFO_LIST pIfList = NULL;
    if (WlanEnumInterfaces(hClient, NULL, &pIfList) == ERROR_SUCCESS) {
        if (pIfList->dwNumberOfItems > 0) {
            PWLAN_INTERFACE_INFO pIfInfo = (PWLAN_INTERFACE_INFO)&pIfList->InterfaceInfo[0];
            
            PWLAN_AVAILABLE_NETWORK_LIST pBssList = NULL;
            if (WlanGetAvailableNetworkList(hClient, &pIfInfo->InterfaceGuid, WLAN_AVAILABLE_NETWORK_INCLUDE_ALL_ADHOC_PROFILES, NULL, &pBssList) == ERROR_SUCCESS) {
                
                uint32_t idx = 0;
                for (int i = 0; i < (int)pBssList->dwNumberOfItems; i++) {
                    PWLAN_AVAILABLE_NETWORK pNet = (PWLAN_AVAILABLE_NETWORK)&pBssList->Network[i];
                    std::string ssid(pNet->dot11Ssid.ucSSID, pNet->dot11Ssid.ucSSID + pNet->dot11Ssid.uSSIDLength);
                    if (ssid.empty()) continue;
                    
                    Object netInfo = Object::New(env);
                    netInfo.Set("ssid", ssid);
                    netInfo.Set("signal", (int)pNet->wlanSignalQuality);
                    
                    std::string auth = "Open";
                    if (pNet->dot11DefaultAuthAlgorithm != DOT11_AUTH_ALGO_80211_OPEN) auth = "Protected";
                    netInfo.Set("auth", auth);
                    
                    result.Set(idx++, netInfo);
                }
                WlanFreeMemory(pBssList);
            }
        }
        WlanFreeMemory(pIfList);
    }
    WlanCloseHandle(hClient, NULL);
    return result;
}

Object InitNetwork(Env env, Object exports) {
    exports.Set("getNetworkInfo", Function::New(env, GetNetworkInfo));
    exports.Set("getAvailableNetworks", Function::New(env, GetAvailableNetworks));
    return exports;
}
