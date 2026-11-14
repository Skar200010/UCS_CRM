import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, MessageSquareText, Phone, User, Tag, Inbox, Trash2, Search, Plus, CheckCircle2, Sparkles } from 'lucide-react';
import { api } from '../../../api/auth';

const ACCOUNT_HUES = {
  bsct: '#2563eb', bsct2: '#2563eb', bsct3: '#2563eb',
  aflf: '#16a34a', aflf2: '#16a34a',
  mann: '#ec4899', mann2: '#ec4899',
};

const SUGGESTION = {
  interested: { label: 'Interested', color: '#15803d', bg: '#dcfce7', border: '#86efac' },
  review: { label: 'Review', color: '#b45309', bg: '#fef3c7', border: '#fcd34d' },
  low: { label: 'Low', color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0' },
};

function parseNotes(notes) {
  const text = String(notes || '');
  const message = text
    .split('\n')
    // Keep [Button: ...] / [Reply: ...]: that is the actual answer. Only
    // bookkeeping tags are hidden.
    .filter((l) => !/^\[(Template|Account|Lead|Meta Lead|Platform|Campaign|Form):/i.test(l.trim()))
    .join('\n')
    .trim();
  const template = (text.match(/\[Template:\s*([^\]]+)\]/i) || [])[1] || '';
  const account = (text.match(/\[Account:\s*([^\]]+)\]/i) || [])[1] || 'unknown';
  const platform = (text.match(/\[Platform:\s*([^\]]+)\]/i) || [])[1] || '';
  const campaign = (text.match(/\[Campaign:\s*([^\]]+)\]/i) || [])[1] || '';
  const form = (text.match(/\[Form:\s*([^\]]+)\]/i) || [])[1] || '';
  return { message, template, account, platform, campaign, form };
}

const isMetaLead = (lead) => lead?.source === 'Meta Lead Ad';

const platformOf = (lead) => {
  const fromColumn = String(lead?.meta_platform || '').toLowerCase();
  if (fromColumn) return fromColumn;
  const fromNotes = parseNotes(lead?.notes).platform.toLowerCase();
  if (fromNotes) return fromNotes;
  return isMetaLead(lead) ? 'meta' : 'whatsapp';
};

const platformMeta = (platform) => {
  const p = String(platform || '').toLowerCase();
  if (p.includes('instagram')) return { label: 'Instagram', color: '#C13584', bg: '#fce7f3' };
  if (p.includes('facebook') || p === 'meta') return { label: 'Meta', color: '#0866FF', bg: '#e7f0ff' };
  return { label: 'WhatsApp', color: '#128C7E', bg: '#dcfce7' };
};

function ngoNameOf(account) {
  const key = String(account || '').toLowerCase();
  if (key.startsWith('bsct')) return 'BSCT';
  if (key.startsWith('aflf')) return 'AFLF';
  if (key.startsWith('mann')) return 'MANN';
  if (!key || key === 'unknown') return 'Unmapped';
  return account || 'Unmapped';
}

const accountHue = (ngo) => ACCOUNT_HUES[String(ngo || '').toLowerCase()] || '#64748b';

