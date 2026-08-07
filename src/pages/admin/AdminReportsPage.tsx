import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, mediaUrl } from '../../lib/api'

type TargetUser = {
  id: string
  displayName: string
  handle: string
  email: string
  bio: string
  avatarUrl: string
  lookingFor: string
  premium: boolean
  role: string
}

type TargetUpload = {
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

type TargetMessage = {
  id: string
  conversationId: string
  body: string
  createdAt: string
  senderId: string
  senderName: string
  senderHandle: string
  senderEmail: string
}

type TargetConversation = {
  id: string
  createdAt: string
  updatedAt: string
  members: Array<{ id: string; displayName: string; handle: string; email: string }>
  recentMessages: Array<{
    id: string
    body: string
    createdAt: string
    senderId: string
    senderName: string
    senderHandle: string
  }>
}

type ReportTarget =
  | { missing: true; type: string }
  | { missing: false; type: 'user'; user: TargetUser }
  | { missing: false; type: 'upload'; upload: TargetUpload }
  | { missing: false; type: 'message'; message: TargetMessage }
  | { missing: false; type: 'conversation'; conversation: TargetConversation }

type Report = {
  id: string
  reporterId?: string
  reporterName: string
  reporterHandle: string
  reporterEmail: string
  targetType: string
  targetId: string
  target?: ReportTarget
  reason: string
  details: string
  status: string
  createdAt: string
}

function targetHeadline(r: Report) {
  const t = r.target
  if (!t || t.missing) return `${r.targetType} · removed or missing`
  if (t.type === 'user') return `${t.user.displayName} @${t.user.handle}`
  if (t.type === 'upload') return t.upload.title || 'Untitled upload'
  if (t.type === 'message') return `Message from @${t.message.senderHandle}`
  if (t.type === 'conversation') {
    const names = t.conversation.members.map((m) => `@${m.handle}`).join(' · ')
    return names || 'Conversation'
  }
  return r.targetType
}

function ReportTargetView({ report }: { report: Report }) {
  const t = report.target
  if (!t || t.missing) {
    return (
      <div className="admin-report__missing">
        <p>Reported {report.targetType} is no longer available.</p>
        <code>{report.targetId}</code>
      </div>
    )
  }

  if (t.type === 'user') {
    const u = t.user
    return (
      <div className="admin-report__target admin-report__target--user">
        <div className="admin-report__user-row">
          {u.avatarUrl ? <img className="avatar avatar--lg" src={mediaUrl(u.avatarUrl)} alt="" /> : <div className="avatar avatar--lg admin-report__avatar-fallback" />}
          <div>
            <strong>{u.displayName}</strong>
            <div className="muted">@{u.handle} · {u.email}</div>
            {u.premium && <span className="vis vis--verified">premium</span>}
          </div>
        </div>
        {u.bio && <p className="admin-bio">{u.bio}</p>}
        {u.lookingFor && <p className="muted">Looking: {u.lookingFor}</p>}
        <Link className="ghost-chip" to={`/admin/users/${u.id}`}>
          Open full profile
        </Link>
      </div>
    )
  }

  if (t.type === 'upload') {
    const u = t.upload
    return (
      <div className="admin-report__target admin-report__target--upload">
        <div className="admin-report__media">
          {u.mediaType === 'video' ? (
            <video src={mediaUrl(u.url)} controls playsInline preload="metadata" />
          ) : (
            <img src={mediaUrl(u.url)} alt={u.title || 'Reported upload'} />
          )}
        </div>
        <div className="admin-report__media-meta">
          <strong>{u.title || 'Untitled'}</strong>
          <span className={`vis vis--${u.visibility}`}>{u.visibility}</span>
          {u.caption && <p>{u.caption}</p>}
          <p className="muted">
            Uploaded by{' '}
            <Link to={`/admin/users/${u.userId}`}>
              {u.displayName} @{u.handle}
            </Link>
          </p>
          <time className="muted">{new Date(u.createdAt).toLocaleString()}</time>
          <Link className="ghost-chip" to="/admin/uploads">
            All uploads
          </Link>
        </div>
      </div>
    )
  }

  if (t.type === 'message') {
    const m = t.message
    return (
      <div className="admin-report__target admin-report__target--message">
        <article className="admin-thread__msg">
          <header>
            <strong>
              {m.senderName} @{m.senderHandle}
            </strong>
            <time className="muted">{new Date(m.createdAt).toLocaleString()}</time>
          </header>
          <p className="admin-report__message-body">{m.body}</p>
          <div className="muted">{m.senderEmail}</div>
        </article>
        <Link className="ghost-chip" to={`/admin/messages?c=${encodeURIComponent(m.conversationId)}`}>
          Open conversation
        </Link>
      </div>
    )
  }

  if (t.type === 'conversation') {
    const c = t.conversation
    return (
      <div className="admin-report__target admin-report__target--conversation">
        <p className="muted">
          Members:{' '}
          {c.members.map((m, i) => (
            <span key={m.id}>
              {i > 0 ? ' · ' : ''}
              <Link to={`/admin/users/${m.id}`}>
                {m.displayName} @{m.handle}
              </Link>
            </span>
          ))}
        </p>
        <div className="admin-thread">
          {c.recentMessages.map((m) => (
            <article key={m.id} className="admin-thread__msg">
              <header>
                <strong>@{m.senderHandle}</strong>
                <time className="muted">{new Date(m.createdAt).toLocaleString()}</time>
              </header>
              <p className="admin-report__message-body">{m.body}</p>
            </article>
          ))}
          {!c.recentMessages.length && <p className="muted">No messages in this thread.</p>}
        </div>
        <Link className="ghost-chip" to={`/admin/messages?c=${encodeURIComponent(c.id)}`}>
          Open full inbox thread
        </Link>
      </div>
    )
  }

  return null
}

export function AdminReportsPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || 'open'
  const focusId = params.get('id') || ''
  const [reports, setReports] = useState<Report[]>([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(focusId || null)

  async function load(next = status) {
    const data = await api<{ reports: Report[] }>(`/api/admin/reports?status=${next}`)
    setReports(data.reports)
  }

  useEffect(() => {
    load(status)
      .then(() => {
        if (focusId) setOpenId(focusId)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [status, focusId])

  useEffect(() => {
    if (!focusId) return
    const el = document.getElementById(`report-${focusId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusId, reports])

  const counts = useMemo(() => {
    const open = reports.filter((r) => r.status === 'open').length
    return { shown: reports.length, open }
  }, [reports])

  function setStatusFilter(next: string) {
    const qs = new URLSearchParams(params)
    qs.set('status', next)
    qs.delete('id')
    setParams(qs)
    setOpenId(null)
  }

  async function setReportStatus(id: string, next: string) {
    setBusyId(id)
    setError('')
    try {
      await api(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      })
      await load(status)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update report')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="admin-page">
      <header>
        <h2>Reports</h2>
        <p>
          Open a report to see the exact user, clip, or message that was flagged — not just an ID.
          {status !== 'all' ? ` Showing ${counts.shown} ${status}.` : ` Showing ${counts.shown}.`}
        </p>
      </header>
      <div className="filter-row">
        {['open', 'reviewing', 'resolved', 'dismissed', 'all'].map((s) => (
          <button
            key={s}
            type="button"
            className={`filter-chip ${status === s ? 'is-active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}

      <div className="admin-report-list">
        {reports.map((r) => {
          const expanded = openId === r.id
          return (
            <article
              key={r.id}
              id={`report-${r.id}`}
              className={`admin-report ${expanded ? 'is-open' : ''}`}
            >
              <button
                type="button"
                className="admin-report__summary"
                onClick={() => setOpenId(expanded ? null : r.id)}
                aria-expanded={expanded}
              >
                <div className="admin-report__summary-main">
                  <div className="admin-report__reason-row">
                    <strong>{r.reason.replace(/_/g, ' ')}</strong>
                    <span className={`vis ${r.status === 'open' ? 'vis--private' : ''}`}>{r.status}</span>
                    <span className="vis">{r.targetType}</span>
                  </div>
                  <p>{targetHeadline(r)}</p>
                  <p className="muted">
                    Reported by {r.reporterName} @{r.reporterHandle} · {new Date(r.createdAt).toLocaleString()}
                  </p>
                  {r.details ? <p className="admin-report__details-preview">{r.details}</p> : null}
                </div>
                <span className="admin-report__chevron" aria-hidden>
                  {expanded ? '▾' : '▸'}
                </span>
              </button>

              {expanded && (
                <div className="admin-report__body">
                  {r.details && (
                    <section className="admin-report__section">
                      <h3>Reporter note</h3>
                      <p>{r.details}</p>
                      <p className="muted">
                        {r.reporterName} @{r.reporterHandle} · {r.reporterEmail}
                      </p>
                    </section>
                  )}
                  <section className="admin-report__section">
                    <h3>Reported {r.targetType}</h3>
                    <ReportTargetView report={r} />
                  </section>
                  <div className="admin-actions">
                    {r.status === 'open' && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void setReportStatus(r.id, 'reviewing')}
                      >
                        Mark reviewing
                      </button>
                    )}
                    {r.status !== 'resolved' && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void setReportStatus(r.id, 'resolved')}
                      >
                        Resolve
                      </button>
                    )}
                    {r.status !== 'dismissed' && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void setReportStatus(r.id, 'dismissed')}
                      >
                        Dismiss
                      </button>
                    )}
                    {r.status !== 'open' && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void setReportStatus(r.id, 'open')}
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          )
        })}
        {!reports.length && <p className="muted">No reports in this filter.</p>}
      </div>
    </div>
  )
}
