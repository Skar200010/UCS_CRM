import { useState, useEffect, useCallback, useRef } from 'react';
import QRCodeStyling from 'qr-code-styling';
import { useHR } from '../store';

const qrLogo = '/logo/qr.png';

function StyledQR({ data, size = 200, plain = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    const opts = {
      width: size,
      height: size,
      data,
    };
    if (plain) {
      opts.dotsOptions = { type: 'square', color: '#000000' };
      opts.backgroundOptions = { color: '#ffffff' };
      opts.cornersSquareOptions = { type: 'square', color: '#000000' };
      opts.cornersDotOptions = { type: 'square', color: '#000000' };
    } else {
      opts.image = qrLogo;
      opts.dotsOptions = {
        type: 'rounded',
        gradient: { type: 'linear', rotation: 0, colorStops: [{ offset: 0, color: '#4f46e5' }, { offset: 1, color: '#6366f1' }] },
      };
      opts.cornersSquareOptions = { type: 'extra-rounded', color: '#4f46e5' };
      opts.cornersDotOptions = { type: 'dot', color: '#4f46e5' };
      opts.backgroundOptions = { color: '#ffffff' };
      opts.imageOptions = { crossOrigin: 'anonymous', margin: 8, imageSize: 0.35 };
    }
    const qr = new QRCodeStyling(opts);
    qr.append(el);
    return () => { if (el) el.innerHTML = ''; };
  }, [data, size, plain]);

  return <div ref={ref} />;
}

async function printStyledQR(qrData, label, plain) {
  const opts = {
    width: 300,
    height: 300,
    data: qrData,
  };
  if (plain) {
    opts.dotsOptions = { type: 'square', color: '#000000' };
    opts.backgroundOptions = { color: '#ffffff' };
    opts.cornersSquareOptions = { type: 'square', color: '#000000' };
    opts.cornersDotOptions = { type: 'square', color: '#000000' };
  } else {
    opts.image = qrLogo;
    opts.dotsOptions = {
      type: 'rounded',
      gradient: { type: 'linear', rotation: 0, colorStops: [{ offset: 0, color: '#4f46e5' }, { offset: 1, color: '#6366f1' }] },
    };
    opts.cornersSquareOptions = { type: 'extra-rounded', color: '#4f46e5' };
    opts.cornersDotOptions = { type: 'dot', color: '#4f46e5' };
    opts.backgroundOptions = { color: '#ffffff' };
    opts.imageOptions = { crossOrigin: 'anonymous', margin: 8, imageSize: 0.35 };
  }
  const tempQR = new QRCodeStyling(opts);
  const div = document.createElement('div');
  tempQR.append(div);
  document.body.appendChild(div);
  await new Promise(r => setTimeout(r, 200));
  const blob = await tempQR.getRawData('png');
  document.body.removeChild(div);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>QR Code</title><style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;margin:0;padding:20px}img{max-width:300px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.12)}h2{margin:16px 0 4px}p{margin:2px 0;color:#666}</style></head><body>`);
  win.document.write(`<img src="${url}" alt="QR"/>`);
  win.document.write(`<h2>${label}</h2>`);
  win.document.write('</body></html>');
  win.document.close();
  setTimeout(() => { win.print(); }, 500);
}

