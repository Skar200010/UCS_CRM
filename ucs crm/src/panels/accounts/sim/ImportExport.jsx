import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from '../../../components/Toast';
import { importSimCards } from './api';
import { useSim } from './store';
import { exportToCSV, exportToExcel, exportSimTemplate, EXPORT_COLUMNS } from './helpers';

const HEADER_MAP = {
  'mobile id': 'mobile_id',
  'mobile id no': 'mobile_id',
  'mobile id no.': 'mobile_id',
  'mobile no': 'mobile_id',
  'mobile': 'mobile_id',
  'calling mobile': 'calling_mobile',
  'device': 'device_model',
  'device & model': 'device_model',
  'device & model name': 'device_model',
  'device model': 'device_model',
  'model': 'device_model',
  'imei': 'imei',
  'imei no': 'imei',
  'imei no.': 'imei',
  'team': 'team',
  'signature': 'signature',
  'remark': 'signature',
  'sim card issue date': 'issue_date',
  'issue date': 'issue_date',
  'auto expiry date': 'expiry_date',
  'expiry date': 'expiry_date',
  'sim card status': 'status',
  'status': 'status',
  'replacement count': 'replacement_count',
  'sim card replacement count': 'replacement_count',
  'sim 1': 'sim_1', 'sim1': 'sim_1',
  'sim 2': 'sim_2', 'sim2': 'sim_2',
  'sim 3': 'sim_3', 'sim3': 'sim_3',
  'sim 4': 'sim_4', 'sim4': 'sim_4',
  'sim 5': 'sim_5', 'sim5': 'sim_5',
  'sim 6': 'sim_6', 'sim6': 'sim_6',
  'sim 7': 'sim_7', 'sim7': 'sim_7',
  'sim 8': 'sim_8', 'sim8': 'sim_8',
};