function formatPhone(p) {
  const s = String(p || '').replace(/[^0-9]/g, '');
  return s.length === 12 && s.startsWith('91') ? `+${s}` : s;
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function WhatsAppReplyLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [filter, setFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  // inbox = reply not on a station yet · queue = already placed
  const [tab, setTab] = useState('inbox');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/ngo-admin/ss-leads');
      setLeads(Array.isArray(data) ? data : (data?.data || []));
    } catch (e) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const inboxLeads = leads.filter((l) => !l.in_station);
  const queueLeads = leads.filter((l) => l.in_station);
  const aiPending = leads.filter((l) => !l.in_station && !l.ai_at).length;

  const ngoGroups = useMemo(() => {
    const s = new Set(leads.map((l) => ngoNameOf(l.account_ngo || parseNotes(l.notes).account)));
    return ['all', ...Array.from(s)];
  }, [leads]);

  const tabLeads = tab === 'queue' ? queueLeads : inboxLeads;
  const filtered = tabLeads.filter((l) => {
    if (filter !== 'all' && ngoNameOf(l.account_ngo || parseNotes(l.notes).account) !== filter) return false;
    if (platformFilter !== 'all') {
      const platform = platformOf(l);
      if (platformFilter === 'meta') {
        if (!isMetaLead(l)) return false;
      } else if (platformFilter === 'whatsapp') {
        if (isMetaLead(l)) return false;
      } else if (!platform.includes(platformFilter)) {
        return false;
      }
    }
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return String(l.name || '').toLowerCase().includes(q) || String(l.phone || '').includes(q);
  });

  const addToStation = async (lead) => {
    setAdding(lead.id);
    setError(''); setNotice('');
    try {
      const res = await api(`/ngo-admin/ss-leads/${lead.id}/add`, { method: 'POST', body: JSON.stringify({}) });
      setLeads((prev) => prev.map((l) => (
        l.id === lead.id
          ? {
            ...l,
            in_station: true,
            placed_station: res.station || l.suggested_station,
            placed_fro_name: res.fro_name || l.station_owner_name || null,
            placed_status: 'pending',
          }
          : l
      )));
      setNotice(res.message || 'Added to station');
    } catch (e) {
      setError(e?.message || 'Could not add this lead');
    } finally {
      setAdding(null);
    }
  };

  const runAi = async () => {
    if (aiBusy) return;
    setAiBusy(true);
    setError(''); setNotice('');
    try {
      const res = await api('/ngo-admin/ss-leads/ai-batch', {
        method: 'POST',
        body: JSON.stringify({ limit: 12 }),
      });
      await load();
      setNotice(
        `AI scored ${res.scored || 0} lead(s)`
        + (res.failed ? ` · ${res.failed} failed` : '')
        + (res.remaining ? ` · ${res.remaining} left — run again` : ' · all scored'),
      );
    } catch (e) {
      setError(e?.message || 'AI scoring failed');
    } finally {
      setAiBusy(false);
    }
  };

  const remove = async (leadId) => {
    if (!window.confirm('Delete this lead? It will also be removed from its SS station queue.')) return;
    setDeleting(leadId);
    setError(''); setNotice('');
    try {
      await api(`/leads/${leadId}`, { method: 'DELETE' });
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      setNotice('Lead deleted');
    } catch (e) {
      setError(e?.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const suggestionPill = (s) => {
    const meta = SUGGESTION[s?.label] || SUGGESTION.low;
    const isAi = s?.source === 'ai';
    return (
      <span
        title={Array.isArray(s?.reasons) && s.reasons.length ? s.reasons.join(' · ') : undefined}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 800, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap' }}
      >
        <Sparkles size={11} />
        {meta.label}
        <span style={{ fontWeight: 700, opacity: .7 }}>{s?.score ?? 0}%</span>
        <span title={isAi ? `Model: ${s?.model || 'AI'}` : 'Rule-based score (no model call)'}
          style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: .3, padding: '1px 4px', borderRadius: 4, background: isAi ? '#111827' : 'rgba(0,0,0,.07)', color: isAi ? '#fff' : meta.color }}>
          {isAi ? 'AI' : 'RULES'}
        </span>
      </span>
    );
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1200 }}>
      {/* Header */}
      <div className="card" style={{ padding: '18px 22px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--sage)', color: '#fff', flexShrink: 0 }}>
              <Inbox size={20} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 2px' }}>SS Leads</h3>
              <div style={{ fontSize: 12, color: 'var(--ink-soft, #64748b)' }}>
                WhatsApp replies and Meta lead ads. <b>Add to station</b> puts the lead straight into SS-BSCT / SS-AFLF / SS-MANN — the station's FRO picks it up, no FRO picker needed.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={runAi} disabled={aiBusy || aiPending === 0}
              title={aiPending === 0 ? 'Every reply in the inbox is already scored' : 'Score the next 12 replies with the AI model'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--sage)', background: aiPending > 0 ? 'var(--sage)' : 'var(--bg, #fff)', color: aiPending > 0 ? '#fff' : 'var(--ink-soft, #64748b)', fontSize: 12, fontWeight: 700, cursor: aiBusy || aiPending === 0 ? 'default' : 'pointer', opacity: aiBusy ? .7 : 1 }}>
              <Sparkles size={14} />
              {aiBusy ? 'AI scoring…' : `Run AI (${aiPending})`}
            </button>
            <button onClick={load} disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--line, #e2e8f0)', background: 'var(--bg, #fff)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--ink, #0f172a)' }}>
              <RefreshCw size={14} style={{ transform: loading ? 'rotate(360deg)' : 'none', transition: 'transform .8s linear' }} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { key: 'inbox', label: 'Inbox', count: inboxLeads.length },
          { key: 'queue', label: 'In Queue', count: queueLeads.length },
        ].map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 999, border: `1px solid ${active ? 'var(--sage)' : 'var(--line, #e2e8f0)'}`, background: active ? 'var(--sage)' : 'var(--bg, #fff)', color: active ? '#fff' : 'var(--ink-soft, #64748b)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'all .15s' }}>
              {t.key === 'inbox' && <Inbox size={13} style={{ opacity: .8 }} />}
              {t.key === 'queue' && <CheckCircle2 size={13} style={{ opacity: .8 }} />}
              {t.label}
              <span style={{ minWidth: 18, padding: '0 5px', borderRadius: 999, fontSize: 10.5, fontWeight: 800, background: active ? 'rgba(255,255,255,.25)' : 'var(--line, #e2e8f0)', color: active ? '#fff' : 'var(--ink-soft, #64748b)' }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* NGO filter + search */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        {ngoGroups.map((a) => {
          const active = filter === a;
          const hue = a === 'all' ? '#0f172a' : accountHue(a);
          const count = a === 'all' ? tabLeads.length : tabLeads.filter((l) => ngoNameOf(l.account_ngo || parseNotes(l.notes).account) === a).length;
          return (
            <button key={a} onClick={() => setFilter(a)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 999, border: `1px solid ${active ? hue : 'var(--line, #e2e8f0)'}`, background: active ? hue : 'var(--bg, #fff)', color: active ? '#fff' : 'var(--ink-soft, #64748b)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'all .15s' }}>
              {a === 'all' ? 'All NGOs' : a}
              <span style={{ minWidth: 18, padding: '0 5px', borderRadius: 999, fontSize: 10.5, fontWeight: 800, background: active ? 'rgba(255,255,255,.25)' : 'var(--line, #e2e8f0)', color: active ? '#fff' : 'var(--ink-soft, #64748b)' }}>{count}</span>
            </button>
          );
        })}
        {[
          { key: 'all', label: 'All sources' },
          { key: 'meta', label: 'Meta' },
          { key: 'facebook', label: 'Facebook' },
          { key: 'instagram', label: 'Instagram' },
          { key: 'whatsapp', label: 'WhatsApp' },
        ].map((s) => {
          const active = platformFilter === s.key;
          const count = s.key === 'all'
            ? tabLeads.length
            : tabLeads.filter((l) => {
              if (s.key === 'meta') return isMetaLead(l);
              if (s.key === 'whatsapp') return !isMetaLead(l);
              return platformOf(l).includes(s.key);
            }).length;
          return (
            <button key={s.key} onClick={() => setPlatformFilter(s.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999, border: `1px solid ${active ? '#0866FF' : 'var(--line, #e2e8f0)'}`, background: active ? '#0866FF' : 'var(--bg, #fff)', color: active ? '#fff' : 'var(--ink-soft, #64748b)', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .15s' }}>
              {s.label}
              <span style={{ minWidth: 18, padding: '0 5px', borderRadius: 999, fontSize: 10.5, fontWeight: 800, background: active ? 'rgba(255,255,255,.25)' : 'var(--line, #e2e8f0)', color: active ? '#fff' : 'var(--ink-soft, #64748b)' }}>{count}</span>
            </button>
          );
        })}
        <div style={{ position: 'relative', marginLeft: 'auto', minWidth: 240 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: .5 }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or number…"
            style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 10, border: '1px solid var(--line, #e2e8f0)', background: 'var(--bg, #fff)', fontSize: 12, outline: 'none', color: 'var(--ink, #0f172a)', boxSizing: 'border-box' }} />
        </div>
      </div>

      {notice && (
        <div style={{ marginBottom: 12, padding: '9px 13px', borderRadius: 10, background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', fontSize: 12.5, fontWeight: 600 }}>
          {notice}
        </div>
      )}

      {/* Table card */}
      <div className="card">
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3>{tab === 'queue' ? 'In Queue' : 'Inbox'}</h3>
          <span style={{ fontSize: 12, color: 'var(--ink-soft, #64748b)' }}>{filtered.length} lead{filtered.length === 1 ? '' : 's'}</span>
        </div>

        {loading && <div style={{ padding: 28, fontSize: 13, color: 'var(--ink-soft, #64748b)', textAlign: 'center' }}>Loading leads…</div>}
        {error && (
          <div style={{ margin: '12px 16px', padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12.5, fontWeight: 600 }}>{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft, #64748b)' }}>
            <MessageSquareText size={32} style={{ opacity: .35, marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>{tab === 'queue' ? 'Nothing in a station yet' : 'No leads in the inbox'}</div>
            <div style={{ fontSize: 12 }}>{tab === 'queue' ? 'Leads you add will show here with their station.' : 'WhatsApp replies and Meta lead ads will show up here automatically.'}</div>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line, #e2e8f0)' }}>
                  {['Contact', 'Reply', 'Suggestion', 'Station', 'Received', ''].map((h) => (
                    <th key={h} style={{ textAlign: h === '' ? 'right' : 'left', padding: '10px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: .4, color: 'var(--ink-soft, #64748b)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const { message, template, account, campaign, form } = parseNotes(l.notes);
                  const ngo = ngoNameOf(l.account_ngo || account);
                  const hue = accountHue(ngo);
                  const platform = platformMeta(platformOf(l));
                  const metaLead = isMetaLead(l);
                  const ngoLabel = ngo;
                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--line, #e2e8f0)', verticalAlign: 'top' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                          <User size={13} style={{ opacity: .5 }} />
                          {l.name || '—'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-soft, #64748b)', marginTop: 3 }}>
                          <Phone size={11} style={{ opacity: .5 }} />
                          {formatPhone(l.phone)}
                          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, color: hue, background: `${hue}1a` }}>{ngoLabel}</span>
                          {metaLead && (
                            <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, color: platform.color, background: platform.bg }}>{platform.label}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: 300 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--ink, #0f172a)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message || '—'}</div>
                        {template && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, padding: '2px 8px', borderRadius: 6, background: 'var(--line, #f1f5f9)', fontSize: 10.5, color: 'var(--ink-soft, #64748b)', maxWidth: '100%' }}>
                            <Tag size={10} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template}</span>
                          </div>
                        )}
                        {metaLead && (campaign || form) && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                            {campaign && (
                              <span title="Meta campaign" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: '#e7f0ff', color: '#0866FF', fontSize: 10.5, fontWeight: 700, maxWidth: 260 }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campaign}</span>
                              </span>
                            )}
                            {form && (
                              <span title="Lead form" style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--line, #f1f5f9)', color: 'var(--ink-soft, #64748b)', fontSize: 10.5, fontWeight: 700 }}>Form: {form}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>{suggestionPill(l.suggestion)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--ink-soft, #64748b)' }}>
                        {l.in_station ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontWeight: 800, color: '#15803d' }}>✓ {l.placed_station}</span>
                            <span style={{ fontSize: 11 }}>{l.placed_fro_name || 'No FRO owner yet'}</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontWeight: 700 }}>{l.suggested_station || '—'}</span>
                            <span style={{ fontSize: 11 }}>{l.station_owner_name || 'No FRO owner yet'}</span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--ink-soft, #64748b)', whiteSpace: 'nowrap' }}>{formatTime(l.created_at)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          {l.in_station ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 800, color: '#15803d', whiteSpace: 'nowrap' }}>
                              <CheckCircle2 size={13} /> Already in station
                            </span>
                          ) : !l.suggested_station && metaLead ? (
                            <span title="Map this Meta lead form to an NGO in Accounts → WhatsApp Center → Meta Ads"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, background: '#fff7ed', color: '#c2410c', fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
                              Map form first
                            </span>
                          ) : (
                            <button onClick={() => addToStation(l)} disabled={adding === l.id}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, border: 'none', background: 'var(--sage)', color: '#fff', fontSize: 11.5, fontWeight: 800, cursor: adding === l.id ? 'default' : 'pointer', opacity: adding === l.id ? .6 : 1, whiteSpace: 'nowrap' }}>
                              <Plus size={13} />
                              {adding === l.id ? 'Adding…' : `Add to ${l.suggested_station || 'station'}`}
                            </button>
                          )}
                          <button onClick={() => remove(l.id)} disabled={deleting === l.id}
                            title="Delete lead (also removes it from the SS station)"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 9, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, opacity: deleting === l.id ? .5 : 1 }}>
                            <Trash2 size={13} />
                            Delete
                          </button>
                        </div>
                      </td>
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
