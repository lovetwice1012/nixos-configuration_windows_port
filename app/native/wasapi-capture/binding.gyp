{
  "targets": [
    {
      "target_name": "wasapi_capture",
      "sources": [
        "src/addon.cpp",
        "src/WasapiCapture.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "WIN32_LEAN_AND_MEAN",
        "_HAS_EXCEPTIONS=1"
      ],
      "libraries": [
        "Mmdevapi.lib"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": "1"
        }
      }
    }
  ]
}
