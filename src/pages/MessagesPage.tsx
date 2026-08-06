import { useState } from 'react'
import { ArrowLeft, Send } from 'lucide-react'
import { conversations, type Conversation } from '../data/messages'

export function MessagesPage() {
  const [active, setActive] = useState<Conversation | null>(null)
  const [draft, setDraft] = useState('')
  const [threads, setThreads] = useState(conversations)

  function send() {
    if (!active || !draft.trim()) return
    const text = draft.trim()
    setDraft('')
    setThreads((list) =>
      list.map((c) =>
        c.id === active.id
          ? {
              ...c,
              preview: text,
              time: 'now',
              messages: [
                ...c.messages,
                { id: `local-${Date.now()}`, from: 'me' as const, text, time: 'now' },
              ],
            }
          : c,
      ),
    )
    setActive((cur) =>
      cur
        ? {
            ...cur,
            messages: [
              ...cur.messages,
              { id: `local-${Date.now()}`, from: 'me', text, time: 'now' },
            ],
          }
        : cur,
    )
  }

  if (active) {
    const live = threads.find((t) => t.id === active.id) ?? active
    return (
      <div className="messages-page messages-page--thread">
        <header className="thread-header">
          <button type="button" className="icon-btn" onClick={() => setActive(null)} aria-label="Back">
            <ArrowLeft size={22} />
          </button>
          <img src={live.avatar} alt="" className="avatar" />
          <div>
            <strong>{live.name}</strong>
            <p>{live.online ? 'Online now' : 'Away'}</p>
          </div>
        </header>
        <div className="thread-body">
          {live.messages.map((m) => (
            <div key={m.id} className={`bubble bubble--${m.from}`}>
              <p>{m.text}</p>
              <span>{m.time}</span>
            </div>
          ))}
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Keep it direct…"
            aria-label="Message"
          />
          <button type="submit" className="icon-btn icon-btn--ember" aria-label="Send" disabled={!draft.trim()}>
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
        <p className="page-header__sub">Direct, discreet, delete anytime.</p>
      </header>
      <ul className="inbox-list">
        {threads.map((c) => (
          <li key={c.id}>
            <button type="button" className="inbox-row" onClick={() => setActive(c)}>
              <span className={`avatar-wrap ${c.online ? 'is-online' : ''}`}>
                <img src={c.avatar} alt="" className="avatar avatar--lg" />
              </span>
              <span className="inbox-row__body">
                <span className="inbox-row__top">
                  <strong>{c.name}</strong>
                  <time>{c.time}</time>
                </span>
                <span className="inbox-row__preview">{c.preview}</span>
              </span>
              {c.unread > 0 && <span className="unread">{c.unread}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
