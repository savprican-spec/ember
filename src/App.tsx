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
import { PremiumPage } from './pages/PremiumPage'
import { ProfilePage } from './pages/ProfilePage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminUserDetailPage } from './pages/admin/AdminUserDetailPage'
import { AdminUploadsPage } from './pages/admin/AdminUploadsPage'
import { AdminEventsPage } from './pages/admin/AdminEventsPage'
import { AdminReportsPage } from './pages/admin/AdminReportsPage'
import { AdminMessagesPage } from './pages/admin/AdminMessagesPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="admin-loading">Loading…</div>
  if (!user) return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  return children
}

function AppRoutes() {
  const location = useLocation()
  const { user } = useAuth()
  const isAdminRoute = location.pathname.startsWith('/admin')
  const hideNav =
    isAdminRoute || location.pathname === '/premium' || location.pathname === '/auth'

  useEffect(() => {
    track('page_view', 'route', location.pathname, {
      authed: Boolean(user),
      premium: Boolean(user?.premium),
    })
  }, [location.pathname, user])

  return (
    <div className={isAdminRoute ? 'admin-app' : 'app-shell'}>
      <main className={isAdminRoute ? 'admin-main' : 'app-main'}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/premium"
            element={
              <RequireAuth>
                <PremiumPage />
              </RequireAuth>
            }
          />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:id" element={<AdminUserDetailPage />} />
            <Route path="uploads" element={<AdminUploadsPage />} />
            <Route path="messages" element={<AdminMessagesPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="events" element={<AdminEventsPage />} />
          </Route>

          <Route path="/" element={<FeedPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route
            path="/messages"
            element={
              <RequireAuth>
                <MessagesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
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