function normalizeDate(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  const excelSerial = Number(s);
  if (!isNaN(excelSerial) && /^\d+(\.\d+)?$/.test(s) && excelSerial > 1000 && excelSerial < 60000 && !s.includes('-')) {
    const ms = Math.round((excelSerial - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
  }
  const m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[3])).padStart(2, '0')}`;
  const m2 = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m2) return `${m2[3]}-${String(Number(m2[2])).padStart(2, '0')}-${String(Number(m2[1])).padStart(2, '0')}`;
  return s;
}

export default function ImportExport() {
  const { refresh } = useSim();
  const fileRef = useRef(null);
  const [step, setStep] = useState(1);
  const [parsed, setParsed] = useState([]);
  const [valid, setValid] = useState([]);
  const [invalid, setInvalid] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [missing, setMissing] = useState([]);
  const [err, setErr] = useState('');
  const [importing, setImporting] = useState(false);

  function parseFile(file) {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      setErr('Please upload a valid file (.xlsx, .xls, or .csv)'); return;
    }
    setErr('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
        const rows = json.map((r) => {
          const out = {};
          for (const key of Object.keys(r)) {
            const mapped = HEADER_MAP[key.toString().trim().toLowerCase()];
            if (mapped) {
              out[mapped] = r[key];
            }
          }
          out.issue_date = normalizeDate(out.issue_date);
          out.expiry_date = normalizeDate(out.expiry_date);
          return out;
        });
        setParsed(rows);
        validateRows(rows);
        setStep(3);
      } catch (ex) {
        setErr('Failed to parse file: ' + ex.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function validateRows(rows) {
    const v = [], inv = [], seen = new Set();
    for (const r of rows) {
      const mobile = String(r.mobile_id || '').trim();
      const missingFields = [];
      if (!mobile) missingFields.push('Mobile ID');
      if (!String(r.device_model || '').trim()) missingFields.push('Device & Model');
      if (!String(r.imei || '').trim()) missingFields.push('IMEI');
      if (!r.issue_date) missingFields.push('Issue Date');
      if (!r.expiry_date) missingFields.push('Expiry Date');
      const dup = mobile && seen.has(mobile.toLowerCase());
      if (mobile) seen.add(mobile.toLowerCase());
      if (missingFields.length) inv.push({ ...r, reason: `Missing: ${missingFields.join(', ')}` });
      else if (dup) inv.push({ ...r, reason: 'Duplicate Mobile ID' });
      else v.push({ ...r, replacement_count: Number(r.replacement_count) || 0 });
    }
    setValid(v);
    setInvalid(inv);
    setDuplicates(inv.filter((r) => r.reason && r.reason.includes('Duplicate')));
    setMissing(inv.filter((r) => r.reason && r.reason.includes('Missing')));
  }

  async function doImport() {
    if (!valid.length) { toast('No valid rows to import', 'error'); return; }
    setImporting(true);
    try {
      const res = await importSimCards(valid.map((r) => ({ ...r, status: r.status || 'Active' })));
      toast(res.message || 'Import complete', 'success');
      await refresh();
      setStep(5);
    } catch (e) {
      toast(e.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  }

  function reset() { setStep(1); setParsed([]); setValid([]); setInvalid([]); setDuplicates([]); setMissing([]); setErr(''); }

  const stepLabel = (n, label) => (
    <div className={`step ${step === n ? 'on' : ''} ${step > n ? 'done' : ''}`}>{step > n ? '✓' : n}. {label}</div>
  );

  return (
    <div>
      <div className="card-block" style={{ padding: 20 }}>
        <div className="import-step">
          {stepLabel(1, 'Upload')}
          {stepLabel(2, 'Map Columns')}
          {stepLabel(3, 'Preview')}
          {stepLabel(4, 'Validate')}
          {stepLabel(5, 'Import')}
        </div>

        {err && <div className="login-error" style={{ marginBottom: 16, background: 'var(--sim-red-soft)', color: 'var(--sim-red)', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px' }}>{err}</div>}

        {step === 1 && (
          <div>
            <div className="section-sub" style={{ marginBottom: 16 }}>Upload an Excel or CSV file with SIM card data. Columns are auto-mapped and validated before import.</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files[0]; if (f) parseFile(f); e.target.value = ''; }} />
            <button className="sim-btn primary" onClick={() => fileRef.current.click()}>Choose File</button>
            <div className="section-sub" style={{ marginTop: 14, fontSize: 12 }}>Supported columns: {EXPORT_COLUMNS.join(', ')}</div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div className="sim-box" style={{ flex: 1, textAlign: 'center', boxShadow: 'none', background: 'var(--sim-green-soft)' }}>
                <div className="num" style={{ color: 'var(--sim-green)' }}>{valid.length}</div>
                <div className="title">Valid Rows</div>
              </div>
              <div className="sim-box" style={{ flex: 1, textAlign: 'center', boxShadow: 'none', background: 'var(--sim-red-soft)' }}>
                <div className="num" style={{ color: 'var(--sim-red)' }}>{invalid.length}</div>
                <div className="title">Invalid / Duplicate Rows</div>
              </div>
              <div className="sim-box" style={{ flex: 1, textAlign: 'center', boxShadow: 'none', background: 'var(--sim-amber-soft)' }}>
                <div className="num" style={{ color: 'var(--sim-amber)' }}>{duplicates.length}</div>
                <div className="title">Duplicates</div>
              </div>
              <div className="sim-box" style={{ flex: 1, textAlign: 'center', boxShadow: 'none', background: 'var(--sim-gray-soft)' }}>
                <div className="num">{missing.length}</div>
                <div className="title">Missing Required Fields</div>
              </div>
            </div>

            <div className="table-wrap" style={{ marginBottom: 16, maxHeight: 320, overflowY: 'auto', border: '1px solid var(--sim-line)', borderRadius: 10 }}>
              <table className="sim-table" style={{ minWidth: 700 }}>
                <thead><tr><th>Mobile ID</th><th>Device</th><th>IMEI</th><th>Team</th><th>Issue Date</th><th>Expiry Date</th><th>Validation</th></tr></thead>
                <tbody>
                  {valid.slice(0, 50).map((r, i) => (
                    <tr key={'v' + i}><td>{r.mobile_id}</td><td>{r.device_model}</td><td>{r.imei}</td><td>{r.team || ''}</td><td>{r.issue_date}</td><td>{r.expiry_date}</td><td><span className="pill pill-active">Valid</span></td></tr>
                  ))}
                  {invalid.map((r, i) => (
                    <tr key={'i' + i}><td>{r.mobile_id}</td><td>{r.device_model}</td><td>{r.imei}</td><td>{r.team || ''}</td><td>{r.issue_date}</td><td>{r.expiry_date}</td><td><span className="pill pill-expired">{r.reason}</span></td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="sim-btn" onClick={reset}>Upload Different File</button>
              <button className="sim-btn primary" onClick={doImport} disabled={importing || valid.length === 0}>
                {importing ? 'Importing...' : `Import ${valid.length} Valid Row(s)`}
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="empty-state">
            <div className="big">Import Complete</div>
            <div className="small">{valid.length} valid row(s) imported.</div>
            <button className="sim-btn" onClick={reset} style={{ marginTop: 12 }}>Import Another File</button>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--sim-line)', marginTop: 24, paddingTop: 20 }}>
          <div className="section-title" style={{ fontSize: 14, marginBottom: 4 }}>Export</div>
          <div className="section-sub" style={{ marginBottom: 12 }}>Export all SIM cards using the SIM Card Excel format.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="sim-btn" onClick={() => exportSimTemplate()}>Download Template (Excel + CSV)</button>
          </div>
        </div>
      </div>
    </div>
  );
}
