import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/auth';

const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function IncentiveVerification() {
  const [data, setData] = useState({ pending: [], verified: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const [verifyId, setVerifyId] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [photoMime, setPhotoMime] = useState('image/jpeg');
  const [preview, setPreview] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    api('/incentive/special/claims', { _prefix: 'ucs' })
      .then(r => setData({
        pending: Array.isArray(r?.pending) ? r.pending : [],
        verified: Array.isArray(r?.verified) ? r.verified : [],
      }))
      .catch(e => setErr(e.message || 'Failed to load claims'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load() }, [load]);

  const pickPhoto = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      setPhotoBase64(result.split(',')[1]);
      setPhotoMime(file.type || 'image/jpeg');
      setPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const openVerify = (id) => {
    setVerifyId(id);
    setPhotoBase64(null);
    setPhotoMime('image/jpeg');
    setPreview(null);
    setRemarks('');
    setMsg('');
  };

  const submitVerify = async () => {
    if (!verifyId) return;
    setSubmitting(true);
    setErr('');
    setMsg('');
    try {
      await api(`/incentive/special/${verifyId}/claim`, {
        method: 'POST', _prefix: 'ucs',
        body: JSON.stringify({
          file_base64: photoBase64 || undefined,
          mime_type: photoMime,
          remarks: remarks.trim() || undefined,
        }),
      });
      setMsg('Prize verified & claimed successfully! 🎉');
      setVerifyId(null);
      load();
    } catch (e) {
      setErr(e.message || 'Failed to verify');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13 }}>Loading incentive claims…</div>;
  }

  const field = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 13.5, outline: 'none' };

  const actionRow = (inc) => (
    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
      {inc.claim_status === 'verified'
        ? <span style={{ padding: '7px 12px', borderRadius: 8, background: '#dbeafe', color: '#1d4ed8', fontSize: 12, fontWeight: 700 }}>✓ Verified · {inc.claimed_at ? fmtDate(inc.claimed_at) : ''}</span>
        : <button onClick={() => openVerify(inc.id)} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: 'linear-gradient(90deg,#16a34a,#22c55e)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Verify & Claim Prize</button>}
    </div>
  );

  const renderCard = (inc) => (
    <div key={inc.id} style={{ border: '1.5px solid var(--line)', borderRadius: 14, padding: 16, background: 'var(--card-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>{inc.title}</div>
        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: inc.claim_status === 'verified' ? '#dbeafe' : '#fef3c7', color: inc.claim_status === 'verified' ? '#1d4ed8' : '#b45309', whiteSpace: 'nowrap' }}>
          {inc.claim_status === 'verified' ? '✓ VERIFIED' : 'PENDING'}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>
        Winner: <b style={{ color: 'var(--ink)' }}>{inc.winner_name || '—'}</b>
        {inc.winner_claimed_at ? ` · won ${fmtDate(inc.winner_claimed_at)}` : ''}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>
        Target {fmtMoney(inc.target_amount)} · Prize <b style={{ color: '#b45309' }}>{fmtMoney(inc.incentive_amount)}</b>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>Window: {fmtDate(inc.start_at)} → {fmtDate(inc.end_at)}</div>

      {inc.claim_status === 'verified' && inc.claim_photo_url && (
        <div style={{ marginTop: 8 }}>
          <img src={inc.claim_photo_url} alt="Claim evidence" style={{ width: '100%', maxWidth: 240, borderRadius: 10, border: '1px solid var(--line)' }} />
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
            {inc.claim_remarks ? `Remarks: ${inc.claim_remarks}` : 'Prize paid to winner'}
          </div>
        </div>
      )}
      {actionRow(inc)}
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span style={{ fontSize: 24 }}>🏆</span>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>Incentive Verification</h2>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Verify & claim the Sir ka Incentive prize — upload the FRO + cash photo as payout proof</div>
        </div>
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#dcfce7', color: '#166534', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{msg}</div>}
      {err && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fee2e2', color: '#b91c1c', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{err}</div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>Pending Payouts ({data.pending.length})</div>
        <button onClick={load} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid var(--line)', background: 'var(--card-bg)', color: 'var(--ink)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Refresh</button>
      </div>

      {data.pending.length === 0 && data.verified.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', borderRadius: 16, border: '1.5px dashed var(--line)', color: 'var(--ink-soft)', fontSize: 13 }}>
          No incentive payouts yet.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {data.pending.length === 0
              ? <div style={{ padding: 24, textAlign: 'center', borderRadius: 14, border: '1.5px dashed var(--line)', color: 'var(--ink-soft)', fontSize: 13 }}>Nothing waiting to be verified 👍</div>
              : data.pending.map(renderCard)}
          </div>

          {data.verified.length > 0 && (
            <>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>Verified / Claimed ({data.verified.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.verified.map(renderCard)}
              </div>
            </>
          )}
        </>
      )}

      {verifyId && (() => {
        const inc = data.pending.find(i => String(i.id) === String(verifyId));
        if (!inc) return null;
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 99990, background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ width: 'min(460px, 100%)', maxHeight: '92vh', overflowY: 'auto', borderRadius: 18, padding: 20, background: 'var(--card-bg)', border: '1.5px solid var(--line)', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>Verify Prize Payout</div>
                <button onClick={() => setVerifyId(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink-soft)' }}>✕</button>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>
                <b>{inc.title}</b>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 12 }}>
                Winner: <b style={{ color: 'var(--ink)' }}>{inc.winner_name || '—'}</b> · Prize: <b style={{ color: '#b45309' }}>{fmtMoney(inc.incentive_amount)}</b>
              </div>

              <button
                onClick={() => fileRef.current?.click()}
                style={{ width: '100%', padding: '26px 12px', borderRadius: 12, border: '1.5px dashed #f59e0b', background: '#fffdf5', color: '#b45309', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                {preview ? 'Change photo' : '📷 Upload FRO + Cash photo'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { pickPhoto(e.target.files[0]); e.target.value = '' }} />

              {preview && (
                <img src={preview} alt="Preview" style={{ width: '100%', marginTop: 10, borderRadius: 12, border: '1px solid var(--line)' }} />
              )}
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 6 }}>Photo is saved to storage as proof the prize cash was handed to the FRO.</div>

              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: 5 }}>Remarks (optional)</label>
                <input style={field} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Cash ₹500 handed over" />
              </div>

              <button
                onClick={submitVerify}
                disabled={submitting || !photoBase64}
                style={{ marginTop: 16, width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(90deg,#16a34a,#22c55e)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting || !photoBase64 ? .6 : 1 }}
              >
                {submitting ? 'Verifying…' : '✓ Verify & Claim Prize'}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
