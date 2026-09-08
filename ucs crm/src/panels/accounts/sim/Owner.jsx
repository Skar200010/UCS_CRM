const BILL_ACCOUNTS = [
  {
    account: '118978300',
    rows: [
      { num: '9892990029', role: 'Primary', family: 'Vi Max Family 1401', owner: 'Priyank Shah' },
      { num: '9987344338', role: 'Secondary', family: '', owner: 'Priyank Shah' },
      { num: '9967699295', role: 'Secondary', family: '', owner: 'Priyank Shah' },
      { num: '9892268000', role: 'Secondary', family: '', owner: 'Priyank Shah' },
      { num: '9930028300', role: 'Secondary', family: '', owner: 'Priyank Shah' },
      { num: '7039006300', role: 'Secondary', family: '', owner: 'Anjana Vyas' },
      { num: '7039006400', role: 'Secondary', family: '', owner: 'Anjana Vyas' },
      { num: '8828720806', role: 'Secondary', family: '', owner: 'Deepak Karkera' },
      { num: '7738901891', role: 'Secondary', family: '', owner: 'Deepali Gautam' },
    ],
  },
  {
    account: '107587212',
    rows: [
      { num: '8879035035', role: 'Primary', family: 'Vi Max Family 1201', owner: 'Priyank Shah' },
      { num: '8879034034', role: 'Secondary', family: '', owner: 'Priyank Shah' },
      { num: '9930028200', role: 'Secondary', family: '', owner: 'Shweta Shah' },
      { num: '9930028400', role: 'Secondary', family: '', owner: 'Shweta Shah' },
      { num: '9930064928', role: 'Secondary', family: '', owner: 'Suraj Patil' },
      { num: '9930084397', role: 'Secondary', family: '', owner: 'Suraj Patil' },
    ],
  },
  {
    account: '176955124',
    rows: [
      { num: '9820646225', role: 'Primary', family: 'Vi Max Family 1201', owner: 'Naresh Bhanushali' },
      { num: '9820644749', role: 'Secondary', family: '', owner: 'Naresh Bhanushali' },
      { num: '9820645607', role: 'Secondary', family: '', owner: 'Naresh Bhanushali' },
      { num: '9820641314', role: 'Secondary', family: '', owner: 'Naresh Bhanushali' },
      { num: '9820648405', role: 'Secondary', family: '', owner: 'Naresh Bhanushali' },
    ],
  },
  {
    account: '177089161',
    rows: [
      { num: '8879136938', role: 'Primary', family: 'Vi Max Family 1401', owner: 'Shweta Shah' },
      { num: '8879136654', role: 'Secondary', family: '', owner: 'Shweta Shah' },
      { num: '8879136934', role: 'Secondary', family: '', owner: 'Shweta Shah' },
      { num: '9920893993', role: 'Secondary', family: '', owner: 'Naresh Bhanushali' },
      { num: '9930852952', role: 'Secondary', family: '', owner: 'Naresh Bhanushali' },
    ],
  },
];

import { useState } from 'react';

const EMPTY_FORM = { account: '', num: '', role: 'Secondary', family: '', owner: '' };

