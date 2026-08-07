import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
  const [visibility, setVisibility] = useState('all')
  const [uploads, setUploads] = useState<Upload[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ uploads: Upload[] }>(`/api/admin/uploads?visibility=${visibility}`)
      .then((d) => setUploads(d.uploads))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [visibility])

  return (
    <div className="admin-page">
      <header>
        <h2>All uploads</h2>
        <p>Every clip and photo of every kind — public, private, followers. Nothing hidden.</p>
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
          <article key={u.id} className="admin-media-card">
            {u.mediaType === 'video' ? (
              <video src={mediaUrl(u.url)} controls playsInline />
            ) : (
              <img src={mediaUrl(u.url)} alt="" />
            )}
            <div>
              <strong>{u.title || 'Untitled'}</strong>
              <span className={`vis vis--${u.visibility}`}>{u.visibility}</span>
              <p>
                <Link to={`/admin/users/${u.userId}`}>
                  {u.displayName} @{u.handle}
                </Link>
              </p>
              <p>{u.caption}</p>
              <time>{new Date(u.createdAt).toLocaleString()}</time>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
