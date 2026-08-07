import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'

type Conversation = {
  id: string
  updatedAt: string
  messageCount: number
  preview: string
  lastMessageAt: string
  members: Array<{ id: string; displayName: string; handle: string; email: string }>
}

type Thread = {
  id: string
  members: Array<{ id: string; displayName: string; handle: string; email: string }>
  messages: Array<{
    id: string
    body: string
    createdAt: string
    senderId: string
    senderName: string
    senderHandle: string
    senderEmail: string
  }>
}

export function AdminMessagesPage() {
  const [params, setParams] = useSearchParams()
  const conversationId = params.get('c')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [active, setActive] = useState<Thread | null>(null)
  const [error, setError] = useState('')
  const [loadingThread, setLoadingThread] = useState(false)

  useEffect(() => {
    api<{ conversations: Conversation[] }>('/api/admin/messages')
      .then((d) => setConversations(d.conversations))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [])

  useEffect(() => {
    if (!conversationId) {
      setActive(null)
      return
    }
    setLoadingThread(true)
    api<Thread>(`/api/admin/messages/${conversationId}`)
      .then(setActive)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to open thread'))
      .finally(() => setLoadingThread(false))
  }, [conversationId])

  function openThread(id: string) {
    const next = new URLSearchParams(params)
    next.set('c', id)
    setParams(next)
  }

  function closeThread() {
    const next = new URLSearchParams(params)
    next.delete('c')
    setParams(next)
    setActive(null)
  }

  if (conversationId) {
    return (
      <div className="admin-page">
        <p>
          <button type="button" className="linkish" onClick={closeThread}>
            ← All conversations
          </button>
        </p>
        {loadingThread && <p className="admin-loading">Loading thread…</p>}
        {error && <p className="form-error">{error}</p>}
        {active && (
          <>
            <header>
              <h2>Conversation</h2>
              <p>
                {active.members.map((m) => (
                  <span key={m.id}>
                    <Link to={`/admin/users/${m.id}`}>
                      {m.displayName} @{m.handle}
                    </Link>{' '}
                  </span>
                ))}
              </p>
            </header>
            <div className="admin-thread">
              {active.messages.map((m) => (
                <article key={m.id} className="admin-thread__msg">
                  <header>
                    <strong>
                      <Link to={`/admin/users/${m.senderId}`}>
                        {m.senderName} @{m.senderHandle}
                      </Link>
                    </strong>
                    <time>{new Date(m.createdAt).toLocaleString()}</time>
                  </header>
                  <p>{m.body}</p>
                  <span className="muted">{m.senderEmail}</span>
                </article>
              ))}
              {!active.messages.length && <p className="muted">Empty thread.</p>}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="admin-page">
      <header>
        <h2>All inboxes</h2>
        <p>Full message visibility — tap a conversation to open the full thread.</p>
      </header>
      {error && <p className="form-error">{error}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Members</th>
              <th>Preview</th>
              <th>Msgs</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((c) => (
              <tr key={c.id}>
                <td>
                  <button type="button" className="linkish" onClick={() => openThread(c.id)}>
                    {c.members.map((m) => `@${m.handle}`).join(' · ') || 'Untitled chat'}
                  </button>
                </td>
                <td>
                  <button type="button" className="linkish" onClick={() => openThread(c.id)}>
                    {c.preview || '—'}
                  </button>
                </td>
                <td>{c.messageCount}</td>
                <td>{new Date(c.lastMessageAt).toLocaleString()}</td>
              </tr>
            ))}
            {!conversations.length && (
              <tr>
                <td colSpan={4} className="muted">
                  No conversations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
