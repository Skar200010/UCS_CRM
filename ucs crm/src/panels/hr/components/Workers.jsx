import { useState, useEffect, useRef } from 'react';
import { useHR } from '../store';
import { Who, Dropdown } from './ui';
import { Plus, Trash } from '../icons';
import { api } from '../../../api/auth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

function load() {
  try { return JSON.parse(sessionStorage.getItem('wrk') || '{}'); } catch { return {}; }
}
function save(v) {
  try { const d = load(); sessionStorage.setItem('wrk', JSON.stringify({ ...d, ...v })); } catch {}
}

export default function Workers({ onSelect, onOffboard }) {
  const { addWorker, DEPTS, fetchWorkers, fetchNGOs } = useHR();
  const [workers, setWorkers] = useState([]);
  const [name, setName] = useState('');
  const [dept, setDept] = useState(DEPTS?.[0] || '');
  const [err, setErr] = useState('');
  const [search, setSearch] = useState(load().search || '');
  const [roleFilter, setRoleFilter] = useState(load().roleFilter || '');
  const [page, setPage] = useState(load().page || 1);
  const [salaryMap, setSalaryMap] = useState({});
  const PAGE_SIZE = 20;
  const tableRef = useRef(null);

  useEffect(() => {
    fetchWorkers().then(setWorkers).catch(() => {});
    fetchNGOs().catch(() => {});
    api('/salary/workers-summary', { _prefix: 'ucs' })
      .then(data => {
        const map = {};
        for (const w of data) map[w.id] = w;
        setSalaryMap(map);
      })
      .catch(() => {});
  }, []);

  const roles = [...new Set(workers.map(w => (w.department || 'Team Member')).filter(Boolean))].sort();
  const filtered = workers.filter(w => {
    const role = w.department || 'Team Member';
    if (roleFilter && role !== roleFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return w.name.toLowerCase().includes(q) ||
      (w.email || '').toLowerCase().includes(q) ||
      role.toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const mountedSearch = useRef(false);
  useEffect(() => { if (!mountedSearch.current) { mountedSearch.current = true; return; } save({ search, page: 1 }); setPage(1); }, [search]);
  const mountedRole = useRef(false);
  useEffect(() => { if (!mountedRole.current) { mountedRole.current = true; return; } save({ roleFilter, page: 1 }); setPage(1); }, [roleFilter]);
  useEffect(() => { save({ page }); }, [page]);
  useEffect(() => {
    if (tableRef.current) tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [safePage]);

  const submit = async () => {
    if (!name.trim()) return;
    setErr('');
    try {
      await addWorker({ name: name.trim(), dept });
      setName('');
      setDept(DEPTS?.[0] || '');
      fetchWorkers().then(setWorkers).catch(() => {});
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleFullPayExport = async () => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    try {
      const data = await api('/salary/payroll?month=' + month + '&extended=true', { _prefix: 'ucs' });
      if (!data.rows || data.rows.length === 0) { alert('No payroll data for this month'); return; }

      const groups = {};
      for (const r of data.rows) {
        if (!groups[r.ngo_name]) groups[r.ngo_name] = [];
        groups[r.ngo_name].push(r);
      }

      const headers = [
        'Team Name', 'Branch Name', 'Agent Name', 'Date of Joining',
        'Salary', 'Target', 'Achieved', 'Balance', 'Achieved %',
        'May Present Days', 'Training and Sunday Deduction',
        'Sunday Need To Add', 'Net May Present Days', 'May Salary',
        'Monthly 10% Incentive', 'Aaj Ka Incentive (Daily 50% for PC)',
        'Weekly Incentive / TL', 'Gross Payable Salary',
        'OT/Appreciation/Extra Incentive', 'Any Pending Expenses Paid for Previous Month',
        'Advance need to be deducted in May, 2026', 'Net Payable Salary',
        'ACCOUNT HOL', 'ACC COL', 'Bank', 'IFSC Code',
      ];

      const wsData = [headers];
      for (const [ngo, rows] of Object.entries(groups)) {
        for (const r of rows) {
          wsData.push([
            r.department || '',
            r.ngo_name,
            r.name,
            r.date_of_joining ? r.date_of_joining.split('T')[0] : '',
            r.salary || 0,           // E: Salary
            r.target || 0,           // F: Target
            r.achieved || 0,         // G: Achieved
            null,                     // H: Balance (formula)
            null,                     // I: Achieved % (formula)
            r.present_days || 0,     // J: May Present Days
            0,                        // K: Training and Sunday Deduction
            0,                        // L: Sunday Need To Add
            null,                     // M: Net May Present Days (formula)
            r.total_due || 0,        // N: May Salary
            r.monthly_incentive || 0,  // O: Monthly 10% Incentive
            r.aki_payout || 0,         // P: Aaj Ka Incentive
            0,                        // Q: Weekly Incentive
            null,                     // R: Gross Payable Salary (formula)
            0,                        // S: OT/Appreciation
            0,                        // T: Pending Expenses
            0,                        // U: Advance to Deduct
            null,                     // V: Net Payable Salary (formula)
            r.account_holder_name || '',  // W: ACCOUNT HOL
            r.account_number || '',       // X: ACC COL
            r.bank_name || '',            // Y: Bank
            r.ifsc_code || '',            // Z: IFSC Code
          ]);
        }
      }

      for (let i = 1; i < wsData.length; i++) {
        const row = i + 1;
        wsData[i][7] = { f: `F${row}-G${row}` };                         // H: Balance (Target - Achieved)
        wsData[i][8] = { f: `IF(F${row}>0,G${row}/F${row}*100,0)` };     // I: Achieved %
        wsData[i][12] = { f: `J${row}-K${row}+L${row}` };                // M: Net May Present Days
        wsData[i][14] = { f: `IF(F${row}>0,IF(G${row}>=F${row},(G${row}-F${row})*0.1,0),0)` }; // O: Monthly 10% Incentive
        wsData[i][17] = { f: `N${row}+O${row}+P${row}+Q${row}` };        // R: Gross Payable Salary
        wsData[i][21] = { f: `R${row}+S${row}+T${row}-U${row}` };        // V: Net Payable Salary
      }

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [
        { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 14 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 16 }, { wch: 22 },
        { wch: 16 }, { wch: 18 }, { wch: 14 },
        { wch: 18 }, { wch: 26 }, { wch: 16 },
        { wch: 20 }, { wch: 30 }, { wch: 30 },
        { wch: 28 }, { wch: 18 },
        { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 16 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([xlsxBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      link.download = `payroll-full-${month}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) { alert(e.message); }
  };

  const handleOffboard = (e, worker) => {
    e.stopPropagation();
    if (onOffboard) onOffboard(worker);
  };

  const handlePayExport = async () => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    try {
      const data = await api('/salary/payroll?month=' + month, { _prefix: 'ucs' });
      if (!data.rows || data.rows.length === 0) { alert('No payroll data for this month'); return; }

      const groups = {};
      for (const r of data.rows) {
        if (!groups[r.ngo_name]) groups[r.ngo_name] = [];
        groups[r.ngo_name].push(r);
      }
      const colWidths = [{ wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 16 }, { wch: 16 }];
      const zip = new JSZip();
      for (const [ngo, rows] of Object.entries(groups)) {
        const wsData = [
          ['NGO', 'Name', 'Account Number', 'IFSC Code', 'Total Due (₹)'],
          ...rows.map(r => [r.ngo_name, r.name, r.account_number, r.ifsc_code, r.total_due]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = colWidths;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        const safeName = ngo.replace(/[\/:*?"<>|]/g, '_');
        zip.file(`${safeName}.xlsx`, xlsxBuf);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `payroll-${month}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) { alert(e.message); }
  };

  return (
    <>
      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-head"><h3>Add an employee</h3></div>
        <div className="card-pad">
          <div className="form-row">
            <label className="field">Full name
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Jane Doe"
                onKeyDown={e=>e.key==='Enter'&&submit()} />
            </label>
            <label className="field">Team
              <Dropdown value={dept} onChange={e=>setDept(e.target.value)} options={DEPTS} />
            </label>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:8, alignItems:'center' }}>
            <button className="btn btn-primary" onClick={submit}><Plus width={16}/> Add employee</button>
          </div>
          {err && <div style={{ color:'var(--danger)', fontSize:13, marginTop:8 }}>{err}</div>}
        </div>
      </div>

      <div className="card" ref={tableRef}>
        <div className="card-head"><h3>Employees</h3>
          <div className="search-input-wrap">
            <button className="btn btn-primary btn-sm" onClick={handlePayExport} title="Download payroll Excel">Pay</button>
            <button className="btn btn-outline btn-sm" onClick={handleFullPayExport} title="Download full payroll with formulas">Full Excel</button>
            <span className="sub">{filtered.length} total</span>
            <Dropdown className="role-filter" value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}
              options={[{value:'',label:'All members'}, ...roles.map(r => ({value:r, label:r}))]} />
            <input className="search-input" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search by name, email, or team…"
              style={{ marginTop:0, maxWidth:200 }} />
          </div>
        </div>
        <table>
          <thead><tr><th>Name</th><th>Joined</th><th>Salary</th><th></th></tr></thead>
          <tbody>
            {paginated.map(w => {
              const sw = salaryMap[w.id];
              const paid = sw?.current_salary_paid;
              const currentMonth = new Date().toISOString().slice(0, 7);
              const salaryFromMonth = sw?.current_salary_from?.slice(0, 7);
              const isCurrent = salaryFromMonth && salaryFromMonth <= currentMonth;
              return (
                <tr key={w.id} className="clickable-row" onClick={() => { if (onSelect) onSelect(w); }}
                  style={{ cursor:'pointer' }}>
                  <td><Who name={w.name} role={w.department || 'Team Member'} /></td>
                  <td style={{ color:'var(--ink-soft)' }}>{new Date(w.created_at).toLocaleDateString('en-GB',{month:'short',year:'numeric'})}</td>
                  <td>
                    {sw?.current_salary ? (
                      <span style={{ fontWeight:600 }}>
                        ₹{parseFloat(sw.current_salary).toLocaleString('en-IN')}
                        {paid && <span className="pill pill-green" style={{ marginLeft:6, fontSize:10 }}>Paid</span>}
                      </span>
                    ) : <span style={{ color:'var(--ink-soft)', fontSize:12 }}>—</span>}
                  </td>
                  <td style={{ textAlign:'right' }}>
                    <button className="btn btn-icon" onClick={(e)=>handleOffboard(e, w)} aria-label="Offboard employee"><Trash width={16}/></button>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={4}><div className="empty">No employees found.</div></td></tr>}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>← Prev</button>
            <div className="pagination-dots">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <span key={p} className={`dot ${p === safePage ? 'dot-active' : ''}`} onClick={() => setPage(p)} />
              ))}
            </div>
            <button className="btn btn-sm" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Next →</button>
          </div>
        )}
      </div>
    </>
  );
}
