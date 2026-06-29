import { createContext, useContext, useCallback, useState, useMemo, useEffect } from 'react'
import { useUcs } from '../../store'
import { api } from '../../api/auth'

const RecContext = createContext(null)
export const useRec = () => useContext(RecContext)

const PALETTE = ['#5B6B4E','#B5603A','#C08A2E','#4F6472','#7A5C7E','#88693D']
export const avatarColor = (name) => { let h=0; for(const c of name) h=c.charCodeAt(0)+((h<<5)-h); return PALETTE[Math.abs(h)%PALETTE.length] }
export const initials = (n) => n.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase()
export const avatarTint = (hex) => hex + '22'

const now = () => new Date().toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
export const STAGES = ['New','Screening','Interview','Offer','Hired']
export const LEAD_SOURCES = ['Walk-in','LinkedIn','Referral','Job Portal','Campus','Social Media','Other']
export const LEAD_STATUSES = ['rejected','selected','hold','scheduled','joined']

let _id = 100
const nid = () => ++_id

export function RecProvider({ children }) {
  const { token, user } = useUcs()

  const [candidates, setCandidates] = useState([])
  const [jobs, setJobs] = useState([])
  const [feed, setFeed] = useState([{ id:0, msg:'Recruiter workspace ready', time: now() }])
  const log = useCallback((msg)=>setFeed(f=>[{id:nid(),msg,time:now()},...f].slice(0,8)),[])

  const moveCandidate = (id, stage) => setCandidates(p => p.map(c => { if(c.id===id){ log(`${c.name} \u2192 ${stage}`); return {...c,stage}; } return c; }))
  const addCandidate = (c) => { setCandidates(p => [{ ...c, id:nid(), stage:'New', score:c.score||75, applied:new Date().toISOString().slice(0,10) }, ...p]); log(`Added candidate ${c.name}`) }
  const addJob = (j) => { setJobs(p => [...p, { ...j, id:nid(), applicants:0, status:'Open' }]); log(`Opened role \u00B7 ${j.title}`) }

  const [leads, setLeads] = useState([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [leadFilters, setLeadFilters] = useState({ search: '', status: '', source: '' })

  const fetchLeads = useCallback(async (silent) => {
    if (!token) return
    if (!silent) setLeadsLoading(true)
    try {
      const params = new URLSearchParams()
      if (leadFilters.search) params.set('search', leadFilters.search)
      if (leadFilters.status) params.set('status', leadFilters.status)
      if (leadFilters.source) params.set('source', leadFilters.source)
      const qs = params.toString()
      const data = await api('/leads' + (qs ? '?' + qs : ''), { _prefix: 'ucs' })
      setLeads(data)
    } catch {} finally { setLeadsLoading(false) }
  }, [token, leadFilters])

  const refreshLeads = useCallback(() => fetchLeads(false), [fetchLeads])

  useEffect(() => {
    if (!token) return
    fetchLeads(true)
    const interval = setInterval(() => fetchLeads(true), 15000)
    return () => clearInterval(interval)
  }, [token, fetchLeads])

  const addLead = useCallback(async (data) => {
    await api('/leads', { method: 'POST', body: JSON.stringify(data), _prefix: 'ucs' })
    await fetchLeads(true)
    log(`Lead created \u2014 ${data.name}`)
  }, [fetchLeads, log])

  const updateLead = useCallback(async (id, data) => {
    await api('/leads/' + id, { method: 'PUT', body: JSON.stringify(data), _prefix: 'ucs' })
    await fetchLeads(true)
    log(`Lead updated \u2014 ${id}`)
  }, [fetchLeads, log])

  const [leadStats, setLeadStats] = useState({ leads:0, today:0, onHold:0, conversion:0 })
  const fetchLeadStats = useCallback(async () => {
    if (!token) return
    try {
      const data = await api('/leads/dashboard', { _prefix: 'ucs' })
      if (data) setLeadStats(data)
    } catch {}
  }, [token])

  useEffect(() => { if (token) fetchLeadStats() }, [token, fetchLeadStats])

  const updateLeadFilters = useCallback((filters) => {
    setLeadFilters(prev => ({ ...prev, ...filters }))
  }, [])

  const value = useMemo(() => ({
    candidates, jobs, feed, log,
    moveCandidate, addCandidate, addJob,
    leads, leadsLoading, leadFilters, setLeadFilters, leadStats,
    fetchLeads, refreshLeads, addLead, updateLead, fetchLeadStats, updateLeadFilters,
    currentUser: user, user,
  }), [candidates, jobs, feed, leads, leadsLoading, leadFilters, setLeadFilters, leadStats, user])

  return <RecContext.Provider value={value}>{children}</RecContext.Provider>
}
