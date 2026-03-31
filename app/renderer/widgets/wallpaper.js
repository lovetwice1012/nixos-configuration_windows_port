// ============================================================================
// 壁紙ピッカーウィジェット — WallpaperPicker.qml 再現
// ============================================================================

const COLOR_SWATCHES = [
    '#f38ba8', '#fab387', '#f9e2af', '#a6e3a1',
    '#89b4fa', '#cba6f7', '#f5c2e7', '#cdd6f4', '#11111b'
];

function renderWallpaperWidget(container) {
    const panel = document.createElement('div');
    panel.className = 'widget-panel';
    panel.innerHTML = `
    <div class="wallpaper-widget">
        <div class="wallpaper-toolbar">
            <div class="wallpaper-tool-btn mode-btn" title="Grid View">󰕰</div>
            <div class="wallpaper-tool-btn mode-btn" title="Carousel">󰐊</div>
            ${COLOR_SWATCHES.map(c => `<div class="wallpaper-tool-btn color-swatch" style="background:${c};" data-color="${c}" title="Filter: ${c}"></div>`).join('')}
            <div class="wallpaper-tool-btn mode-btn" title="Search">󰍉</div>
        </div>
        <div class="wallpaper-carousel" id="wallpaper-carousel">
            <button class="wallpaper-nav-btn prev" id="wp-prev">‹</button>
            <div class="wallpaper-track" id="wallpaper-track">
                <div style="display:flex;align-items:center;justify-content:center;width:100%;height:300px;color:var(--subtext0);">
                    <span>壁紙フォルダを設定してください<br><small style="color:var(--overlay0)">~/Images/Wallpapers</small></span>
                </div>
            </div>
            <button class="wallpaper-nav-btn next" id="wp-next">›</button>
        </div>
    </div>`;
    container.appendChild(panel);

    setTimeout(() => {
        const prevBtn = document.getElementById('wp-prev');
        const nextBtn = document.getElementById('wp-next');
        if (prevBtn) prevBtn.addEventListener('click', () => scrollCarousel(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => scrollCarousel(1));

        // カラースウォッチフィルター
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                document.querySelectorAll('.color-swatch').forEach(s => s.style.borderColor = 'transparent');
                swatch.style.borderColor = 'var(--text)';
            });
        });
    }, 50);
}

let carouselOffset = 0;
function scrollCarousel(dir) {
    const track = document.getElementById('wallpaper-track');
    if (!track) return;
    carouselOffset += dir * 240;
    carouselOffset = Math.max(0, carouselOffset);
    track.style.transform = `translateX(-${carouselOffset}px)`;
}
