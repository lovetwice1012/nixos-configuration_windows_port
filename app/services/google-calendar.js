// ============================================================================
// Google Calendar サービス — Google Calendar API v3
// ============================================================================
const https = require('https');
const settingsService = require('./settings');

let cachedEvents = [];
let lastFetchTime = 0;
const CACHE_DURATION = 300000; // 5分キャッシュ

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

async function getEvents() {
    const apiKey = settingsService.get('googleCalendarApiKey');
    const calendarId = settingsService.get('googleCalendarId') || 'primary';

    if (!apiKey) {
        return { header: 'Google Calendar API Key not set', link: '', lessons: [] };
    }

    // キャッシュチェック
    if (Date.now() - lastFetchTime < CACHE_DURATION && cachedEvents.length > 0) {
        return formatForUI(cachedEvents);
    }

    try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        const timeMin = encodeURIComponent(startOfDay.toISOString());
        const timeMax = encodeURIComponent(endOfDay.toISOString());
        const encodedCalId = encodeURIComponent(calendarId);

        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=20`;

        const data = await fetchJSON(url);

        if (data.error) {
            console.error('Google Calendar API error:', data.error.message);
            return { header: `Error: ${data.error.message}`, link: '', lessons: [] };
        }

        if (data.items) {
            cachedEvents = data.items;
            lastFetchTime = Date.now();
            return formatForUI(data.items);
        }

        return { header: 'No events found', link: '', lessons: [] };
    } catch (e) {
        console.error('Google Calendar fetch error:', e);
        return { header: 'Calendar offline', link: '', lessons: [] };
    }
}

function formatForUI(events) {
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const headerDate = `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} (This Week)`;

    const lessons = [];
    let lastEndTime = null;

    for (const event of events) {
        if (!event.start) continue;

        const startTime = event.start.dateTime ? new Date(event.start.dateTime) : null;
        const endTime = event.end?.dateTime ? new Date(event.end.dateTime) : null;

        if (!startTime) {
            // All-day event
            lessons.push({
                type: 'class',
                subject: event.summary || 'Untitled',
                time: 'All Day',
                room: event.location || '',
                width: 200,
                start: 0, end: 0,
            });
            continue;
        }

        // Insert gap between events
        if (lastEndTime && startTime > lastEndTime) {
            const gapMins = Math.round((startTime - lastEndTime) / 60000);
            if (gapMins > 5) {
                lessons.push({ type: 'gap', desc: `${gapMins} min`, width: Math.max(40, Math.min(gapMins, 120)) });
            }
        }

        const startStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;
        const endStr = endTime ? `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}` : '';

        const nowEpoch = now.getTime() / 1000;
        const startEpoch = startTime.getTime() / 1000;
        const endEpoch = endTime ? endTime.getTime() / 1000 : startEpoch + 3600;

        lessons.push({
            type: 'class',
            subject: event.summary || 'Untitled',
            time: endStr ? `${startStr}-${endStr}` : startStr,
            room: event.location || '',
            width: 200,
            start: startEpoch,
            end: endEpoch,
        });

        lastEndTime = endTime || startTime;
    }

    return {
        header: headerDate,
        link: '',
        lessons,
    };
}

module.exports = { getEvents };
