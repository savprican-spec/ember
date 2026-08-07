import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const links = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/uploads', label: 'Uploads' },
  { to: '/admin/messages', label: 'Messages' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/events', label: 'Activity' },
] as const

export function AdminLayout() {
  const { user, loading, logout } = useAuth()

  if (loading) return <div className="admin-shell"><p className="admin-loading">Loading…</p></div>
  if (!user) return <Navigate to="/auth" replace />
  if (user.role !== 'admin') {
    return (
      <div className="admin-shell">
        <div className="admin-denied">
          <h1>Admin only</h1>
          <p>Sign in with the operator account to open the hub.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <div className="admin-nav__top">
          <div className="admin-nav__brand-row">
            <div>
              <p className="brand brand--sm">EMBER</p>
              <h1>Admin hub</h1>
            </div>
            <button type="button" className="btn btn--ghost admin-nav__logout-mobile" onClick={logout}>
              Sign out
            </button>
          </div>
          <p className="admin-nav__sub">Operator view — albums, inboxes, reports.</p>
        </div>
        <nav className="admin-nav__links" aria-label="Admin sections">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={'end' in link ? link.end : false}
              className={({ isActive }) =>
                isActive ? 'admin-nav__link is-active' : 'admin-nav__link'
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-nav__foot">
          <p className="admin-nav__user">{user.email}</p>
          <button type="button" className="btn btn--ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  )
}
