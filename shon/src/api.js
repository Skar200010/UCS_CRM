import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function setSession(email, readOnly) {
  localStorage.setItem('shon_user', JSON.stringify({ email, readOnly }))
}

export function clearSession() {
  localStorage.removeItem('shon_user')
}

export function getUser() {
  try { const d = localStorage.getItem('shon_user'); return d ? JSON.parse(d) : null }
  catch { return null }
}

export async function fetchAttendance() {
  const { data, error } = await supabase
    .from('attendance')
    .select('*, workers(name, login_id, email, department)')
    .order('date', { ascending: false })
  if (error) throw error
  for (const r of data || []) {
    if (r.punch_in_time && r.punch_out_time) {
      const pi = new Date(r.punch_in_time).getTime()
      const po = new Date(r.punch_out_time).getTime()
      const diffMs = po - pi
      const hours = Math.floor(diffMs / 3600000)
      const minutes = Math.floor((diffMs % 3600000) / 60000)
      r.hours_worked = `${hours}h ${minutes}m`
    } else {
      r.hours_worked = null
    }
  }
  return data || []
}

export async function fetchWorkers() {
  const { data, error } = await supabase
    .from('workers')
    .select('id, name, email, login_id, department')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
