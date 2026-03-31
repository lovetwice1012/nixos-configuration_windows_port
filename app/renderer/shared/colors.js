// ============================================================================
// Catppuccin Mocha カラーパレット + 動的テーマシステム
// MatugenColors.qml と rofi/swaync の色定義を統合
// ============================================================================

const CATPPUCCIN_MOCHA = {
    rosewater: '#f5e0dc',
    flamingo:  '#f2cdcd',
    pink:      '#f5c2e7',
    mauve:     '#cba6f7',
    red:       '#f38ba8',
    maroon:    '#eba0ac',
    peach:     '#fab387',
    yellow:    '#f9e2af',
    green:     '#a6e3a1',
    teal:      '#94e2d5',
    sky:       '#89dceb',
    sapphire:  '#74c7ec',
    blue:      '#89b4fa',
    lavender:  '#b4befe',
    text:      '#cdd6f4',
    subtext1:  '#bac2de',
    subtext0:  '#a6adc8',
    overlay2:  '#9399b2',
    overlay1:  '#7f849c',
    overlay0:  '#6c7086',
    surface2:  '#585b70',
    surface1:  '#45475a',
    surface0:  '#313244',
    base:      '#1e1e2e',
    mantle:    '#181825',
    crust:     '#11111b',
};

// CSS カスタムプロパティとして注入
function injectCSSVariables(palette = CATPPUCCIN_MOCHA) {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(palette)) {
        root.style.setProperty(`--${name}`, value);
        // rgba用にRGB値も分解
        const r = parseInt(value.slice(1, 3), 16);
        const g = parseInt(value.slice(3, 5), 16);
        const b = parseInt(value.slice(5, 7), 16);
        root.style.setProperty(`--${name}-rgb`, `${r}, ${g}, ${b}`);
    }
}

// Hex → RGBA 変換ヘルパー
function hexToRgba(hex, alpha = 1.0) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 天気アイコンに対応する色マッピング
function getWeatherColor(weatherCode) {
    if (!weatherCode) return CATPPUCCIN_MOCHA.yellow;
    const code = String(weatherCode);
    if (code.startsWith('2')) return CATPPUCCIN_MOCHA.lavender;  // 雷雨
    if (code.startsWith('3')) return CATPPUCCIN_MOCHA.sky;       // 霧雨
    if (code.startsWith('5')) return CATPPUCCIN_MOCHA.blue;      // 雨
    if (code.startsWith('6')) return CATPPUCCIN_MOCHA.text;      // 雪
    if (code === '800') return CATPPUCCIN_MOCHA.yellow;          // 快晴
    if (code.startsWith('8')) return CATPPUCCIN_MOCHA.overlay1;  // 曇り
    return CATPPUCCIN_MOCHA.yellow;
}

// バッテリー容量に基づく動的カラー
function getBatteryColor(percent, isCharging) {
    if (isCharging) return CATPPUCCIN_MOCHA.green;
    if (percent >= 70) return CATPPUCCIN_MOCHA.blue;
    if (percent >= 30) return CATPPUCCIN_MOCHA.yellow;
    return CATPPUCCIN_MOCHA.red;
}

// 初期化時にCSS変数を注入
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => injectCSSVariables());
    } else {
        injectCSSVariables();
    }
}
