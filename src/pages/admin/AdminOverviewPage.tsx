import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, mediaUrl } from '../../lib/api'

type Overview = {
  stats: {
    users: number
    premiumUsers?: number
    mapVisibleUsers?: number
    uploads: number
    privateUploads: number
    events24h: number
    premiumMrrCents?: number
    openReports?: number
    messages?: number
    conversations?: number
    follows?: number
  }
  recentUsers: Array<{
    id: string
    displayName: string
    handle: string
    email: string
    createdAt: string
    premium?: boolean
  }>
  recentUploads: Array<{
    id: string
    title: string
    visibility: string
    mediaType: string
    url: string
    displayName: string
    handle: string
    createdAt: string
  }>
  recentReports?: Array<{
    id: string
    reason: string
    status: string
    targetType: string
    reporterName: string
    reporterHandle: string
    createdAt: string
  }>
  topEvents: Array<{ type: string; count: number }>
  note?: string
}

export function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Overview>('/api/admin/overview')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  if (error) return <p className="form-error">{error}</p>
  if (!data) return <p className="admin-loading">Loading overview…</p>

  return (
    <div className="admin-page">
      <header>
        <h2>Ember control hub</h2>
        <p>{data.note || 'Everything on the platform — users, media, inboxes, reports.'}</p>
      </header>

      <div className="admin-stats">
        <div>
          <strong>{data.stats.users}</strong>
          <span>Users</span>
        </div>
        <div>
          <strong>{data.stats.premiumUsers ?? 0}</strong>
          <span>Premium</span>
        </div>
        <div>
          <strong>{data.stats.mapVisibleUsers ?? 0}</strong>
          <span>On map</span>
        </div>
        <div>
          <strong>{data.stats.uploads}</strong>
          <span>Uploads</span>
        </div>
        <div>
          <strong>{data.stats.privateUploads}</strong>
          <span>Private</span>
        </div>
        <div>
          <strong>{data.stats.follows ?? 0}</strong>
          <span>Follows</span>
        </div>
        <div>
          <strong>{data.stats.openReports ?? 0}</strong>
          <span>Open reports</span>
        </div>
        <div>
          <strong>{data.stats.conversations ?? 0}</strong>
          <span>Conversations</span>
        </div>
        <div>
          <strong>{data.stats.messages ?? 0}</strong>
          <span>Messages</span>
        </div>
        <div>
          <strong>{data.stats.events24h}</strong>
          <span>Events 24h</span>
        </div>
        <div>
          <strong>
            {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
              (data.stats.premiumMrrCents ?? 0) / 100,
            )}
          </strong>
          <span>Premium MRR</span>
        </div>
      </div>

      <div className="admin-grid">
        <section>
          <h3>Newest users</h3>
          <ul className="admin-list">
            {data.recentUsers.map((u) => (
              <li key={u.id}>
                <Link to={`/admin/users/${u.id}`}>
                  <strong>{u.displayName}</strong> @{u.handle}
                  {u.premium ? <span className="vis vis--verified">premium</span> : <span className="vis">basic</span>}
                  <span>{u.email}</span>
                  <time>{new Date(u.createdAt).toLocaleString()}</time>
                </Link>
              </li>
            ))}
            {data.recentUsers.length === 0 && <li className="muted">No registrations yet.</li>}
          </ul>
        </section>

        <section>
          <h3>Latest uploads</h3>
          <ul className="admin-list">
            {data.recentUploads.map((u) => (
              <li key={u.id}>
                <Link to="/admin/uploads">
                  {u.mediaType === 'image' ? (
                    <img src={mediaUrl(u.url)} alt="" width={40} height={40} />
                  ) : (
                    <video src={mediaUrl(u.url)} muted width={40} height={40} />
                  )}
                  <strong>{u.title || 'Untitled'}</strong>
                  <span>
                    {u.displayName} · {u.visibility}
                  </span>
                  <time>{new Date(u.createdAt).toLocaleString()}</time>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
