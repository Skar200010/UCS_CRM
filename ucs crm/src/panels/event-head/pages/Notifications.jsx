import { useState, useEffect } from 'react'
import { fetchNotifs, markNotifRead, deleteNotif } from '../store'
import { useUcs } from '../../../store'

export default function Notifications() {
  const { user } = useUcs()
  const [notifs, setNotifs] = useState([])

  useEffect(() => {
    if (!user?.id) return
    fetchNotifs(user.id).then(setNotifs).catch(e => console.error('Notifications fetchNotifs:', e))
  }, [user?.id])

  const handleRead = async (id) => {
    try {
      await markNotifRead(id)
      setNotifs(notifs.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    } catch (e) { console.error('markNotifRead:', e) }
  }

  const handleClear = async (id) => {
    try {
      await deleteNotif(id)
      setNotifs(notifs.filter(n => n.id !== id))
    } catch (e) { console.error('deleteNotif:', e) }
  }

  return (
    <div className="card">
      <div className="card-head"><h3>Notifications & Reminders</h3></div>
      <div className="card-pad" style={{padding:0}}>
        {notifs.length === 0 && <div style={{textAlign:'center',padding:40,color:'var(--ink-soft)'}}>No notifications</div>}
        <div style={{display:'flex',flexDirection:'column'}}>
          {notifs.map(n => (
            <div key={n.id} style={{
              display:'flex',gap:12,padding:'12px 18px',borderBottom:'1px solid var(--line)',
              background:n.read_at ? 'transparent' : 'var(--sage-soft)'
            }}>
              <div style={{width:8,height:8,borderRadius:'50%',background:n.read_at ? 'var(--line)' : 'var(--sage)',marginTop:6,flexShrink:0}} />
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13}}>{n.title}</div>
                <div style={{fontSize:12,color:'var(--ink-soft)',marginTop:2}}>{n.body}</div>
                <div style={{fontSize:11,color:'var(--ink-soft)',marginTop:4,opacity:.6}}>{n.created_at?.slice(0,16).replace('T',' ')}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:4,flexShrink:0}}>
                {!n.read_at && (
                  <button onClick={() => handleRead(n.id)}
                    style={{fontSize:11,padding:'2px 8px',border:'1px solid var(--sage)',borderRadius:4,background:'transparent',color:'var(--sage)',cursor:'pointer',whiteSpace:'nowrap'}}>
                    Read
                  </button>
                )}
                {n.read_at && (
                  <button onClick={() => handleClear(n.id)}
                    style={{fontSize:11,padding:'2px 8px',border:'1px solid #dc2626',borderRadius:4,background:'transparent',color:'#dc2626',cursor:'pointer',whiteSpace:'nowrap'}}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
