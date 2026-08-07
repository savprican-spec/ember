import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Eye, EyeOff, MapPin, Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api, mediaUrl, track } from '../lib/api'

type MineUpload = {
  id: string
  title: string
  visibility: string
  mediaType: string
  url: string
  createdAt: string
}

export function ProfilePage() {
  const { user, logout, refresh } = useAuth()
  const [visible, setVisible] = useState(true)
  const [looking, setLooking] = useState('Right now')
  const [uploads, setUploads] = useState<MineUpload[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')

  useEffect(() => {
    if (!user) return
    setVisible(user.mapVisible)
    setLooking(user.lookingFor || 'Tonight')
    api<{ uploads: MineUpload[] }>('/api/uploads/mine')
      .then((d) => setUploads(d.uploads))
      .catch(() => undefined)
    track('profile_view', 'user', user.id)
  }, [user])

  async function savePrefs(nextVisible = visible, nextLooking = looking) {
    if (!user) return
    try {
      await api('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ mapVisible: nextVisible, lookingFor: nextLooking }),
      })
      await refresh()
    } catch {
      /* ignore offline */
    }
  }

  async function onUpload(file: File) {
    if (!user) return
    setBusy(true)
    setMessage('')
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('title', file.name)
      body.append('visibility', visibility)
      body.append('caption', '')
      await api('/api/uploads', { method: 'POST', body })
      const mine = await api<{ uploads: MineUpload[] }>('/api/uploads/mine')
      setUploads(mine.uploads)
      setMessage(visibility === 'private' ? 'Saved to private album (admins can still review).' : 'Uploaded to public feed.')
      track('upload_success', 'upload', undefined, { visibility })
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <div className="profile-page">
        <header className="page-header">
          <p className="brand brand--sm">EMBER</p>
          <h1>You</h1>
          <p className="page-header__sub">Create an account to upload clips and show up nearby.</p>
        </header>
        <Link className="btn btn--primary" to="/auth" style={{ display: 'inline-block', textAlign: 'center' }}>
          Register / Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="profile-page">
      <header className="page-header">
        <p className="brand brand--sm">EMBER</p>
        <div className="page-header__row">
          <h1>You</h1>
          <div className="profile-actions">
            {user.role === 'admin' && (
              <Link to="/admin" className="ghost-chip">
                Admin
              </Link>
            )}
            <button type="button" className="icon-btn" aria-label="Sign out" onClick={logout}>
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      <section className="profile-hero">
        <div className="profile-hero__photo">
          <img
            src={
              user.avatarUrl ||
              'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&h=800&fit=crop'
            }
            alt="Your profile"
          />
          <button type="button" className="photo-fab" aria-label="Update photo">
            <Camera size={18} />
          </button>
        </div>
        <div className="profile-hero__info">
          <h2>
            {user.displayName}, {user.age}
          </h2>
          <p className="profile-hero__handle">@{user.handle}</p>
          <p className="profile-hero__bio">{user.bio || 'Add a bio from settings soon.'}</p>
          <div className="tag-row">
            <span className="tag">nsfw</span>
            <span className="tag">{user.lookingFor}</span>
          </div>
        </div>
      </section>

      <section className="profile-panel">
        <div className="toggle-row">
          <div>
            <strong>Visible on map</strong>
            <p>Others nearby can find you for casual meetups.</p>
          </div>
          <button
            type="button"
            className={`toggle ${visible ? 'is-on' : ''}`}
            aria-pressed={visible}
            onClick={() => {
              const next = !visible
              setVisible(next)
              void savePrefs(next, looking)
            }}
          >
            {visible ? <Eye size={16} /> : <EyeOff size={16} />}
            {visible ? 'On' : 'Off'}
          </button>
        </div>

        <label className="field">
          <span>Looking for</span>
          <select
            value={looking}
            onChange={(e) => {
              setLooking(e.target.value)
              void savePrefs(visible, e.target.value)
            }}
          >
            <option>Right now</option>
            <option>Hosting</option>
            <option>Traveling</option>
            <option>Car</option>
            <option>Tonight</option>
          </select>
        </label>

        <div className="stat-line">
          <MapPin size={16} />
          <span>{user.email}</span>
        </div>
      </section>

      <section className="profile-clips">
        <div className="page-header__row">
          <h3>Your clips</h3>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}>
            <option value="public">Upload as public</option>
            <option value="private">Upload as private</option>
          </select>
        </div>
        {message && <p className="form-hint">{message}</p>}
        <div className="clip-grid">
          {uploads.map((u) => (
            <button key={u.id} type="button" className="clip-tile">
              {u.mediaType === 'video' ? <video src={mediaUrl(u.url)} muted /> : <img src={mediaUrl(u.url)} alt="" />}
              <span>{u.visibility === 'private' ? 'Private' : '18+'}</span>
            </button>
          ))}
          <button
            type="button"
            className="clip-tile clip-tile--add"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? 'Uploading…' : '+ Upload clip'}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="video/*,image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void onUpload(file)
            e.target.value = ''
          }}
        />
      </section>
    </div>
  )
}
