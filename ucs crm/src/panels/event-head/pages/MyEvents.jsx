import { useState } from 'react'

const NGO_OPTIONS = ['BSCT','MANN','AFLF']

const BSCT_DATA = [
  { date:'1-Jul-2026',  event:'Stationary kit',      day:'Wednesday' },
  { date:'2-Jul-2026',  event:'',                     day:'Thursday'  },
  { date:'4-Jul-2026',  event:'',                     day:'Saturday'  },
  { date:'5-Jul-2026',  event:'Meal Distribution',    day:'Sunday'    },
  { date:'6-Jul-2026',  event:'',                     day:'Monday'    },
  { date:'8-Jul-2026',  event:'',                     day:'Wednesday' },
  { date:'9-Jul-2026',  event:'sanitary pad',         day:'Thursday'  },
  { date:'10-Jul-2026', event:'',                     day:'Friday'    },
  { date:'12-Jul-2026', event:'',                     day:'Sunday'    },
  { date:'13-Jul-2026', event:'computer lab',         day:'Monday'    },
  { date:'14-Jul-2026', event:'',                     day:'Tuesday'   },
  { date:'16-Jul-2026', event:'',                     day:'Thursday'  },
  { date:'17-Jul-2026', event:'snack Kits',           day:'Friday'    },
  { date:'18-Jul-2026', event:'',                     day:'Saturday'  },
  { date:'20-Jul-2026', event:'',                     day:'Monday'    },
  { date:'21-Jul-2026', event:'cloths distribution',  day:'Tuesday'   },
  { date:'22-Jul-2026', event:'',                     day:'Wednesday' },
  { date:'23-Jul-2026', event:'Tree plantation',      day:'Thursday'  },
  { date:'24-Jul-2026', event:'',                     day:'Friday'    },
  { date:'25-Jul-2026', event:'Animal Care',          day:'Saturday'  },
  { date:'26-Jul-2026', event:'',                     day:'Sunday'    },
  { date:'28-Jul-2026', event:'',                     day:'Tuesday'   },
  { date:'29-Jul-2026', event:'Tricycle Distribution',day:'Wednesday' },
  { date:'30-Jul-2026', event:'',                     day:'Thursday'  },
  { date:'31-Jul-2026', event:'Ration Kit',           day:'Friday'    },
]

export default function MyEvents() {
  const [filter, setFilter] = useState('')

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16 }}>Events</h3>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All Status</option>
            {NGO_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {filter === 'BSCT' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'var(--sage-soft)', textAlign:'left' }}>
                <th style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)' }}>Events</th>
                <th style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)' }}>day</th>
              </tr>
            </thead>
            <tbody>
              {BSCT_DATA.map((row, i) => (
                <tr key={i} style={{ background:i%2===0?'transparent':'var(--sage-soft)' }}>
                  <td style={{ padding:'6px 12px', borderBottom:'1px solid var(--border)', fontWeight: 500}}>{row.event}</td>
                  <td style={{ padding:'6px 12px', borderBottom:'1px solid var(--border)', color:'var(--ink-soft)' }}>{row.day}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filter && filter !== 'BSCT' && (
        <div style={{ padding:40, textAlign:'center', color:'var(--ink-soft)' }}>
          No data available for {filter}
        </div>
      )}

      {!filter && (
        <div style={{ padding:40, textAlign:'center', color:'var(--ink-soft)' }}>
          Select an NGO to view events
        </div>
      )}
    </>
  )
}
