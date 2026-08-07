import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'

type Report = {
  id: string
  reporterId?: string
  reporterName: string
  reporterHandle: string
  reporterEmail: string
  targetType: string
  targetId: string
  reason: string
  details: string
  status: string
  createdAt: string
}

export function AdminReportsPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || 'open'
  const [reports, setReports] = useState<Report[]>([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load(next = status) {
    const data = await api<{ reports: Report[] }>(`/api/admin/reports?status=${next}`)
    setReports(data.reports)
  }

  useEffect(() => {
    load(status).catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [status])

  function setStatusFilter(next: string) {
    const qs = new URLSearchParams(params)
    if (next === 'open') qs.set('status', 'open')
    else qs.set('status', next)
    setParams(qs)
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

  function targetLink(r: Report) {
    if (r.targetType === 'user') return `/admin/users/${r.targetId}`
    if (r.targetType === 'upload') return `/admin/uploads`
    if (r.targetType === 'message') return `/admin/messages`
    return null
  }

  return (
    <div className="admin-page">
      <header>
        <h2>Reports</h2>
        <p>Everything flagged by members — open a row’s target, then review / resolve / dismiss.</p>
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
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Reason</th>
              <th>Target</th>
              <th>Reporter</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => {
              const to = targetLink(r)
              return (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>
                    <strong>{r.reason}</strong>
                    <div className="muted">{r.details || '—'}</div>
                  </td>
                  <td>
                    {to ? (
                      <Link to={to}>
                        {r.targetType}
                        <div className="muted">{r.targetId.slice(0, 12)}</div>
                      </Link>
                    ) : (
                      <>
                        {r.targetType}
                        <div className="muted">{r.targetId.slice(0, 12)}</div>
                      </>
                    )}
                  </td>
                  <td>
                    {r.reporterName} @{r.reporterHandle}
                    <div className="muted">{r.reporterEmail}</div>
                  </td>
                  <td>
                    <span className={`vis ${r.status === 'open' ? 'vis--private' : ''}`}>{r.status}</span>
                  </td>
                  <td className="admin-actions">
                    {r.status === 'open' && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void setReportStatus(r.id, 'reviewing')}
                      >
                        Review
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
                  </td>
                </tr>
              )
            })}
            {!reports.length && (
              <tr>
                <td colSpan={6} className="muted">
                  No reports in this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
