import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { AgeGate, hasVerifiedAge } from './components/AgeGate'
import { BottomNav } from './components/BottomNav'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { track } from './lib/api'
import { AuthPage } from './pages/AuthPage'
import { FeedPage } from './pages/FeedPage'
import { MapPage } from './pages/MapPage'
import { MessagesPage } from './pages/MessagesPage'
import { ProfilePage } from './pages/ProfilePage'
import { VerifyPage } from './pages/VerifyPage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminUserDetailPage } from './pages/admin/AdminUserDetailPage'
import { AdminUploadsPage } from './pages/admin/AdminUploadsPage'
import { AdminEventsPage } from './pages/admin/AdminEventsPage'
import { AdminReportsPage } from './pages/admin/AdminReportsPage'
import { AdminMessagesPage } from './pages/admin/AdminMessagesPage'

function RequirePaidAge({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="admin-loading">Loading…</div>
  if (!user) return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  if (!user.ageVerified && user.role !== 'admin') {
    return <Navigate to="/verify" replace />
  }
  return children
}

function AppRoutes() {
  const location = useLocation()
  const { user } = useAuth()
  const isAdminRoute = location.pathname.startsWith('/admin')
  const hideNav = isAdminRoute || location.pathname === '/verify' || location.pathname === '/auth'

  useEffect(() => {
    track('page_view', 'route', location.pathname, {
      authed: Boolean(user),
      ageVerified: Boolean(user?.ageVerified),
    })
  }, [location.pathname, user])

  return (
    <div className={isAdminRoute ? 'admin-app' : 'app-shell'}>
      <main className={isAdminRoute ? 'admin-main' : 'app-main'}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:id" element={<AdminUserDetailPage />} />
            <Route path="uploads" element={<AdminUploadsPage />} />
            <Route path="messages" element={<AdminMessagesPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="events" element={<AdminEventsPage />} />
          </Route>

          <Route
            path="/"
            element={
              <RequirePaidAge>
                <FeedPage />
              </RequirePaidAge>
            }
          />
          <Route
            path="/map"
            element={
              <RequirePaidAge>
                <MapPage />
              </RequirePaidAge>
            }
          />
          <Route
            path="/messages"
            element={
              <RequirePaidAge>
                <MessagesPage />
              </RequirePaidAge>
            }
          />
          <Route
            path="/profile"
            element={
              <RequirePaidAge>
                <ProfilePage />
              </RequirePaidAge>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideNav && <BottomNav />}
    </div>
  )
}

export default function App() {
  const [verified, setVerified] = useState(() => hasVerifiedAge())

  if (!verified) {
    return <AgeGate onVerified={() => setVerified(true)} />
  }

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
