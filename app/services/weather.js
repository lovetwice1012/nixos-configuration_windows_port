// ============================================================================
// 天気サービス — OpenWeatherMap API (設定サービス連携)
// ============================================================================
const https = require('https');
const settingsService = require('./settings');

let cachedInfo = {
    icon: '󰖙',
    temp: '--',
    hex: '#f9e2af',
    description: '',
    wind: 0,
    humidity: 0,
    rain: 0,
    feelsLike: 0,
    code: 800,
    hourly: [],
};

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function weatherCodeToIcon(code, isNight = false) {
    const c = String(code);
    if (c.startsWith('2')) return '󰖓';
    if (c.startsWith('3')) return '󰖖';
    if (c.startsWith('5')) return '󰖖';
    if (c.startsWith('6')) return '󰖘';
    if (c === '800') return isNight ? '󰖔' : '󰖙';
    if (c === '801' || c === '802') return '󰖕';
    if (c.startsWith('8')) return '󰖐';
    if (c.startsWith('7')) return '󰖑';
    return '󰖙';
}

function weatherCodeToHex(code) {
    const c = String(code);
    if (c.startsWith('2')) return '#b4befe';
    if (c.startsWith('3') || c.startsWith('5')) return '#89b4fa';
    if (c.startsWith('6')) return '#cdd6f4';
    if (c === '800') return '#f9e2af';
    if (c.startsWith('8')) return '#7f849c';
    return '#f9e2af';
}

async function fetchOpenMeteo(city) {
    try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
        const geoData = await fetchJSON(geoUrl);
        if (!geoData.results || geoData.results.length === 0) return null;

        const { latitude, longitude } = geoData.results[0];
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&timezone=auto`;
        const data = await fetchJSON(weatherUrl);

        if (data && data.current) {
            const now = new Date();
            const isNight = now.getHours() >= 20 || now.getHours() < 6;
            
            // Map Open-Meteo WMO code to OWM-like codes for the icon/hex functions
            let code = 800; // Clear
            const wmo = data.current.weather_code;
            if (wmo === 1 || wmo === 2 || wmo === 3) code = 802; // partly cloudy
            else if (wmo >= 45 && wmo <= 48) code = 741; // fog
            else if (wmo >= 51 && wmo <= 67) code = 500; // rain/drizzle
            else if (wmo >= 71 && wmo <= 77) code = 600; // snow
            else if (wmo >= 80 && wmo <= 82) code = 502; // rain showers
            else if (wmo >= 95 && wmo <= 99) code = 200; // thunderstorm

            let desc = 'Clear';
            if (wmo === 1 || wmo === 2) desc = 'Partly Cloudy';
            else if (wmo === 3) desc = 'Overcast';
            else if (wmo >= 45 && wmo <= 48) desc = 'Fog';
            else if (wmo >= 51 && wmo <= 67) desc = 'Rain';
            else if (wmo >= 71 && wmo <= 77) desc = 'Snow';
            else if (wmo >= 95) desc = 'Thunderstorm';

            const hourly = [];
            if (data.hourly && data.hourly.time) {
                const currentHourIdx = data.hourly.time.findIndex(t => new Date(t).getHours() === now.getHours() && new Date(t).getDate() === now.getDate());
                if (currentHourIdx !== -1) {
                    for (let i = 0; i < 8; i++) {
                        const hIdx = currentHourIdx + i;
                        if (hIdx < data.hourly.time.length) {
                            const hrDate = new Date(data.hourly.time[hIdx]);
                            const hrCodeRaw = data.hourly.weather_code[hIdx];
                            let hrCode = 800;
                            if (hrCodeRaw === 1 || hrCodeRaw === 2 || hrCodeRaw === 3) hrCode = 802;
                            else if (hrCodeRaw >= 51 && hrCodeRaw <= 67) hrCode = 500;
                            else if (hrCodeRaw >= 71 && hrCodeRaw <= 77) hrCode = 600;
                            
                            const isNightHr = hrDate.getHours() >= 20 || hrDate.getHours() < 6;
                            hourly.push({
                                time: `${String(hrDate.getHours()).padStart(2, '0')}:00`,
                                icon: weatherCodeToIcon(hrCode, isNightHr),
                                temp: Math.round(data.hourly.temperature_2m[hIdx]),
                                hex: weatherCodeToHex(hrCode)
                            });
                        }
                    }
                }
            }

            return {
                icon: weatherCodeToIcon(code, isNight),
                temp: `${Math.round(data.current.temperature_2m)}`,
                hex: weatherCodeToHex(code),
                description: desc,
                wind: data.current.wind_speed_10m || 0,
                humidity: data.current.relative_humidity_2m || 0,
                rain: data.current.precipitation || 0,
                feelsLike: Math.round(data.current.apparent_temperature || 0),
                code,
                hourly: hourly.length > 0 ? hourly : cachedInfo.hourly,
            };
        }
    } catch(e) { console.log('Open-Meteo error', e); }
    return null;
}

async function getInfo() {
    const apiKey = settingsService.get('openWeatherApiKey');
    const city = settingsService.get('openWeatherCity') || 'Tokyo';

    if (!apiKey) {
        // Fallback to open-meteo
        const omData = await fetchOpenMeteo(city);
        if (omData) cachedInfo = omData;
        return cachedInfo;
    }

    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric&lang=ja`;
        const data = await fetchJSON(url);

        if (data && data.main) {
            const code = data.weather?.[0]?.id || 800;
            const now = new Date();
            const isNight = now.getHours() >= 20 || now.getHours() < 6;

            cachedInfo = {
                icon: weatherCodeToIcon(code, isNight),
                temp: `${Math.round(data.main.temp)}`,
                hex: weatherCodeToHex(code),
                description: data.weather?.[0]?.description || '',
                wind: data.wind?.speed || 0,
                humidity: data.main?.humidity || 0,
                rain: data.rain?.['1h'] || 0,
                feelsLike: Math.round(data.main?.feels_like || 0),
                code,
                hourly: [],
            };
        }
    } catch (e) { /* keep cached */ }
    return cachedInfo;
}

module.exports = { getInfo };
