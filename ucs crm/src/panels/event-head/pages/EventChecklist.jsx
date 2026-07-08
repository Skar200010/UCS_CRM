import { useState, useEffect } from 'react'
import { CHECKLIST_ITEMS, fetchEvents, fetchChecklist, updateChecklistItem } from '../store'

export default function EventChecklist() {
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [checklist, setChecklist] = useState([])

  useEffect(() => { fetchEvents().then(setEvents).catch(e => console.error('EventChecklist fetchEvents:', e)) }, [])
  useEffect(() => {
    if (!selectedEvent) { setChecklist(CHECKLIST_ITEMS.map((l,i) => ({id:i,label:l,status:false,notes:''}))); return }
    fetchChecklist(selectedEvent).then(data => {
      const items = CHECKLIST_ITEMS.map((l,i) => {
        const existing = data?.find(d => d.label === l)
        return existing || {id:i,label:l,status:false,notes:''}
      })
      setChecklist(items)
    }).catch(() => setChecklist(CHECKLIST_ITEMS.map((l,i) => ({id:i,label:l,status:false,notes:''}))))
  }, [selectedEvent])

  const toggle = async (item) => {
    const updated = { ...item, status: !item.status }
    setChecklist(checklist.map(c => c.id === item.id ? updated : c))
    if (selectedEvent) await updateChecklistItem(selectedEvent, item.id, updated).catch(e => console.error('EventChecklist updateChecklistItem:', e))
  }

  const completed = checklist.filter(c => c.status).length

  return (
    <div className="card">
      <div className="card-head">
        <h3>Event Checklist</h3>
        <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} style={{padding:'6px 10px',border:'1px solid var(--line)',borderRadius:'var(--radius-sm)',fontSize:13}}>
          <option value="">General Checklist</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </div>
      <div className="card-pad">
        {selectedEvent && (
          <div style={{marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
            <div style={{flex:1,height:6,background:'var(--line)',borderRadius:3,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${(completed/checklist.length)*100}%`,background:'var(--sage)',borderRadius:3,transition:'width .3s'}} />
            </div>
            <span style={{fontSize:12,color:'var(--ink-soft)'}}>{completed}/{checklist.length}</span>
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {checklist.map(item => (
            <label key={item.id} style={{
              display:'flex',alignItems:'center',gap:12,padding:'10px 14px',
              background:'var(--card-bg)',border:'1px solid var(--line)',borderRadius:'var(--radius-sm)',
              cursor:'pointer',transition:'all .15s',              opacity:item.status ? 0.6 : 1
            }}>
              <input type="checkbox" checked={item.status} onChange={() => toggle(item)} style={{width:18,height:18,accentColor:'var(--sage)'}} />
              <div style={{flex:1}}>
                <div style={{fontWeight:500,fontSize:13,textDecoration:item.status?'line-through':'none',color:item.status?'var(--ink-soft)':'var(--ink)'}}>{item.label}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
