import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

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
        <p className="brand brand--sm">EMBER</p>
        <h1>Admin hub</h1>
        <p className="admin-nav__sub">Full operator view — private albums, inboxes, reports. Nothing hidden.</p>
        <nav>
          <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Overview
          </NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => (isActive ? 'active' : '')}>
            Users
          </NavLink>
          <NavLink to="/admin/uploads" className={({ isActive }) => (isActive ? 'active' : '')}>
            Uploads
          </NavLink>
          <NavLink to="/admin/messages" className={({ isActive }) => (isActive ? 'active' : '')}>
            Messages
          </NavLink>
          <NavLink to="/admin/reports" className={({ isActive }) => (isActive ? 'active' : '')}>
            Reports
          </NavLink>
          <NavLink to="/admin/events" className={({ isActive }) => (isActive ? 'active' : '')}>
            Activity
          </NavLink>
        </nav>
        <button type="button" className="btn btn--ghost" onClick={logout}>
          Sign out
        </button>
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  )
}
