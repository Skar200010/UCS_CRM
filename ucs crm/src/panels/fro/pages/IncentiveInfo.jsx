const blocks = [
  {
    title: 'Monthly Target',
    icon: 'trackpad_target',
    color: '#5B6B4E',
    items: [
      'Set by Admin after your first 3 months',
      'First 3 months: auto-calculated from salary & joining date',
      'Target must be met for any incentive payouts',
    ],
  },
  {
    title: 'Aaj Ka Incentive (AKI)',
    icon: 'stack_star',
    color: '#7A8F6A',
    items: [
      'Daily achievement logged by HR/Admin',
      'Summed at month end → totalAKI',
      'Target met? AKI = totalAKI × 100% (new joiners) or × 50% (regular)',
      'Target not met? AKI = ₹0',
    ],
  },
  {
    title: 'Monthly 10%',
    icon: 'trending_up',
    color: '#16a34a',
    items: [
      'Earn 10% of collection EXCEEDING your target',
      'Formula: (Collected − Target) × 10%',
      'Example: ₹65K − ₹50K = ₹15K excess → ₹1,500',
    ],
  },
  {
    title: 'Sunday Bonus',
    icon: 'celebration',
    color: '#e67e22',
    items: [
      '1 extra day\'s pay if:',
      '• You came on the LAST Sunday of the month',
      '• Achievement ≥ 60% of target (40% for new joiners)',
    ],
  },
  {
    title: 'Payment & Target',
    icon: 'payments',
    color: '#4338ca',
    items: [
      'Every "Lead Done" payment counts toward your target',
      'Paid leads reappear as "My Leads" after 30 days',
      'More collection → closer to target → unlock incentives',
    ],
  },
];

export default function IncentiveInfo() {
  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'16px 0' }}>
      <div style={{ marginBottom:20 }}>
        <h3 style={{ margin:'0 0 4px' }}>How Incentives Work</h3>
        <p style={{ margin:0, fontSize:12, color:'var(--ink-soft)', lineHeight:1.5 }}>
          Your monthly earnings: Salary + AKI + Monthly 10% + Sunday Bonus
        </p>
      </div>

      {blocks.map((b, i) => (
        <div key={i} style={{ marginBottom:12, border:'1px solid var(--line)', borderRadius:10, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'var(--bg)', borderBottom:'1px solid var(--line)' }}>
            <span className="material-symbols-outlined" style={{ fontSize:20, color:b.color }}>{b.icon}</span>
            <span style={{ fontSize:13, fontWeight:700, color:b.color }}>{b.title}</span>
          </div>
          <div style={{ padding:'10px 16px 14px' }}>
            {b.items.map((line, j) => (
              <div key={j} style={{
                padding:'3px 0', fontSize:11.5, lineHeight:1.55,
                color: line.startsWith('•') ? 'var(--ink)' : 'var(--ink-soft)',
                paddingLeft: line.startsWith('•') ? 0 : 0,
              }}>
                {line.startsWith('•') ? (
                  <span style={{ display:'flex', gap:6 }}>
                    <span style={{ color:b.color, marginTop:1 }}>•</span>
                    <span>{line.replace(/^•\s*/,'')}</span>
                  </span>
                ) : line.startsWith('Example') || line.startsWith('Formula') ? (
                  <span style={{ display:'inline-block', marginTop:3, padding:'4px 10px', background:'#f0fdf4', borderRadius:6, fontSize:11, color:'#166534', fontWeight:500 }}>
                    {line}
                  </span>
                ) : (
                  <span style={{ color:'var(--ink-soft)', fontSize:11 }}>{line}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ textAlign:'center', padding:'12px 0 24px', fontSize:11, color:'var(--ink-soft)' }}>
        Incentives calculated at month end based on attendance, achievements &amp; collections.
      </div>
    </div>
  );
}
