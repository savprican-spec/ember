import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
}

export function AdminUsersPage() {
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => {
      api<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`)
        .then((d) => setUsers(d.users))
        .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
    }, 200)
    return () => window.clearTimeout(t)
  }, [q])

  return (
    <div className="admin-page">
      <header>
        <h2>Users</h2>
        <p>Everyone who registered — open a profile to see all albums.</p>
      </header>
      <input
        className="admin-search"
        placeholder="Search email, handle, name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {error && <p className="form-error">{error}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
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
                <td>{u.uploadCount}</td>
                <td>{u.privateCount}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
