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
export const STAGES = ['Contacted','Screening','Interview Scheduled','Selected','Offer Sent','Rejected']
export const LEAD_SOURCES = ['Walk-in','LinkedIn','Referral','Job Portal','Other']
export const LEAD_STATUSES = [
  { value:'hold', label:'Hold' },
  { value:'followed_up', label:'Followed Up' },
  { value:'call_back', label:'Call Back' },
  { value:'scheduled', label:'Scheduled' },
  { value:'not_interested', label:'Not Interested' },
  { value:'ringing', label:'Ringing' },
  { value:'unreachable', label:'Unreachable' },
  { value:'busy', label:'Busy' },
  { value:'switched_off', label:'Switched Off' },
  { value:'wrong_number', label:'Wrong Number' },
  { value:'invalid', label:'Invalid' },
  { value:'rejected', label:'Rejected' },
]
export const NOT_CONNECTED_OPTIONS = [
  { value:'ringing', label:'Ringing' },
  { value:'unreachable', label:'Unreachable' },
  { value:'busy', label:'Busy' },
  { value:'switched_off', label:'Switched Off' },
  { value:'wrong_number', label:'Wrong Number' },
  { value:'invalid', label:'Invalid' },
  { value:'rejected', label:'Rejected' },
]

let _id = 100
const nid = () => ++_id

export function RecProvider({ children }) {
  const { token, user } = useUcs()

  const [candidates, setCandidates] = useState([
    { id:1, name:'Ananya Sharma', role:'Frontend Developer', stage:'Contacted', score:82, source:'LinkedIn', skills:['React','CSS','JS'], exp:'3 yr', salary:'₹10L', location:'Bangalore' },
    { id:2, name:'Rohit Verma', role:'Backend Engineer', stage:'Contacted', score:78, source:'Referral', skills:['Node','Python','SQL'], exp:'4 yr', salary:'₹12L', location:'Delhi' },
    { id:3, name:'Priya Patel', role:'UX Designer', stage:'Screening', score:91, source:'Job Portal', skills:['Figma','UI','Research'], exp:'5 yr', salary:'₹14L', location:'Mumbai' },
    { id:4, name:'Amit Kumar', role:'Full Stack Dev', stage:'Screening', score:74, source:'Walk-in', skills:['React','Node','Mongo'], exp:'2 yr', salary:'₹8L', location:'Pune' },
    { id:5, name:'Sneha Reddy', role:'DevOps Engineer', stage:'Interview Scheduled', score:88, source:'LinkedIn', skills:['Docker','AWS','CI/CD'], exp:'6 yr', salary:'₹18L', location:'Hyderabad' },
    { id:6, name:'Vikram Singh', role:'Data Analyst', stage:'Interview Scheduled', score:85, source:'Referral', skills:['Python','SQL','Excel'], exp:'3 yr', salary:'₹11L', location:'Bangalore' },
    { id:7, name:'Neha Joshi', role:'Product Manager', stage:'Selected', score:79, source:'Job Portal', skills:['Strategy','Agile','Analytics'], exp:'7 yr', salary:'₹22L', location:'Mumbai' },
    { id:8, name:'Arun Gupta', role:'QA Engineer', stage:'Offer Sent', score:72, source:'Walk-in', skills:['Selenium','JS','Testing'], exp:'4 yr', salary:'₹9L', location:'Noida' },
    { id:9, name:'Divya Nair', role:'Marketing Lead', stage:'Offer Sent', score:90, source:'LinkedIn', skills:['SEO','Content','Brand'], exp:'6 yr', salary:'₹16L', location:'Bangalore' },
    { id:10, name:'Karan Mehta', role:'iOS Developer', stage:'Rejected', score:83, source:'Referral', skills:['Swift','UIKit','Xcode'], exp:'5 yr', salary:'₹15L', location:'Chandigarh' },
    { id:11, name:'Sanya Gupta', role:'HR Coordinator', stage:'Screening', score:76, source:'Referral', skills:['HRMS','Payroll','Onboarding'], exp:'3 yr', salary:'₹7L', location:'Delhi' },
    { id:12, name:'Ravi Desai', role:'Cloud Architect', stage:'Interview Scheduled', score:93, source:'LinkedIn', skills:['AWS','Azure','GCP'], exp:'8 yr', salary:'₹28L', location:'Pune' },
    { id:13, name:'Meera Iyer', role:'Content Writer', stage:'Contacted', score:69, source:'Job Portal', skills:['SEO','Copy','WordPress'], exp:'2 yr', salary:'₹6L', location:'Remote' },
    { id:14, name:'Aditya Shah', role:'Data Engineer', stage:'Screening', score:87, source:'LinkedIn', skills:['Spark','Kafka','Hadoop'], exp:'5 yr', salary:'₹20L', location:'Hyderabad' },
    { id:15, name:'Pooja Malhotra', role:'Business Analyst', stage:'Selected', score:81, source:'Referral', skills:['SQL','Tableau','Jira'], exp:'4 yr', salary:'₹13L', location:'Bangalore' },
  ])
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
    const temp = { ...data, id: -Date.now(), created_at: new Date().toISOString() }
    setLeads(p => [temp, ...p])
    try {
      const res = await api('/leads', { method: 'POST', body: JSON.stringify(data), _prefix: 'ucs' })
      const realLead = res.lead || res
      const realId = realLead.id || res.id
      const merged = { ...realLead, ...data, id: realId }
      setLeads(p => {
        const withoutTemp = p.filter(l => l.id !== temp.id && l.id !== realId)
        return [merged, ...withoutTemp]
      })
    } catch (err) {
      console.error('addLead failed:', err?.message || err)
      setLeads(p => p.filter(l => l.id !== temp.id))
    }
    log(`Lead created — ${data.name}`)
  }, [log])

  const updateLead = useCallback(async (id, data) => {
    await api('/leads/' + id, { method: 'PUT', body: JSON.stringify(data), _prefix: 'ucs' })
    await fetchLeads(true)
    log(`Lead updated \u2014 ${id}`)
  }, [fetchLeads, log])

  const deleteLead = useCallback(async (id) => {
    try {
      await api('/leads/' + id, { method: 'DELETE', _prefix: 'ucs' })
    } catch (e) {
      // backend may return empty body on DELETE; proceed with local removal
    }
    setLeads(p => p.filter(l => l.id !== id))
    log(`Lead deleted \u2014 ${id}`)
  }, [log])

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
    fetchLeads, refreshLeads, addLead, updateLead, deleteLead, fetchLeadStats, updateLeadFilters,
    currentUser: user, user, STAGES,
  }), [candidates, jobs, feed, leads, leadsLoading, leadFilters, setLeadFilters, leadStats, user, STAGES])

  return <RecContext.Provider value={value}>{children}</RecContext.Provider>
}
