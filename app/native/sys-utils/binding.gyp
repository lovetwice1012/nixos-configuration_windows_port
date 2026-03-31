{
  "targets": [
    {
      "target_name": "sys_utils",
      "sources": [ "sys_utils.cpp", "battery.cpp", "audio.cpp", "misc.cpp", "brightness.cpp", "media.cpp", "network.cpp", "bluetooth.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": [ "/await", "/std:c++17", "/utf-8" ]
        }
      },
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "libraries": [
        "-lUser32.lib",
        "-lPowrProf.lib",
        "-lPsapi.lib",
        "-lOle32.lib",
        "-lWlanapi.lib",
        "-lWbemuuid.lib",
        "-lRuntimeObject.lib",
        "-lWs2_32.lib",
        "-lIphlpapi.lib"
      ]
    }
  ]
}
