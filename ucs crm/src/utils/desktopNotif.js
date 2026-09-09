export function requestNotifPermission() {
  if (!('Notification' in window)) return Promise.resolve('unsupported');
  if (Notification.permission === 'default') {
    return Notification.requestPermission();
  }
  return Promise.resolve(Notification.permission);
}

export function showDesktopNotification(title, body, onClickUrl) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    const notif = new Notification(title, { body, icon: '/favicon.ico' });
    if (onClickUrl) {
      notif.onclick = () => { window.focus(); if (onClickUrl) window.location.href = onClickUrl; };
    }
    setTimeout(() => notif.close(), 8000);
  }
}
