import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

type EventRow = {
  id: string
  displayName?: string
  handle?: string
  email?: string
  eventType: string
  targetType?: string
  targetId?: string
  createdAt: string
}

export function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ events: EventRow[] }>('/api/admin/events?limit=200')
      .then((d) => setEvents(d.events))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [])

  return (
    <div className="admin-page">
      <header>
        <h2>Activity</h2>
        <p>How people interact — likes, views, logins, uploads, map opens.</p>
      </header>
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
            {events.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.createdAt).toLocaleString()}</td>
                <td>{e.eventType}</td>
                <td>{e.handle ? `@${e.handle}` : e.email || 'anon'}</td>
                <td>
                  {e.targetType || '—'} {e.targetId ? `· ${e.targetId.slice(0, 8)}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
