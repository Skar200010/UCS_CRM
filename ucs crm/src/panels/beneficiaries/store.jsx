import { useUcs } from '../../store'
import { api } from '../../api/auth'

export function useBeneficiaries() {
  const { user } = useUcs()
  return user
}

export async function apiGet(path) {
  const res = await api(path)
  return res
}

export async function apiPost(path, body) {
  const res = await api(path, { method: 'POST', body: JSON.stringify(body), _prefix: 'ucs' })
  return res
}

export async function apiPatch(path, body) {
  const res = await api(path, { method: 'PATCH', body: JSON.stringify(body), _prefix: 'ucs' })
  return res
}

export async function apiDelete(path) {
  const res = await api(path, { method: 'DELETE', _prefix: 'ucs' })
  return res
}
