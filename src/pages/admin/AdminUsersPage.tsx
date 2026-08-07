import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'

type AdminUser = {
  id: string
  displayName: string
  handle: string
  email: string
  age: number
  createdAt: string
  lastSeenAt: string
  uploadCount: number
  privateCount: number
  publicCount: number
  premium?: boolean
  mapVisible?: boolean
}

export function AdminUsersPage() {
  const [params, setParams] = useSearchParams()
  const plan = params.get('plan') || 'all'
  const map = params.get('map') || 'all'
  const [q, setQ] = useState(params.get('q') || '')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => {
      const qs = new URLSearchParams({
        q,
        plan,
        map,
      })
      api<{ users: AdminUser[] }>(`/api/admin/users?${qs}`)
        .then((d) => setUsers(d.users))
        .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
    }, 200)
    return () => window.clearTimeout(t)
  }, [q, plan, map])

  function setFilter(key: 'plan' | 'map', value: string) {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next)
  }

  return (
    <div className="admin-page">
      <header>
        <h2>Users</h2>
        <p>Everyone who registered — open a profile to see albums, threads, and reports.</p>
      </header>
      <input
        className="admin-search"
        placeholder="Search email, handle, name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="filter-row" aria-label="Plan filter">
        {[
          ['all', 'All plans'],
          ['premium', 'Premium'],
          ['basic', 'Basic'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`filter-chip ${plan === value ? 'is-active' : ''}`}
            onClick={() => setFilter('plan', value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="filter-row" aria-label="Map filter">
        {[
          ['all', 'Map: all'],
          ['visible', 'On map'],
          ['hidden', 'Hidden'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`filter-chip ${map === value ? 'is-active' : ''}`}
            onClick={() => setFilter('map', value)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Map</th>
              <th>Uploads</th>
              <th>Private</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link to={`/admin/users/${u.id}`}>
                    {u.displayName} <span>@{u.handle}</span>
                  </Link>
                  {u.premium ? <span className="vis vis--verified">premium</span> : <span className="vis">basic</span>}
                </td>
                <td>{u.email}</td>
                <td>{u.mapVisible ? 'Live' : 'Off'}</td>
                <td>{u.uploadCount}</td>
                <td>{u.privateCount}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {!users.length && (
              <tr>
                <td colSpan={6} className="muted">
                  No users match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
