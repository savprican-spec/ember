import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getToken, setToken, type EmberUser, track } from '../lib/api'

type AuthContextValue = {
  user: EmberUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<EmberUser>
  register: (input: {
    email: string
    password: string
    displayName: string
    handle: string
    age: number
  }) => Promise<EmberUser>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<EmberUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    if (!getToken()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const data = await api<{ user: EmberUser }>('/api/auth/me')
      setUser(data.user)
    } catch {
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function login(email: string, password: string) {
    const data = await api<{ token: string; user: EmberUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setToken(data.token)
    setUser(data.user)
    track('login', 'user', data.user.id)
    return data.user
  }

  async function register(input: {
    email: string
    password: string
    displayName: string
    handle: string
    age: number
  }) {
    const data = await api<{ token: string; user: EmberUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    setToken(data.token)
    setUser(data.user)
    track('register', 'user', data.user.id)
    return data.user
  }

  function logout() {
    setToken(null)
    setUser(null)
    track('logout')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth requires AuthProvider')
  return ctx
}
