import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, Eye, EyeOff, Flame, MapPin, Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { LOOKING_HINTS, LOOKING_OPTIONS, type LookingOption } from '../data/looking'
import { api, mediaUrl, track, type ApiError } from '../lib/api'

type MineUpload = {
  id: string
  title: string
  visibility: string
  mediaType: string
  url: string
  createdAt: string
}

type FollowUser = {
  id: string
  displayName: string
  handle: string
  avatarUrl: string
}

export function ProfilePage() {
  const { user, logout, refresh } = useAuth()
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [looking, setLooking] = useState<LookingOption>('Right now')
  const [note, setNote] = useState('')
  const [uploads, setUploads] = useState<MineUpload[]>([])
  const [following, setFollowing] = useState<FollowUser[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')

  useEffect(() => {
    if (!user) return
    setVisible(user.mapVisible)
    setLooking((user.lookingFor as LookingOption) || 'Right now')
    setNote(user.lookingNote || '')
    api<{ uploads: MineUpload[] }>('/api/uploads/mine')
      .then((d) => setUploads(d.uploads))
      .catch(() => undefined)
    api<{ following: FollowUser[] }>('/api/follows/me')
      .then((d) => setFollowing(d.following))
      .catch(() => undefined)
    track('profile_view', 'user', user.id)
  }, [user])

  async function saveEncounter(nextVisible = visible, nextLooking = looking, nextNote = note) {
    if (!user?.premium) {
      navigate('/premium')
      return
    }
    try {
      await api('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({
          mapVisible: nextVisible,
          lookingFor: nextLooking,
          lookingNote: nextNote,
        }),
      })
      await refresh()
      setMessage(nextVisible ? 'Live for casual encounters nearby.' : 'Hidden from the encounter map.')
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr.code === 'PREMIUM_REQUIRED' || apiErr.status === 402) {
        setVisible(false)
        navigate('/premium')
        return
      }
      setMessage(apiErr.message || 'Could not save')
      setVisible(user.mapVisible)
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
          <p className="page-header__sub">Create a free basic profile to upload clips, message, and follow people.</p>
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
          <p className="profile-hero__bio">{user.bio || 'Free basic: feed, messages, follows. Premium is for live encounters.'}</p>
          <div className="tag-row">
            <span className="tag">nsfw</span>
            {user.premium && user.lookingFor ? <span className="tag">{user.lookingFor}</span> : null}
            <span className={`tag ${user.premium ? '' : 'muted'}`}>{user.premium ? 'Premium' : 'Basic'}</span>
          </div>
        </div>
      </section>

      <section className="profile-panel encounter-panel">
        <div className="page-header__row">
          <h3>
            <Flame size={16} style={{ marginRight: 6, verticalAlign: '-2px' }} />
            Casual encounters
          </h3>
          {!user.premium && (
            <Link className="ghost-chip" to="/premium">
              $9.99/mo
            </Link>
          )}
        </div>
        <p className="form-hint">Not dating — post what you want right now and appear nearby.</p>

        {user.premium ? (
          <>
            <div className="toggle-row">
              <div>
                <strong>Live on encounter map</strong>
                <p>Others nearby see your pin and what you’re looking for.</p>
              </div>
              <button
                type="button"
                className={`toggle ${visible ? 'is-on' : ''}`}
                aria-pressed={visible}
                onClick={() => {
                  const next = !visible
                  setVisible(next)
                  void saveEncounter(next, looking, note)
                }}
              >
                {visible ? <Eye size={16} /> : <EyeOff size={16} />}
                {visible ? 'Live' : 'Off'}
              </button>
            </div>

            <label className="field">
              <span>Looking for</span>
              <select
                value={looking}
                onChange={(e) => {
                  const next = e.target.value as LookingOption
                  setLooking(next)
                  void saveEncounter(visible, next, note)
                }}
              >
                {LOOKING_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <small className="form-hint">{LOOKING_HINTS[looking]}</small>
            </label>

            <label className="field">
              <span>Right now note</span>
              <textarea
                rows={2}
                maxLength={140}
                value={note}
                placeholder="Be direct about the meet…"
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => void saveEncounter(visible, looking, note)}
              />
            </label>
            <Link className="btn btn--primary" to="/map">
              Open map & post
            </Link>
          </>
        ) : (
          <div className="encounter-locked">
            <p>Premium unlocks posting “Right now,” hosting/cruising/car/hotel intent, and appearing on the map.</p>
            <Link className="btn btn--primary" to="/premium">
              Unlock encounters
            </Link>
          </div>
        )}

        <div className="stat-line">
          <MapPin size={16} />
          <span>{user.email}</span>
        </div>
        {message && <p className="form-hint">{message}</p>}
      </section>

      <section className="profile-panel">
        <div className="page-header__row">
          <h3>Following ({following.length})</h3>
        </div>
        {following.length === 0 ? (
          <p className="form-hint">Follow people from the feed or map — free on basic.</p>
        ) : (
          <ul className="admin-list">
            {following.map((f) => (
              <li key={f.id}>
                <strong>{f.displayName}</strong> <span>@{f.handle}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="profile-clips">
        <div className="page-header__row">
          <h3>Your clips</h3>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}>
            <option value="public">Upload as public</option>
            <option value="private">Upload as private</option>
          </select>
        </div>
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
