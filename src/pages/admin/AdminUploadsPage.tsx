import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, mediaUrl } from '../../lib/api'

type Upload = {
  id: string
  userId: string
  title: string
  caption: string
  visibility: string
  mediaType: string
  url: string
  displayName: string
  handle: string
  email: string
  createdAt: string
}

export function AdminUploadsPage() {
  const [params, setParams] = useSearchParams()
  const visibility = params.get('visibility') || 'all'
  const [uploads, setUploads] = useState<Upload[]>([])
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    api<{ uploads: Upload[] }>(`/api/admin/uploads?visibility=${visibility}`)
      .then((d) => setUploads(d.uploads))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [visibility])

  function setVisibility(next: string) {
    const qs = new URLSearchParams(params)
    if (next === 'all') qs.delete('visibility')
    else qs.set('visibility', next)
    setParams(qs)
  }

  const active = uploads.find((u) => u.id === activeId) || null

  return (
    <div className="admin-page">
      <header>
        <h2>All uploads</h2>
        <p>Every clip and photo — public, private, followers. Tap a tile to open it full size.</p>
      </header>
      <div className="filter-row">
        {['all', 'public', 'private', 'followers'].map((v) => (
          <button
            key={v}
            type="button"
            className={`filter-chip ${visibility === v ? 'is-active' : ''}`}
            onClick={() => setVisibility(v)}
          >
            {v}
          </button>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="admin-media-grid">
        {uploads.map((u) => (
          <button
            key={u.id}
            type="button"
            className="admin-media-card admin-media-card--button"
            onClick={() => setActiveId(u.id)}
          >
            {u.mediaType === 'video' ? (
              <video src={mediaUrl(u.url)} muted playsInline />
            ) : (
              <img src={mediaUrl(u.url)} alt="" />
            )}
            <div>
              <strong>{u.title || 'Untitled'}</strong>
              <span className={`vis vis--${u.visibility}`}>{u.visibility}</span>
              <p>
                {u.displayName} @{u.handle}
              </p>
              <time>{new Date(u.createdAt).toLocaleString()}</time>
            </div>
          </button>
        ))}
        {!uploads.length && <p className="muted">No uploads in this filter.</p>}
      </div>

      {active && (
        <div className="admin-lightbox" role="dialog" aria-modal="true" aria-label="Upload detail">
          <button type="button" className="admin-lightbox__backdrop" aria-label="Dismiss overlay" onClick={() => setActiveId(null)} />
          <div className="admin-lightbox__panel">
            <header className="page-header__row">
              <h3>{active.title || 'Untitled'}</h3>
              <button type="button" className="btn btn--ghost" onClick={() => setActiveId(null)}>
                Close
              </button>
            </header>
            {active.mediaType === 'video' ? (
              <video src={mediaUrl(active.url)} controls playsInline autoPlay />
            ) : (
              <img src={mediaUrl(active.url)} alt="" />
            )}
            <p>
              <span className={`vis vis--${active.visibility}`}>{active.visibility}</span>{' '}
              <Link to={`/admin/users/${active.userId}`}>
                {active.displayName} @{active.handle}
              </Link>
            </p>
            <p className="muted">{active.email}</p>
            {active.caption ? <p>{active.caption}</p> : null}
            <time>{new Date(active.createdAt).toLocaleString()}</time>
          </div>
        </div>
      )}
    </div>
  )
}
