export function getViewPanel() {
  try {
    const p = window.location.pathname || '';
    const m = p.match(/^\/(?:sa\/)?(hr|accounts|fro|recruiter|ngo-admin|event-head|worker)(?:[/?]|$)/);
    if (!m) return null;
    const rmap = {
      hr: 'hr',
      accounts: 'accounts',
      fro: 'fro',
      recruiter: 'recruiter',
      'ngo-admin': 'admin',
      'event-head': 'event_head',
      worker: 'worker',
    };
    return rmap[m[1]] || null;
  } catch { return null; }
}