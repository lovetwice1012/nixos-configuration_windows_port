#include <windows.h>
#include <roapi.h>
#include <windows.media.control.h>
#include <wrl/client.h>
#include <iostream>

#pragma comment(lib, "runtimeobject.lib")

using namespace ABI::Windows::Media::Control;
using namespace Microsoft::WRL;

int main() {
    RoInitialize(RO_INIT_MULTITHREADED);
    ComPtr<IGlobalSystemMediaTransportControlsSessionManagerStatics> managerStatics;
    // Just a compilation test
    std::cout << "ABI WinRT works!" << std::endl;
    return 0;
}
