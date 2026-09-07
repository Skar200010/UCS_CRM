import { useState } from 'react';
import { useHR, avatarColor, avatarTint, initials } from '../store';
import { ArrowLeft } from '../icons';
import { deptLabel } from '../../../lib/labels';

export default function Offboarding({ worker, onBack }) {
  const { removeWorker, abscondWorker, updateWorker } = useHR();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [action, setAction] = useState('');
  const [err, setErr] = useState('');

  const color = avatarColor(worker.name);

  const handleDelete = async () => {
    setBusy(true);
    setErr('');
    setAction('deleted');
    try {
      await removeWorker(worker.id);
      onBack();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const handleAbscond = async () => {
    setBusy(true);
    setErr('');
    setAction('absconded');
    try {
      await abscondWorker(worker.id);
      onBack();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const handleRemain = async () => {
    setBusy(true);
    setErr('');
    setAction('remained');
    try {
      await updateWorker(worker.id, { employment_status: 'active', is_active: true });
      onBack();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="card offboarding-pad" style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>&#10003;</div>
        <h3 style={{ marginBottom:4 }}>
          {action === 'deleted' ? `${worker.name} deleted` : action === 'remained' ? `${worker.name} restored to active` : `${worker.name} marked as absconded`}
        </h3>
        <p style={{ color:'var(--ink-soft)', fontSize:13, marginBottom:20 }}>
          {action === 'deleted'
            ? 'The volunteer has been permanently removed from the system.'
            : action === 'remained'
            ? 'The volunteer has been restored to the active volunteer list.'
            : 'The volunteer will not appear in the active volunteer list but can be found via search.'}
        </p>
        <button className="btn btn-primary" onClick={onBack}>Back to Volunteers</button>
      </div>
    );
  }

  return (
    <>
      <button className="btn back-btn" onClick={onBack}><ArrowLeft width={16}/> Back</button>

      <div className="card" style={{ marginBottom:20, border:'1px solid var(--danger)', background:'var(--danger-soft)' }}>
        <div className="card-pad" style={{ display:'flex', gap:16, alignItems:'center' }}>
          <div className="avatar" style={{ background:avatarTint(color), color, width:52, height:52, fontSize:18, borderRadius:12 }}>
            {initials(worker.name)}
          </div>
          <div>
            <h3 style={{ fontSize:16 }}>{worker.name}</h3>
            <div style={{ fontSize:13, color:'var(--ink-soft)' }}>{deptLabel(worker.department) || '—'}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-head"><h3>Offboarding</h3></div>
        <div className="card-pad">
          <p style={{ fontSize:13, color:'var(--ink-soft)', marginBottom:16, lineHeight:1.6 }}>
            Choose an action for <strong>{worker.name}</strong>:
          </p>
          {err && <div style={{ color:'var(--danger)', fontSize:13, marginBottom:12, padding:'8px 12px', background:'var(--danger-soft)', borderRadius:'var(--radius-sm)' }}>{err}</div>}

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="card" style={{ margin:0, border:'1px solid var(--line)', cursor: busy ? 'not-allowed' : 'pointer' }}
              onClick={busy ? undefined : handleDelete}>
              <div className="card-pad" style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                <div style={{ width:36, height:36, borderRadius:8, background:'var(--danger-soft)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'var(--danger)', fontSize:18, fontWeight:700 }}>X</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:14, marginBottom:2 }}>Delete Permanently</div>
                  <div style={{ fontSize:12, color:'var(--ink-soft)', lineHeight:1.5 }}>
                    Permanently remove {worker.name} from the system. Their attendance, leave, and
                    document records will remain in the database, but the volunteer will no longer
                    appear anywhere.
                  </div>
                </div>
                <button className="btn btn-sm" style={{ background:'var(--danger)', color:'#fff', borderColor:'var(--danger)', marginLeft:'auto', flexShrink:0 }}
                  onClick={(e) => { e.stopPropagation(); handleDelete(); }} disabled={busy}>
                  {busy ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>

            {worker.employment_status === 'absconded' ? (
              <div className="card" style={{ margin:0, border:'1px solid var(--line)', cursor: busy ? 'not-allowed' : 'pointer' }}
                onClick={busy ? undefined : handleRemain}>
                <div className="card-pad" style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:'#e8f5e9', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#2e7d32', fontSize:18, fontWeight:700 }}>&#10003;</div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14, marginBottom:2 }}>Remain</div>
                    <div style={{ fontSize:12, color:'var(--ink-soft)', lineHeight:1.5 }}>
                      Restore {worker.name} to the active volunteer list. They will appear
                      in the volunteer list and can be managed normally.
                    </div>
                  </div>
                  <button className="btn btn-sm" style={{ background:'#2e7d32', color:'#fff', borderColor:'#2e7d32', marginLeft:'auto', flexShrink:0 }}
                    onClick={(e) => { e.stopPropagation(); handleRemain(); }} disabled={busy}>
                    {busy ? 'Processing…' : 'Remain'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ margin:0, border:'1px solid var(--line)', cursor: busy ? 'not-allowed' : 'pointer' }}
                onClick={busy ? undefined : handleAbscond}>
                <div className="card-pad" style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:'#fff3e0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#e65100', fontSize:18, fontWeight:700 }}>!</div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14, marginBottom:2 }}>Mark as Absconded</div>
                    <div style={{ fontSize:12, color:'var(--ink-soft)', lineHeight:1.5 }}>
                      Mark {worker.name} as absconded. The volunteer will not show in the active
                      volunteer list but can be found via search or filter. The details page will
                      display "Absconded" status.
                    </div>
                  </div>
                  <button className="btn btn-sm" style={{ background:'#e65100', color:'#fff', borderColor:'#e65100', marginLeft:'auto', flexShrink:0 }}
                    onClick={(e) => { e.stopPropagation(); handleAbscond(); }} disabled={busy}>
                    {busy ? 'Processing…' : 'Abscond'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop:16 }}>
            <button className="btn" onClick={onBack} disabled={busy}>Cancel</button>
          </div>
        </div>
      </div>
    </>
  );
}
