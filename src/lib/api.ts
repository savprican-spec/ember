export type EmberUser = {
  id: string
  email: string
  displayName: string
  handle: string
  age: number
  bio: string
  avatarUrl: string
  lookingFor: string
  mapVisible: boolean
  role: 'user' | 'admin'
  ageVerified: boolean
  ageVerifiedAt?: string | null
  birthdate?: string | null
  createdAt: string
  lastSeenAt: string
}

const TOKEN_KEY = 'ember-token'
const SESSION_KEY = 'ember-session-id'

export function getApiBase() {
  return (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || ''
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  headers.set('X-Session-Id', getSessionId())

  const res = await fetch(`${getApiBase()}${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
  }
  return data as T
}

export function mediaUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith('http')) return pathOrUrl
  const token = getToken()
  const base = `${getApiBase()}${pathOrUrl}`
  if (!token) return base
  const join = base.includes('?') ? '&' : '?'
  return `${base}${join}token=${encodeURIComponent(token)}`
}

export function track(eventType: string, targetType?: string, targetId?: string, meta?: Record<string, unknown>) {
  void api('/api/events', {
    method: 'POST',
    body: JSON.stringify({
      eventType,
      targetType,
      targetId,
      meta,
      sessionId: getSessionId(),
    }),
  }).catch(() => undefined)
}

export function formatMoney(cents: number, currency = 'usd') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}
