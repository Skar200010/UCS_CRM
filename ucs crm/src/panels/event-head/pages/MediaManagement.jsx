import { useState, useEffect } from 'react'
import { fetchEvents, fetchMedia, uploadMedia, deleteMedia } from '../store'

export default function MediaManagement() {
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [media, setMedia] = useState([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => { fetchEvents().then(setEvents).catch(e => console.error('MediaManagement fetchEvents:', e)) }, [])
  useEffect(() => {
    if (!selectedEvent) { setMedia([]); return }
    fetchMedia(selectedEvent).then(setMedia).catch(e => console.error('MediaManagement fetchMedia:', e))
  }, [selectedEvent])

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !selectedEvent) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await uploadMedia(selectedEvent, fd)
      setMedia([...media, res])
    } catch (err) { alert('Upload failed') }
    finally { setUploading(false); e.target.value = '' }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this media?')) return
    await deleteMedia(selectedEvent, id).then(() => setMedia(media.filter(m => m.id !== id))).catch(e => console.error('MediaManagement deleteMedia:', e))
  }

  return (
    <>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <h3 style={{fontSize:16}}>Media Management</h3>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} style={{padding:'6px 10px',border:'1px solid var(--line)',borderRadius:'var(--radius-sm)',fontSize:13}}>
            <option value="">Select Event</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
          {selectedEvent && (
            <label className="btn btn-primary btn-sm" style={{cursor:'pointer'}}>
              {uploading ? 'Uploading...' : '+ Upload'}
              <input type="file" hidden onChange={handleUpload} accept="image/*,video/*" />
            </label>
          )}
        </div>
      </div>
      {selectedEvent && (
        <div className="card">
          <div className="card-head"><h3>Photos & Videos</h3></div>
          <div className="card-pad">
            {media.length === 0 && <div style={{textAlign:'center',padding:40,color:'var(--ink-soft)'}}>No media uploaded yet</div>}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12}}>
              {media.map(m => (
                <div key={m.id} style={{position:'relative',borderRadius:'var(--radius-sm)',overflow:'hidden',border:'1px solid var(--line)'}}>
                  {m.type?.startsWith('video') ? (
                    <video src={m.url} style={{width:'100%',height:120,objectFit:'cover'}} controls />
                  ) : (
                    <img src={m.url} alt={m.name} style={{width:'100%',height:120,objectFit:'cover'}} />
                  )}
                  <div style={{padding:'6px 8px',fontSize:11,background:'var(--card-bg)'}}>
                    <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</div>
                  </div>
                  <button onClick={() => handleDelete(m.id)} style={{position:'absolute',top:4,right:4,width:24,height:24,borderRadius:'50%',border:'none',background:'rgba(0,0,0,.5)',color:'#fff',fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {!selectedEvent && <div className="card"><div className="card-pad" style={{textAlign:'center',padding:40,color:'var(--ink-soft)'}}>Select an event to manage media</div></div>}
    </>
  )
}
