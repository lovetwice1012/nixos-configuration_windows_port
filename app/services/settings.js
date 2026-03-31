// ============================================================================
// 設定サービス — APIキーやユーザー設定の永続化
// ============================================================================
const fs = require('fs');
const path = require('path');
const os = require('os');

const SETTINGS_PATH = path.join(os.homedir(), '.nixos-windows-port-settings.json');

const DEFAULT_SETTINGS = {
    openWeatherApiKey: '',
    openWeatherCity: 'Tokyo',
    googleCalendarApiKey: '',
    googleCalendarId: 'primary',
};

let settings = { ...DEFAULT_SETTINGS };

// Load
try {
    if (fs.existsSync(SETTINGS_PATH)) {
        const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
        settings = { ...DEFAULT_SETTINGS, ...raw };
    }
} catch (e) {
    settings = { ...DEFAULT_SETTINGS };
}

function get(key) {
    return settings[key] !== undefined ? settings[key] : null;
}

function getAll() {
    return { ...settings };
}

function set(key, value) {
    settings[key] = value;
    save();
}

function setAll(newSettings) {
    settings = { ...DEFAULT_SETTINGS, ...newSettings };
    save();
}

function save() {
    try {
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    } catch (e) {
        console.error('Settings save error:', e);
    }
}

module.exports = { get, getAll, set, setAll };