export default function Owner() {
  const [accounts, setAccounts] = useState(BILL_ACCOUNTS);
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('All');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const owners = [...new Set(accounts.flatMap((a) => a.rows.map((r) => r.owner)))].sort();

  const q = search.trim().toLowerCase();
  const visibleAccounts = accounts
    .map((acc) => ({
      ...acc,
      rows: acc.rows.filter((r) =>
        (owner === 'All' || r.owner === owner) &&
        (!q ||
        r.num.includes(q) ||
        r.role.toLowerCase().includes(q) ||
        (r.family || '').toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q) ||
        acc.account.includes(q))
      ),
    }))
    .filter((acc) => acc.rows.length > 0);

  function openAdd(account) {
    setForm({ ...EMPTY_FORM, account });
    setModal({ mode: 'add' });
  }

  function openEdit(ai, ri) {
    const r = accounts[ai].rows[ri];
    setForm({ account: accounts[ai].account, num: r.num, role: r.role, family: r.family || '', owner: r.owner });
    setModal({ mode: 'edit', ai, ri });
  }

  function saveRow() {
    if (!form.num.trim()) return;
    const row = { num: form.num.trim(), role: form.role, family: form.family.trim(), owner: form.owner.trim() };
    if (modal.mode === 'add') {
      setAccounts((prev) => prev.map((a) =>
        a.account === form.account ? { ...a, rows: [...a.rows, row] } : a
      ));
    } else {
      const ai = modal.ai;
      setAccounts((prev) => prev.map((a, i) => {
        if (i !== ai) return a;
        const rows = a.rows.slice();
        rows[modal.ri] = row;
        return { ...a, rows };
      }));
    }
    setModal(null);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setAccounts((prev) => prev.map((a, i) =>
      i !== deleteTarget.ai ? a : { ...a, rows: a.rows.filter((_, j) => j !== deleteTarget.ri) }
    ));
    setDeleteTarget(null);
  }

  return (
    <div>
      <div className="owner-wrap">
        <div className="toolbar">
          <input
            className="sim-input search-input"
            placeholder="Search SIM number, account, owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
          <select className="sim-select" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="All">All Owners</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        {visibleAccounts.map((acc) => (
          <div key={acc.account} className="owner-card">
            <div className="owner-card-head">
              <span>All SIM Owner</span>
              <span className="tag">{acc.rows.length} SIM{acc.rows.length === 1 ? '' : 's'}</span>
            </div>
            <div className="owner-table-wrap">
              <table className="owner-table">
                <colgroup>
                  <col className="col-num" />
                  <col className="col-role" />
                  <col className="col-family" />
                  <col className="col-owner" />
                  <col className="col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th>SIM Number</th>
                    <th className="th-role">Role</th>
                    <th>Family</th>
                    <th>Owner</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {acc.rows.map((r, ri) => {
                    const ai = accounts.findIndex((a) => a.account === acc.account);
                    return (
                      <tr key={r.num}>
                        <td className="td-num">{r.num}</td>
                        <td className="td-inline td-role"><span className={`owner-pill ${r.role === 'Primary' ? 'primary' : 'secondary'}`}>{r.role}</span></td>
                        <td>{r.family || '—'}</td>
                        <td>{r.owner}</td>
                        <td className="td-inline">
                          <div className="owner-actions">
                            <button className="mini-btn" onClick={() => openEdit(ai, ri)}>Edit</button>
                            <button className="mini-btn" onClick={() => openAdd(acc.account)}>Add</button>
                            <button className="mini-btn danger" onClick={() => setDeleteTarget({ ai, ri, num: r.num })}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-head">
              <h3>{modal.mode === 'edit' ? 'Edit SIM Owner' : 'Add SIM Owner'}</h3>
              <button className="modal-x" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label>SIM Number*</label>
                <input value={form.num} onChange={(e) => setForm((f) => ({ ...f, num: e.target.value }))} placeholder="e.g. 9892990029" />
              </div>
              <div className="form-row">
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                  <option>Primary</option>
                  <option>Secondary</option>
                </select>
              </div>
              <div className="form-row">
                <label>Family</label>
                <input value={form.family} onChange={(e) => setForm((f) => ({ ...f, family: e.target.value }))} placeholder="e.g. Vi Max Family 1401" />
              </div>
              <div className="form-row">
                <label>Owner</label>
                <input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} placeholder="e.g. Priyank Shah" />
              </div>
            </div>
            <div className="modal-foot">
              <button className="sim-btn" onClick={() => setModal(null)}>Cancel</button>
              <button className="sim-btn primary" onClick={saveRow}>Save</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay dc-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="dc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dc-title">Delete SIM Owner?</div>
            <div className="dc-desc">
              Are you sure you want to delete <strong>{deleteTarget.num}</strong>? This action cannot be undone.
            </div>
            <div className="dc-foot">
              <button className="dc-btn cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="dc-btn delete" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}