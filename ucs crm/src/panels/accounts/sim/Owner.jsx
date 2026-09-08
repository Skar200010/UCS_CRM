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

export default function Owner() {
  return (
    <div>
      {BILL_ACCOUNTS.map((acc) => (
        <div key={acc.account} className="card-block" style={{ marginBottom: 16 }}>
          <div className="table-wrap">
            <table className="sim-table">
              <thead>
                <tr>
                  <th>SIM Number</th>
                  <th>Role</th>
                  <th>Family</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {acc.rows.map((r) => (
                  <tr key={r.num}>
                    <td style={{ fontWeight: 600 }}>{r.num}</td>
                    <td><span className={`pill ${r.role === 'Primary' ? 'pill-active' : 'pill-neutral'}`}>{r.role}</span></td>
                    <td>{r.family || '—'}</td>
                    <td>{r.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
