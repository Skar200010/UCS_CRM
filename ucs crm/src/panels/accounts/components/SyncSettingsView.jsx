import { useState, useEffect } from 'react';
import { apiGet, apiPut } from '../api/auth';

function Toggle({ label, desc, value, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0', borderBottom: '1px solid var(--line)'
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none',
          cursor: 'pointer', position: 'relative', flexShrink: 0,
          background: value ? 'var(--sage)' : '#d1d5db',
          transition: 'background .2s',
          padding: 0,
        }}
        aria-label={label}
      >
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          background: '#fff', position: 'absolute', top: 2,
          left: value ? 22 : 2,
          transition: 'left .2s',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        }} />
      </button>
    </div>
  );
}

export default function SyncSettingsView() {
  const [settings, setSettings] = useState({
    razorpaySync: false,
    emailImport: false,
    bankStatement: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/user-settings')
      .then(data => {
        setSettings({
          razorpaySync: data.razorpaySync === 'true',
          emailImport: data.emailImport === 'true',
          bankStatement: data.bankStatement === 'true',
        });
      })
      .catch(e => console.error('SyncSettings: load failed', e))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key, current) => {
    const next = !current;
    setSettings(prev => ({ ...prev, [key]: next }));
    apiPut('/user-settings', { [key]: String(next) }).catch(e => console.error('SyncSettings: save failed', e));
  };

  if (loading) {
    return (
      <div style={{ padding: '12px 16px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: 52, marginBottom: 4, borderRadius: 8,
            background: 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)',
            backgroundSize: '200% 100%',
            animation: 'sk-shimmer 1.4s infinite',
          }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 16px' }}>
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4, lineHeight: 1.5 }}>
        Toggle auto-sync features on/off. When disabled, the corresponding tabs are hidden in Bank Audit for manual-only entry.
      </p>
      <Toggle
        label="Razorpay Auto-Sync"
        desc="Sync Razorpay payment data automatically"
        value={settings.razorpaySync}
        onChange={v => toggle('razorpaySync', settings.razorpaySync)}
      />
      <Toggle
        label="Email Import"
        desc="Import donation data from email inboxes"
        value={settings.emailImport}
        onChange={v => toggle('emailImport', settings.emailImport)}
      />
      <Toggle
        label="Bank Statement Import"
        desc="Import bank statement CSV/Excel files"
        value={settings.bankStatement}
        onChange={v => toggle('bankStatement', settings.bankStatement)}
      />
    </div>
  );
}
