// ============================================================================
// 設定ウィジェット — API Keys & Preferences
// ============================================================================

function renderSettingsWidget(container) {
    const panel = document.createElement('div');
    panel.className = 'widget-panel';
    panel.innerHTML = `<div class="settings-widget" id="settings-root">
        <div class="settings-header">
            <span class="settings-header-icon"></span>
            <span class="settings-header-title">Settings</span>
        </div>

        <div class="settings-section">
            <div class="settings-section-title">
                <span class="settings-section-icon"></span>
                OpenWeatherMap
            </div>
            <div class="settings-field">
                <label class="settings-field-label">API Key</label>
                <input class="settings-input" id="settings-owm-key" type="password" placeholder="Enter your OpenWeatherMap API key..." autocomplete="off" spellcheck="false" />
            </div>
            <div class="settings-field">
                <label class="settings-field-label">City</label>
                <input class="settings-input" id="settings-owm-city" type="text" placeholder="Tokyo" autocomplete="off" spellcheck="false" />
            </div>
        </div>

        <div class="settings-section">
            <div class="settings-section-title">
                <span class="settings-section-icon">󰃭</span>
                Google Calendar
            </div>
            <div class="settings-field">
                <label class="settings-field-label">API Key</label>
                <input class="settings-input" id="settings-gcal-key" type="password" placeholder="Enter your Google Calendar API key..." autocomplete="off" spellcheck="false" />
            </div>
            <div class="settings-field">
                <label class="settings-field-label">Calendar ID</label>
                <input class="settings-input" id="settings-gcal-id" type="text" placeholder="primary (or your calendar email)" autocomplete="off" spellcheck="false" />
            </div>
        </div>

        <div class="settings-save-row">
            <div class="settings-status" id="settings-status">
                <span class="status-icon"></span>
                <span id="settings-status-text">Saved!</span>
            </div>
            <button class="settings-save-btn" id="settings-save-btn">
                <span class="btn-icon">󰆓</span>
                Save
            </button>
        </div>
    </div>`;
    container.appendChild(panel);

    // Load existing settings
    loadSettings();

    // Save handler
    const saveBtn = document.getElementById('settings-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveSettings);

    // Toggle password visibility on double-click
    document.querySelectorAll('.settings-input[type="password"]').forEach(input => {
        input.addEventListener('dblclick', () => {
            input.type = input.type === 'password' ? 'text' : 'password';
        });
    });
}

async function loadSettings() {
    if (!window.electronAPI) return;
    try {
        const s = await window.electronAPI.getSettings();
        if (s) {
            const owmKey = document.getElementById('settings-owm-key');
            const owmCity = document.getElementById('settings-owm-city');
            const gcalKey = document.getElementById('settings-gcal-key');
            const gcalId = document.getElementById('settings-gcal-id');

            if (owmKey) owmKey.value = s.openWeatherApiKey || '';
            if (owmCity) owmCity.value = s.openWeatherCity || '';
            if (gcalKey) gcalKey.value = s.googleCalendarApiKey || '';
            if (gcalId) gcalId.value = s.googleCalendarId || '';
        }
    } catch (e) {}
}

async function saveSettings() {
    if (!window.electronAPI) return;

    const newSettings = {
        openWeatherApiKey: (document.getElementById('settings-owm-key')?.value || '').trim(),
        openWeatherCity: (document.getElementById('settings-owm-city')?.value || '').trim(),
        googleCalendarApiKey: (document.getElementById('settings-gcal-key')?.value || '').trim(),
        googleCalendarId: (document.getElementById('settings-gcal-id')?.value || '').trim(),
    };

    try {
        await window.electronAPI.saveSettings(newSettings);

        const status = document.getElementById('settings-status');
        const statusText = document.getElementById('settings-status-text');
        if (status && statusText) {
            statusText.textContent = 'Saved!';
            status.classList.add('show');
            setTimeout(() => status.classList.remove('show'), 2000);
        }
    } catch (e) {
        const status = document.getElementById('settings-status');
        const statusText = document.getElementById('settings-status-text');
        if (status && statusText) {
            statusText.textContent = 'Error saving!';
            status.style.color = 'var(--red)';
            status.classList.add('show');
            setTimeout(() => { status.classList.remove('show'); status.style.color = ''; }, 3000);
        }
    }
}
