import { useState } from 'react';
import { toast } from '../../../components/Toast';

export default function Settings() {
  const [form, setForm] = useState(() => ({
    reminderDays: localStorage.getItem('sim_reminder_days') || '30',
    defaultTeam: localStorage.getItem('sim_default_team') || '',
    warnAfter: localStorage.getItem('sim_warn_after') || '8',
  }));
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  function save() {
    localStorage.setItem('sim_reminder_days', form.reminderDays);
    localStorage.setItem('sim_default_team', form.defaultTeam);
    localStorage.setItem('sim_warn_after', form.warnAfter);
    toast('Settings saved', 'success');
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div className="card-block" style={{ padding: 20 }}>
        <div className="section-title" style={{ marginBottom: 4 }}>Panel Settings</div>
        <div className="section-sub">Configure SIM expiry reminders and defaults. These apply to this panel only.</div>

        <div className="form-grid">
          <div className="form-row">
            <label>Expiry Reminder Window (days)</label>
            <input type="number" min="1" value={form.reminderDays} onChange={(e) => set('reminderDays', e.target.value)} />
          </div>
          <div className="form-row">
            <label>Warning Threshold (days)</label>
            <input type="number" min="1" value={form.warnAfter} onChange={(e) => set('warnAfter', e.target.value)} />
          </div>
          <div className="form-row full">
            <label>Default Team for New SIMs</label>
            <input type="text" value={form.defaultTeam} onChange={(e) => set('defaultTeam', e.target.value)} placeholder="e.g. Field Team" />
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <button className="sim-btn primary" onClick={save}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}
