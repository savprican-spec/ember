import { Navigate, Route, Routes } from 'react-router-dom'
import { useState } from 'react'
import { AgeGate, hasVerifiedAge } from './components/AgeGate'
import { BottomNav } from './components/BottomNav'
import { FeedPage } from './pages/FeedPage'
import { MapPage } from './pages/MapPage'
import { MessagesPage } from './pages/MessagesPage'
import { ProfilePage } from './pages/ProfilePage'

export default function App() {
  const [verified, setVerified] = useState(() => hasVerifiedAge())

  if (!verified) {
    return <AgeGate onVerified={() => setVerified(true)} />
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
