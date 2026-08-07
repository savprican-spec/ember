import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, mediaUrl } from '../../lib/api'

type Detail = {
  user: {
    id: string
    displayName: string
    handle: string
    email: string
    age: number
    bio: string
    lookingFor: string
    mapVisible: boolean
    premium?: boolean
    premiumUntil?: string | null
    birthdate?: string
    createdAt: string
    lastSeenAt: string
  }
  followingCount?: number
  followerCount?: number
  uploads: Array<{
    id: string
    title: string
    caption: string
    visibility: string
    mediaType: string
    url: string
    createdAt: string
  }>
  events: Array<{ id: string; eventType: string; createdAt: string; meta: Record<string, unknown> }>
  verifications?: Array<{
    id: string
    status: string
    amountCents: number
    currency: string
    provider: string
    birthdate?: string
    createdAt: string
    completedAt?: string
  }>
  conversations?: Array<{ id: string; updatedAt: string; messageCount: number; preview: string }>
  reportsAbout?: Array<{
    id: string
    reason: string
    status: string
    reporterName: string
    reporterHandle: string
    createdAt: string
  }>
  note: string
}

export function AdminUserDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState<Detail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    api<Detail>(`/api/admin/users/${id}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [id])

  if (error) return <p className="form-error">{error}</p>
  if (!data) return <p className="admin-loading">Loading profile…</p>

  const { user, uploads, events } = data

  return (
    <div className="admin-page">
      <p>
        <Link to="/admin/users">← Users</Link>
      </p>
      <header>
        <h2>
          {user.displayName} <span>@{user.handle}</span>
        </h2>
        <p>{data.note}</p>
      </header>

      <div className="admin-profile-meta">
        <div><span>Email</span><strong>{user.email}</strong></div>
        <div><span>Age</span><strong>{user.age}</strong></div>
        <div><span>Birthdate</span><strong>{user.birthdate || '—'}</strong></div>
        <div><span>Plan</span><strong>{user.premium ? 'Premium' : 'Basic'}</strong></div>
        <div><span>Premium until</span><strong>{user.premiumUntil ? new Date(user.premiumUntil).toLocaleString() : '—'}</strong></div>
        <div><span>Looking</span><strong>{user.lookingFor}</strong></div>
        <div><span>Map</span><strong>{user.mapVisible ? 'Visible' : 'Hidden'}</strong></div>
        <div><span>Following</span><strong>{data.followingCount ?? 0}</strong></div>
        <div><span>Followers</span><strong>{data.followerCount ?? 0}</strong></div>
        <div><span>Joined</span><strong>{new Date(user.createdAt).toLocaleString()}</strong></div>
        <div><span>Last seen</span><strong>{new Date(user.lastSeenAt).toLocaleString()}</strong></div>
      </div>
      {user.bio && <p className="admin-bio">{user.bio}</p>}

      <h3>Legacy verification records</h3>
      <ul className="admin-list">
        {(data.verifications || []).map((v) => (
          <li key={v.id}>
            <strong>{v.status}</strong> · {(v.amountCents / 100).toFixed(2)} {v.currency} · {v.provider}
            <span>DOB {v.birthdate || '—'}</span>
            <time>{new Date(v.completedAt || v.createdAt).toLocaleString()}</time>
          </li>
        ))}
        {(data.verifications || []).length === 0 && <li className="muted">No legacy verification rows.</li>}
      </ul>

      <h3>Inbox threads ({(data.conversations || []).length})</h3>
      <ul className="admin-list">
        {(data.conversations || []).map((c) => (
          <li key={c.id}>
            <Link to={`/admin/messages?c=${c.id}`}>
              <strong>{c.messageCount} messages</strong>
              <span>{c.preview || 'No preview'}</span>
              <time>{new Date(c.updatedAt).toLocaleString()}</time>
            </Link>
          </li>
        ))}
        {(data.conversations || []).length === 0 && <li className="muted">No conversations.</li>}
      </ul>

      <h3>Reports about this user</h3>
      <ul className="admin-list">
        {(data.reportsAbout || []).map((r) => (
          <li key={r.id}>
            <Link to={`/admin/reports?status=${encodeURIComponent(r.status || 'all')}`}>
              <strong>{r.reason}</strong> · {r.status}
              <span>
                by @{r.reporterHandle} ({r.reporterName})
              </span>
              <time>{new Date(r.createdAt).toLocaleString()}</time>
            </Link>
          </li>
        ))}
        {(data.reportsAbout || []).length === 0 && <li className="muted">No reports against this user.</li>}
      </ul>

      <h3>All uploads ({uploads.length})</h3>
      <div className="admin-media-grid">
        {uploads.map((u) => (
          <article key={u.id} className="admin-media-card">
            {u.mediaType === 'video' ? (
              <video src={mediaUrl(u.url)} controls playsInline />
            ) : (
              <img src={mediaUrl(u.url)} alt="" />
            )}
            <div>
              <strong>{u.title || 'Untitled'}</strong>
              <span className={`vis vis--${u.visibility}`}>{u.visibility}</span>
              <p>{u.caption}</p>
              <time>{new Date(u.createdAt).toLocaleString()}</time>
            </div>
          </article>
        ))}
        {uploads.length === 0 && <p className="muted">No uploads.</p>}
      </div>

      <h3>Recent activity</h3>
      <ul className="admin-list">
        {events.map((e) => (
          <li key={e.id}>
            <strong>{e.eventType}</strong>
            <time>{new Date(e.createdAt).toLocaleString()}</time>
          </li>
        ))}
      </ul>
    </div>
  )
}
