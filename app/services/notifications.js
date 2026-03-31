// ============================================================================
// 通知サービス — スタブ実装
// swaync を置換（将来的にWindows通知連携）
// ============================================================================

let notifications = [];

function addNotification(title, body, icon = '') {
    notifications.push({
        id: Date.now(),
        title,
        body,
        icon,
        time: new Date().toLocaleTimeString(),
        read: false,
    });
    // 最大50件保持
    if (notifications.length > 50) notifications.shift();
}

function getNotifications() {
    return notifications;
}

function clearAll() {
    notifications = [];
}

function dismiss(id) {
    notifications = notifications.filter(n => n.id !== id);
}

module.exports = { addNotification, getNotifications, clearAll, dismiss };
