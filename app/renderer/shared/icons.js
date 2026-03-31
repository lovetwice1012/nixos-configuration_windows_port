// ============================================================================
// Nerd Font アイコンマッピング
// TopBar.qml と sys_info.sh で使用されるアイコンをマップ
// ============================================================================

const ICONS = {
    // 検索 & 通知
    search: '󰍉',
    bell: '',
    bellOff: '󰂛',

    // メディア
    previous: '󰒮',
    play: '󰐊',
    pause: '󰏤',
    next: '󰒭',
    music: '󰎈',

    // ボリューム
    volumeHigh: '󰕾',
    volumeMed: '󰖀',
    volumeLow: '󰕿',
    volumeMute: '󰖁',

    // バッテリー
    battery100: '󰁹',
    battery90: '󰂂',
    battery80: '󰂁',
    battery70: '󰂀',
    battery60: '󰁿',
    battery50: '󰁾',
    battery40: '󰁽',
    battery30: '󰁼',
    battery20: '󰁻',
    battery10: '󰁺',
    battery0: '󰂎',
    batteryCharging: '󰂄',

    // Wi-Fi
    wifi4: '󰤨',
    wifi3: '󰤥',
    wifi2: '󰤢',
    wifi1: '󰤟',
    wifiOff: '󰤮',

    // Bluetooth
    bluetooth: '󰂯',
    bluetoothConnected: '󰂱',
    bluetoothOff: '󰂲',

    // キーボード
    keyboard: '󰌌',

    // 天気
    weatherSunny: '󰖙',
    weatherCloudy: '󰖐',
    weatherRain: '󰖖',
    weatherSnow: '󰖘',
    weatherThunder: '󰖓',
    weatherFog: '󰖑',
    weatherNight: '󰖔',
    weatherPartlyCloudy: '󰖕',

    // システム
    power: '⏻',
    lock: '󰌾',
    monitor: '󰍹',
    brightness: '󰃟',

    // ナビゲーション
    chevronLeft: '',
    chevronRight: '',
    plus: '',
    close: '󰅖',
    
    // カレンダー
    calendar: '󰃭',
    clock: '󰥔',

    // ネットワーク
    ethernet: '󰈀',
    vpn: '󰦝',

    // NixOS
    nixos: '󱄅',
};

// バッテリー残量からアイコンを取得
function getBatteryIcon(percent, isCharging) {
    if (isCharging) return ICONS.batteryCharging;
    if (percent >= 95) return ICONS.battery100;
    if (percent >= 85) return ICONS.battery90;
    if (percent >= 75) return ICONS.battery80;
    if (percent >= 65) return ICONS.battery70;
    if (percent >= 55) return ICONS.battery60;
    if (percent >= 45) return ICONS.battery50;
    if (percent >= 35) return ICONS.battery40;
    if (percent >= 25) return ICONS.battery30;
    if (percent >= 15) return ICONS.battery20;
    if (percent >= 5) return ICONS.battery10;
    return ICONS.battery0;
}

// 音量からアイコンを取得
function getVolumeIcon(percent, isMuted) {
    if (isMuted || percent === 0) return ICONS.volumeMute;
    if (percent >= 66) return ICONS.volumeHigh;
    if (percent >= 33) return ICONS.volumeMed;
    return ICONS.volumeLow;
}

// WiFi信号強度からアイコンを取得
function getWifiIcon(signalStrength, isConnected) {
    if (!isConnected) return ICONS.wifiOff;
    if (signalStrength >= 75) return ICONS.wifi4;
    if (signalStrength >= 50) return ICONS.wifi3;
    if (signalStrength >= 25) return ICONS.wifi2;
    return ICONS.wifi1;
}

// 天気コードからアイコンを取得
function getWeatherIcon(code, isNight = false) {
    if (!code) return ICONS.weatherSunny;
    const c = String(code);
    if (c.startsWith('2')) return ICONS.weatherThunder;
    if (c.startsWith('3') || c.startsWith('5')) return ICONS.weatherRain;
    if (c.startsWith('6')) return ICONS.weatherSnow;
    if (c === '800') return isNight ? ICONS.weatherNight : ICONS.weatherSunny;
    if (c === '801' || c === '802') return ICONS.weatherPartlyCloudy;
    if (c.startsWith('8')) return ICONS.weatherCloudy;
    if (c.startsWith('7')) return ICONS.weatherFog;
    return ICONS.weatherSunny;
}
