import { api } from '../../../api/auth'

export async function login(email, password) {
  const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: email, password }), _prefix: 'ucs' })
  if (data.role !== 'accounts' && data.role !== 'super_admin') throw new Error('Access denied. Accounts or Admin account required.')
  return data
}

export function apiGet(path) { return api(path, { _prefix: 'ucs' }) }
export function apiPost(path, body) { return api(path, { method: 'POST', body: JSON.stringify(body), _prefix: 'ucs' }) }
export function apiPut(path, body) { return api(path, { method: 'PUT', body: JSON.stringify(body), _prefix: 'ucs' }) }
export function apiPatch(path, body) { return api(path, { method: 'PATCH', body: JSON.stringify(body), _prefix: 'ucs' }) }
