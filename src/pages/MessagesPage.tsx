import { useEffect, useState } from 'react'
import { ArrowLeft, Flag, Send } from 'lucide-react'
import { api, track } from '../lib/api'

type InboxItem = {
  id: string
  preview: string
  lastMessageAt: string
  unread: number
  peer: { id: string; displayName: string; handle: string; avatarUrl: string; online: boolean } | null
}

type ThreadMessage = {
  id: string
  body: string
  createdAt: string
  fromMe: boolean
  senderHandle?: string
}

export function MessagesPage() {
  const [threads, setThreads] = useState<InboxItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [peer, setPeer] = useState<InboxItem['peer']>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [draft, setDraft] = useState('')
  const [handle, setHandle] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadInbox() {
    const data = await api<{ conversations: InboxItem[] }>('/api/messages/inbox')
    setThreads(data.conversations)
  }

  useEffect(() => {
    loadInbox().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load inbox'))
    track('inbox_view')
  }, [])

  async function openThread(id: string) {
    setBusy(true)
    setError('')
    try {
      const data = await api<{
        id: string
        peer: InboxItem['peer']
        messages: ThreadMessage[]
      }>(`/api/messages/${id}`)
      setActiveId(data.id)
      setPeer(data.peer)
      setMessages(data.messages)
      await loadInbox()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open chat')
    } finally {
      setBusy(false)
    }
  }

  async function startChat() {
    if (!handle.trim()) return
    setBusy(true)
    setError('')
    try {
      const data = await api<{ conversationId: string }>('/api/messages/start', {
        method: 'POST',
        body: JSON.stringify({ handle: handle.trim() }),
      })
      setHandle('')
      await openThread(data.conversationId)
      await loadInbox()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start chat')
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    if (!activeId || !draft.trim()) return
    const text = draft.trim()
    setDraft('')
    try {
      const data = await api<{ message: ThreadMessage }>(`/api/messages/${activeId}`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      })
      setMessages((list) => [...list, data.message])
      await loadInbox()
      track('message_send', 'conversation', activeId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed')
      setDraft(text)
    }
  }

  async function reportPeer() {
    if (!peer) return
    const reason = window.prompt('Report reason: spam, harassment, underage_suspicion, nonconsensual, scam, illegal, other', 'harassment')
    if (!reason) return
    try {
      await api('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'user',
          targetId: peer.id,
          reason,
          details: `Reported from inbox conversation ${activeId}`,
        }),
      })
      window.alert('Report sent to Ember admin.')
      track('report_create', 'user', peer.id)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Report failed')
    }
  }

  if (activeId && peer) {
    return (
      <div className="messages-page messages-page--thread">
        <header className="thread-header">
          <button type="button" className="icon-btn" onClick={() => setActiveId(null)} aria-label="Back">
            <ArrowLeft size={22} />
          </button>
          <img
            src={peer.avatarUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop'}
            alt=""
            className="avatar"
          />
          <div style={{ flex: 1 }}>
            <strong>{peer.displayName}</strong>
            <p>{peer.online ? 'Online now' : `@${peer.handle}`}</p>
          </div>
          <button type="button" className="icon-btn" onClick={() => void reportPeer()} aria-label="Report user">
            <Flag size={18} />
          </button>
        </header>
        <div className="thread-body">
          {messages.map((m) => (
            <div key={m.id} className={`bubble bubble--${m.fromMe ? 'me' : 'them'}`}>
              <p>{m.body}</p>
              <span>{new Date(m.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {!messages.length && <p className="muted">No messages yet. Say something direct.</p>}
        </div>
        {error && <p className="form-error" style={{ padding: '0 1rem' }}>{error}</p>}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Keep it direct…"
            aria-label="Message"
          />
          <button type="submit" className="icon-btn icon-btn--ember" aria-label="Send" disabled={!draft.trim() || busy}>
            <Send size={18} />
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="messages-page">
      <header className="page-header">
        <p className="brand brand--sm">EMBER</p>
        <h1>Inbox</h1>
        <p className="page-header__sub">Direct, discreet — admins can review for safety.</p>
      </header>

      <form
        className="start-chat"
        onSubmit={(e) => {
          e.preventDefault()
          void startChat()
        }}
      >
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="Message @handle"
          aria-label="Start chat by handle"
        />
        <button type="submit" className="btn btn--primary" disabled={busy || !handle.trim()}>
          Start
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      <ul className="inbox-list">
        {threads.map((c) => (
          <li key={c.id}>
            <button type="button" className="inbox-row" onClick={() => void openThread(c.id)}>
              <span className={`avatar-wrap ${c.peer?.online ? 'is-online' : ''}`}>
                <img
                  src={
                    c.peer?.avatarUrl ||
                    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop'
                  }
                  alt=""
                  className="avatar avatar--lg"
                />
              </span>
              <span className="inbox-row__body">
                <span className="inbox-row__top">
                  <strong>{c.peer?.displayName || 'Unknown'}</strong>
                  <time>{new Date(c.lastMessageAt).toLocaleDateString()}</time>
                </span>
                <span className="inbox-row__preview">{c.preview || 'No messages yet'}</span>
              </span>
              {c.unread > 0 && <span className="unread">{c.unread}</span>}
            </button>
          </li>
        ))}
        {!threads.length && <li className="muted">No conversations yet. Start one with a handle above.</li>}
      </ul>
    </div>
  )
}
