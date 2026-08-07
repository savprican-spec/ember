import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'

type EventRow = {
  id: string
  userId?: string
  displayName?: string
  handle?: string
  email?: string
  eventType: string
  targetType?: string
  targetId?: string
  createdAt: string
}

export function AdminEventsPage() {
  const [params, setParams] = useSearchParams()
  const typeFilter = params.get('type') || 'all'
  const [events, setEvents] = useState<EventRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ events: EventRow[] }>('/api/admin/events?limit=300')
      .then((d) => setEvents(d.events))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [])

  const types = useMemo(() => {
    const set = new Set(events.map((e) => e.eventType))
    return ['all', ...Array.from(set).sort()]
  }, [events])

  const filtered = typeFilter === 'all' ? events : events.filter((e) => e.eventType === typeFilter)

  function setType(next: string) {
    const qs = new URLSearchParams(params)
    if (next === 'all') qs.delete('type')
    else qs.set('type', next)
    setParams(qs)
  }

  return (
    <div className="admin-page">
      <header>
        <h2>Activity</h2>
        <p>How people interact — likes, views, logins, uploads, map opens, meetups. Filter by event type.</p>
      </header>
      <div className="filter-row">
        {types.slice(0, 16).map((t) => (
          <button
            key={t}
            type="button"
            className={`filter-chip ${typeFilter === t ? 'is-active' : ''}`}
            onClick={() => setType(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Event</th>
              <th>Who</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.createdAt).toLocaleString()}</td>
                <td>
                  <button type="button" className="linkish" onClick={() => setType(e.eventType)}>
                    {e.eventType}
                  </button>
                </td>
                <td>
                  {e.userId ? (
                    <Link to={`/admin/users/${e.userId}`}>{e.handle ? `@${e.handle}` : e.email || e.userId}</Link>
                  ) : (
                    e.handle ? `@${e.handle}` : e.email || 'anon'
                  )}
                </td>
                <td>
                  {e.targetType === 'user' && e.targetId ? (
                    <Link to={`/admin/users/${e.targetId}`}>
                      user · {e.targetId.slice(0, 8)}
                    </Link>
                  ) : e.targetType === 'upload' ? (
                    <Link to="/admin/uploads">
                      upload · {e.targetId?.slice(0, 8) || '—'}
                    </Link>
                  ) : e.targetType === 'conversation' && e.targetId ? (
                    <Link to={`/admin/messages?c=${e.targetId}`}>
                      conversation · {e.targetId.slice(0, 8)}
                    </Link>
                  ) : (
                    <>
                      {e.targetType || '—'} {e.targetId ? `· ${e.targetId.slice(0, 8)}` : ''}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={4} className="muted">
                  No events in this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
