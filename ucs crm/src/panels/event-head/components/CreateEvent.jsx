import { useState } from 'react'

export default function CreateEvent() {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [venue, setVenue] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
  }

  return (
    <div className="card">
      <div className="card-head"><h3>Create Event</h3></div>
      <div className="card-pad">
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field">
            <label>Event Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter event name" />
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Venue</label>
            <input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="Enter venue" />
          </div>
          <div style={{ marginTop:4 }}>
            <button type="submit" className="btn btn-primary">Create Event</button>
          </div>
        </form>
      </div>
    </div>
  )
}
