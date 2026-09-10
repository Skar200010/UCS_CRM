import { useState, useEffect } from 'react';
import { listImpersonationCodes, listAllImpersonationCodes } from '../api/auth';
import { getUser } from '../../../api/auth';

const CODE_TTL_MINUTES = 5;

const statusOf = (c) => {
  if (c.is_used) return { label: 'Used', color: '#94a3b8' };
  if (new Date(c.expires_at).getTime() < Date.now()) return { label: 'Expired', color: '#94a3b8' };
  return { label: 'Active', color: '#16a34a' };
};

const fmtTime = (iso) => {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${d.getHours()}:${mins}`;
};

export default function Codes() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchCodes = async () => {
    setLoading(true);
    try {
      if (showAll) {
        const r = await listAllImpersonationCodes();
        setCodes(r?.codes || []);
      } else {
        const r = await listImpersonationCodes();
        setCodes(r?.codes || []);
      }
    } catch (err) {
      console.error('Error:', err.message);
      setCodes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getUser('ucs');
    const isPrivileged = user?.role === 'super_admin' || user?.role === 'master' || user?.role === 'admin';
    setIsSuperAdmin(isPrivileged);
    fetchCodes();
  }, [showAll]);

  return (
    <div>
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: '0 0 4px' }}>Acting FRO codes</h3>
            <div style={{ fontSize: 12, color: 'var(--ink-soft, #64748b)' }}>
              FROs generate a single-use 4-digit code from their app when switching Acting FRO. Codes expire after {CODE_TTL_MINUTES} minutes and are logged here with the FRO who created them.
            </div>
          </div>
          {isSuperAdmin && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showAll}
                onChange={e => setShowAll(e.target.checked)}
                style={{ accentColor: 'var(--sage)' }}
              />
              <span>Show all codes (all NGOs)</span>
            </label>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Code log {showAll ? '(All NGOs)' : '(Current NGO)'}</h3>
        </div>
        {loading ? (
          <div style={{ padding: 20, fontSize: 12, color: 'var(--ink-soft, #64748b)' }}>Loading…</div>
        ) : codes.length === 0 ? (
          <div style={{ padding: 20, fontSize: 12, color: 'var(--ink-soft, #64748b)' }}>No codes generated yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line, #e2e8f0)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-soft, #64748b)' }}>Created by</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-soft, #64748b)' }}>Code</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-soft, #64748b)' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-soft, #64748b)' }}>Created</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-soft, #64748b)' }}>Expires</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-soft, #64748b)' }}>Used</th>
                  {showAll && (
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-soft, #64748b)' }}>NGO ID</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {codes.map(c => {
                  const st = statusOf(c);
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--line, #e2e8f0)' }}>
                      <td style={{ padding: '10px 16px', fontSize: 12.5, fontWeight: 600 }}>{c.created_by_name || '\u2014'}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 600, letterSpacing: 2 }}>{c.code}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: st.color, background: `${st.color}1a` }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--ink-soft, #64748b)' }}>{fmtTime(c.created_at)}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--ink-soft, #64748b)' }}>{fmtTime(c.expires_at)}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--ink-soft, #64748b)' }}>{fmtTime(c.used_at)}</td>
                      {showAll && (
                        <td style={{ padding: '10px 16px', fontSize: 10, color: 'var(--ink-soft, #64748b)', fontFamily: 'monospace' }}>{c.ngo_id || '—'}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