export default function GenerateQR() {
  const { generateQR, fetchQRCodes, removeQRCode } = useHR();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('100');
  const [busy, setBusy] = useState(false);
  const [viewedQR, setViewedQR] = useState(null);
  const [qrStyle, setQrStyle] = useState('beautiful');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await fetchQRCodes();
      setCodes(data);
      if (!Array.isArray(data)) setError('Unexpected response format');
    } catch (e) { setError(e.message); } finally {
      setLoading(false);
    }
  }, [fetchQRCodes]);

  useEffect(() => { load(); }, [load]);

  const getLocation = () => {
    if (!navigator.geolocation) return alert('Geolocation not supported');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLatitude(pos.coords.latitude.toFixed(6)); setLongitude(pos.coords.longitude.toFixed(6)); },
      () => alert('Could not get location'),
    );
  };

  const handleGenerate = async () => {
    if (!label || !latitude || !longitude) return alert('Label, latitude, and longitude are required');
    setBusy(true);
    try {
      await generateQR(label, parseFloat(latitude), parseFloat(longitude), parseInt(radius) || 100);
      setLabel(''); setLatitude(''); setLongitude(''); setRadius('100');
      await load();
      document.querySelector('.card-head h3')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) { alert(err.message); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this QR code?')) return;
    try {
      await removeQRCode(id);
      load();
    } catch (err) { alert(err.message); }
  };

  const qrData = (qr) => JSON.stringify({ code: qr.code, lat: qr.latitude, lng: qr.longitude });

  return (
    <div>
      <div className="card" style={{ padding: '24px 28px', marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>Generate New QR Code</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
            <input type="radio" name="qrStyle" checked={qrStyle === 'beautiful'} onChange={() => setQrStyle('beautiful')} />
            Beautiful QR
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
            <input type="radio" name="qrStyle" checked={qrStyle === 'plain'} onChange={() => setQrStyle('plain')} />
            Plain QR
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            Location Label
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Main Office - Ground Floor" />
          </label>
          <label className="field">
            Latitude
            <input type="number" step="any" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="e.g. 19.076090" />
          </label>
          <label className="field">
            Longitude
            <input type="number" step="any" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="e.g. 72.877426" />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={getLocation}>&#x1F4CD; Get Current Location</button>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, fontSize: 12 }}>
            Radius (m):
            <input type="number" value={radius} onChange={e => setRadius(e.target.value)} style={{ width: 70 }} min="10" />
          </label>
          <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={busy} style={{ marginLeft: 'auto' }}>
            {busy ? 'Generating...' : 'Generate QR'}
          </button>
        </div>
      </div>

      {error && <div style={{ background:'#fef2f2', color:'#991b1b', padding:'10px 14px', borderRadius:8, fontSize:13, marginBottom:12 }}>{error}</div>}

      <div className="card">
        <div className="card-head">
          <h3>All QR Codes</h3>
          <span className="count">{codes.length} total</span>
        </div>
        {loading ? (
          <div className="card-pad"><div className="loading">Loading...</div></div>
        ) : codes.length === 0 ? (
          <div className="card-pad"><div className="loading">No QR codes generated yet</div></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, padding: 16 }}>
            {codes.map(qr => (
              <div key={qr.id} className="card" style={{ padding: 14, textAlign: 'center', boxShadow: 'none', cursor: 'pointer' }} onClick={() => setViewedQR(qr)}>
                  <StyledQR data={qrData(qr)} size={120} plain={qrStyle === 'plain'} />
                <p style={{ fontSize: 12, fontWeight: 600, margin: '6px 0 2px' }}>{qr.label}</p>
                <p style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{qr.latitude}, {qr.longitude}</p>
                <p style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{qr.radius_meters}m radius</p>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 6 }}>
                  <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); printStyledQR(qrData(qr), qr.label, qrStyle === 'plain'); }} title="Print">&#x1F5A8;</button>
                  <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(qr.id); }} title="Delete" style={{ color: 'var(--danger)' }}>&#x1F5D1;</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {viewedQR && (
        <div className="modal-overlay" onClick={() => setViewedQR(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-head">
              <h3>{viewedQR.label}</h3>
              <button className="btn btn-sm" onClick={() => setViewedQR(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '24px 24px 16px' }}>
              <StyledQR data={qrData(viewedQR)} size={280} plain={qrStyle === 'plain'} />
              <p style={{ margin: '12px 0 2px', fontSize: 14, color: 'var(--ink-soft)' }}>
                {viewedQR.latitude}, {viewedQR.longitude}
              </p>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)' }}>
                {viewedQR.radius_meters}m radius
              </p>
            </div>
            <div className="modal-foot" style={{ justifyContent: 'center', gap: 8 }}>
              <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(qrData(viewedQR)); alert('Copied!'); }}>
                Copy Data
              </button>
              <button className="btn btn-sm" onClick={() => printStyledQR(qrData(viewedQR), viewedQR.label, qrStyle === 'plain')}>Print</button>
              <button className="btn btn-sm" onClick={() => { setViewedQR(null); handleDelete(viewedQR.id); }} style={{ color: 'var(--danger)' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
