// ============================================================================
// アニメーションヘルパー — QMLのEasing関数をCSS/JSに移植
// ============================================================================

// イージング関数群（QMLのEasing.OutBack等に対応）
const EASINGS = {
    outCubic: 'cubic-bezier(0.33, 1, 0.68, 1)',
    inOutCubic: 'cubic-bezier(0.65, 0, 0.35, 1)',
    outExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
    inExpo: 'cubic-bezier(0.7, 0, 0.84, 0)',
    outBack: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    inOutSine: 'cubic-bezier(0.37, 0, 0.63, 1)',
    outQuint: 'cubic-bezier(0.22, 1, 0.36, 1)',
    spring: 'cubic-bezier(0.34, 1.8, 0.64, 1)',
};

// 段階的表示アニメーション（TopBarのstaggered入場に対応）
function staggeredEntrance(elements, { delay = 60, duration = 500, easing = EASINGS.outBack } = {}) {
    elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(15px)';
        el.style.transition = `opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}`;

        setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, index * delay);
    });
}

// タイプライターエフェクト（日付表示用 — TopBar.qmlの再現）
function typewriterEffect(element, text, { interval = 40, onComplete = null } = {}) {
    let index = 0;
    element.textContent = '';

    const timer = setInterval(() => {
        if (index < text.length) {
            element.textContent = text.substring(0, index + 1);
            index++;
        } else {
            clearInterval(timer);
            if (onComplete) onComplete();
        }
    }, interval);

    return () => clearInterval(timer); // キャンセル関数を返す
}

// スムーズな幅遷移（ワークスペースの動的リサイズ等）
function smoothResize(element, targetWidth, { duration = 400, easing = EASINGS.outQuint } = {}) {
    element.style.transition = `width ${duration}ms ${easing}`;
    element.style.width = `${targetWidth}px`;
}
