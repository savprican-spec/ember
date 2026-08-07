import { useEffect, useState } from 'react'
import { ArrowLeft, Flag, MapPin, Send } from 'lucide-react'
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

type Meetup = {
  id: string
  conversationId: string
  status: string
  role: 'proposer' | 'recipient'
  exactShared: boolean
  waitingOnYou: boolean
  waitingOnThem: boolean
  myExact: { lat: number; lng: number; mapsUrl: string } | null
  theirExact: { lat: number; lng: number; mapsUrl: string } | null
}

async function readDeviceLocation(): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    )
  })
}

export function MessagesPage() {
  const [threads, setThreads] = useState<InboxItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [peer, setPeer] = useState<InboxItem['peer']>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [meetup, setMeetup] = useState<Meetup | null>(null)
  const [draft, setDraft] = useState('')
  const [handle, setHandle] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [meetupBusy, setMeetupBusy] = useState(false)

  async function loadInbox() {
    const data = await api<{ conversations: InboxItem[] }>('/api/messages/inbox')
    setThreads(data.conversations)
  }

  async function loadMeetup(conversationId: string) {
    const data = await api<{ meetup: Meetup | null }>(`/api/meetups/conversation/${conversationId}`)
    setMeetup(data.meetup)
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
      await loadMeetup(data.id)
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

  async function proposeMeetup() {
    if (!activeId) return
    setMeetupBusy(true)
    setError('')
    try {
      const loc = await readDeviceLocation()
      const data = await api<{ meetup: Meetup }>('/api/meetups/propose', {
        method: 'POST',
        body: JSON.stringify({ conversationId: activeId, ...(loc || {}) }),
      })
      setMeetup(data.meetup)
      await openThread(activeId)
      track('meetup_propose', 'conversation', activeId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not propose meetup')
    } finally {
      setMeetupBusy(false)
    }
  }

  async function acceptMeetup() {
    if (!meetup) return
    setMeetupBusy(true)
    setError('')
    try {
      const loc = await readDeviceLocation()
      const data = await api<{ meetup: Meetup }>(`/api/meetups/${meetup.id}/accept`, {
        method: 'POST',
        body: JSON.stringify(loc || {}),
      })
      setMeetup(data.meetup)
      if (activeId) await openThread(activeId)
      track('meetup_accept', 'meetup', meetup.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept meetup')
    } finally {
      setMeetupBusy(false)
    }
  }

  async function declineMeetup() {
    if (!meetup || !activeId) return
    setMeetupBusy(true)
    setError('')
    try {
      await api<{ meetup: Meetup }>(`/api/meetups/${meetup.id}/decline`, { method: 'POST' })
      await openThread(activeId)
      track('meetup_decline', 'meetup', meetup.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not decline')
    } finally {
      setMeetupBusy(false)
    }
  }

  async function reportPeer() {
    if (!peer) return
    const reason = window.prompt(
      'Report reason: spam, harassment, underage_suspicion, nonconsensual, scam, illegal, other',
      'harassment',
    )
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

        <section className="meetup-bar">
          {!meetup || (meetup.status !== 'pending' && meetup.status !== 'accepted') ? (
            <>
              <p>Map pins stay approximate. Exact location unlocks only if you both agree to meet.</p>
              <button
                type="button"
                className="btn btn--primary"
                disabled={meetupBusy}
                onClick={() => void proposeMeetup()}
              >
                <MapPin size={16} />
                {meetupBusy ? 'Proposing…' : 'Propose meetup'}
              </button>
            </>
          ) : null}

          {meetup?.status === 'pending' && meetup.waitingOnThem ? (
            <>
              <p>Waiting for {peer.displayName} to accept. Exact location stays private until then.</p>
              <button type="button" className="btn btn--ghost" disabled={meetupBusy} onClick={() => void declineMeetup()}>
                Cancel request
              </button>
            </>
          ) : null}

          {meetup?.status === 'pending' && meetup.waitingOnYou ? (
            <>
              <p>{peer.displayName} wants to meet. Accept to share exact locations with each other.</p>
              <div className="meetup-bar__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={meetupBusy}
                  onClick={() => void acceptMeetup()}
                >
                  Accept & share exact
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={meetupBusy}
                  onClick={() => void declineMeetup()}
                >
                  Decline
                </button>
              </div>
            </>
          ) : null}

          {meetup?.status === 'accepted' && meetup.exactShared ? (
            <div className="meetup-exact">
              <p>
                <strong>Meetup agreed.</strong> Exact locations unlocked for this chat only.
              </p>
              {meetup.theirExact ? (
                <a className="ghost-chip" href={meetup.theirExact.mapsUrl} target="_blank" rel="noreferrer">
                  <MapPin size={14} />
                  Their exact pin
                </a>
              ) : null}
              {meetup.myExact ? (
                <a className="ghost-chip" href={meetup.myExact.mapsUrl} target="_blank" rel="noreferrer">
                  <MapPin size={14} />
                  Your shared pin
                </a>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="thread-body">
          {messages.map((m) => (
            <div key={m.id} className={`bubble bubble--${m.fromMe ? 'me' : 'them'}`}>
              <p>{m.body}</p>
              <span>{new Date(m.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {!messages.length && <p className="muted">No messages yet. Say something direct.</p>}
        </div>
        {error && (
          <p className="form-error" style={{ padding: '0 1rem' }}>
            {error}
          </p>
        )}
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
        <p className="page-header__sub">Direct meets — exact pins only after both agree.</p>
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
