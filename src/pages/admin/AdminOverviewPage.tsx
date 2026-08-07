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
    userId?: string
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

type StatTile = {
  label: string
  value: string | number
  to: string
  hint: string
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

  const tiles: StatTile[] = [
    {
      label: 'Users',
      value: data.stats.users,
      to: '/admin/users',
      hint: 'Open member directory',
    },
    {
      label: 'Premium',
      value: data.stats.premiumUsers ?? 0,
      to: '/admin/users?plan=premium',
      hint: 'Premium members only',
    },
    {
      label: 'On map',
      value: data.stats.mapVisibleUsers ?? 0,
      to: '/admin/users?map=visible',
      hint: 'Live on encounter map',
    },
    {
      label: 'Uploads',
      value: data.stats.uploads,
      to: '/admin/uploads',
      hint: 'All media library',
    },
    {
      label: 'Private',
      value: data.stats.privateUploads,
      to: '/admin/uploads?visibility=private',
      hint: 'Private albums',
    },
    {
      label: 'Follows',
      value: data.stats.follows ?? 0,
      to: '/admin/events?type=follow',
      hint: 'Follow activity',
    },
    {
      label: 'Open reports',
      value: data.stats.openReports ?? 0,
      to: '/admin/reports?status=open',
      hint: 'Needs moderation',
    },
    {
      label: 'Conversations',
      value: data.stats.conversations ?? 0,
      to: '/admin/messages',
      hint: 'Open all inboxes',
    },
    {
      label: 'Messages',
      value: data.stats.messages ?? 0,
      to: '/admin/messages',
      hint: 'Browse message threads',
    },
    {
      label: 'Events 24h',
      value: data.stats.events24h,
      to: '/admin/events',
      hint: 'Full activity feed',
    },
    {
      label: 'Premium MRR',
      value: new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
        (data.stats.premiumMrrCents ?? 0) / 100,
      ),
      to: '/admin/users?plan=premium',
      hint: 'Paying Premium members',
    },
  ]

  return (
    <div className="admin-page">
      <header>
        <h2>Ember control hub</h2>
        <p>{data.note || 'Everything on the platform — users, media, inboxes, reports.'}</p>
        <p className="form-hint">Tap any tile to open that section.</p>
      </header>

      <div className="admin-stats">
        {tiles.map((tile) => (
          <Link key={tile.label} to={tile.to} className="admin-stat-tile" title={tile.hint}>
            <strong>{tile.value}</strong>
            <span>{tile.label}</span>
            <em>{tile.hint}</em>
          </Link>
        ))}
      </div>

      <div className="admin-grid">
        <section>
          <div className="page-header__row">
            <h3>Newest users</h3>
            <Link className="ghost-chip" to="/admin/users">
              View all
            </Link>
          </div>
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
          <div className="page-header__row">
            <h3>Latest uploads</h3>
            <Link className="ghost-chip" to="/admin/uploads">
              View all
            </Link>
          </div>
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
            {data.recentUploads.length === 0 && <li className="muted">No uploads yet.</li>}
          </ul>
        </section>

        <section>
          <div className="page-header__row">
            <h3>Open reports</h3>
            <Link className="ghost-chip" to="/admin/reports?status=open">
              View all
            </Link>
          </div>
          <ul className="admin-list">
            {(data.recentReports || []).map((r) => (
              <li key={r.id}>
                <Link to={`/admin/reports?status=${encodeURIComponent(r.status || 'open')}&id=${encodeURIComponent(r.id)}`}>
                  <strong>{r.reason}</strong> · {r.status}
                  <span>
                    {r.targetType} · @{r.reporterHandle}
                  </span>
                  <time>{new Date(r.createdAt).toLocaleString()}</time>
                </Link>
              </li>
            ))}
            {(data.recentReports || []).length === 0 && <li className="muted">No recent reports.</li>}
          </ul>
        </section>

        <section>
          <div className="page-header__row">
            <h3>Top events (7d)</h3>
            <Link className="ghost-chip" to="/admin/events">
              Activity
            </Link>
          </div>
          <ul className="admin-list">
            {data.topEvents.map((e) => (
              <li key={e.type}>
                <Link to={`/admin/events?type=${encodeURIComponent(e.type)}`}>
                  <strong>{e.type}</strong>
                  <span>{e.count} events</span>
                </Link>
              </li>
            ))}
            {data.topEvents.length === 0 && <li className="muted">No events yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  )
}
