import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AgeGate, hasVerifiedAge } from './components/AgeGate'
import { BottomNav } from './components/BottomNav'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { track } from './lib/api'
import { AuthPage } from './pages/AuthPage'
import { FeedPage } from './pages/FeedPage'
import { MapPage } from './pages/MapPage'
import { MessagesPage } from './pages/MessagesPage'
import { ProfilePage } from './pages/ProfilePage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminUserDetailPage } from './pages/admin/AdminUserDetailPage'
import { AdminUploadsPage } from './pages/admin/AdminUploadsPage'
import { AdminEventsPage } from './pages/admin/AdminEventsPage'

function AppRoutes() {
  const location = useLocation()
  const { user } = useAuth()
  const isAdminRoute = location.pathname.startsWith('/admin')

  useEffect(() => {
    track('page_view', 'route', location.pathname, { authed: Boolean(user) })
  }, [location.pathname, user])

  return (
    <div className={isAdminRoute ? 'admin-app' : 'app-shell'}>
      <main className={isAdminRoute ? 'admin-main' : 'app-main'}>
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:id" element={<AdminUserDetailPage />} />
            <Route path="uploads" element={<AdminUploadsPage />} />
            <Route path="events" element={<AdminEventsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isAdminRoute && <BottomNav />}
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
