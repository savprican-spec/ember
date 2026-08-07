import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api, formatMoney, track } from '../lib/api'

type VerifyConfig = {
  priceCents: number
  currency: string
  stripeEnabled: boolean
  allowDevBypass: boolean
  label: string
  description: string
}

export function VerifyPage() {
  const { user, loading, refresh, logout } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [config, setConfig] = useState<VerifyConfig | null>(null)
  const [birthdate, setBirthdate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const status = params.get('status')
  const sessionId = params.get('session_id')

  useEffect(() => {
    api<VerifyConfig>('/api/verify/config').then(setConfig).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!user || !sessionId || status !== 'success') return
    setBusy(true)
    api<{ verified: boolean }>('/api/verify/confirm', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    })
      .then(async () => {
        await refresh()
        setMessage('Payment received. You’re verified.')
        track('verify_confirm_success')
        navigate('/', { replace: true })
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not confirm payment'))
      .finally(() => setBusy(false))
  }, [user, sessionId, status, refresh, navigate])

  const priceLabel = useMemo(() => {
    if (!config) return ''
    return formatMoney(config.priceCents, config.currency)
  }, [config])

  if (loading) return <div className="verify-page"><p>Loading…</p></div>

  if (!user) {
    return (
      <div className="verify-page">
        <p className="brand brand--sm">EMBER</p>
        <h1>Verify your age</h1>
        <p className="page-header__sub">Sign in first, then complete the paid 18+ check.</p>
        <Link className="btn btn--primary" to="/auth">
          Sign in
        </Link>
      </div>
    )
  }

  if (user.ageVerified || user.role === 'admin') {
    return (
      <div className="verify-page">
        <p className="brand brand--sm">EMBER</p>
        <h1>You’re verified</h1>
        <p className="page-header__sub">Full access is unlocked.</p>
        <Link className="btn btn--primary" to="/">
          Enter feed
        </Link>
      </div>
    )
  }

  async function startCheckout() {
    setError('')
    setBusy(true)
    try {
      const data = await api<{
        mode: string
        url?: string
        alreadyVerified?: boolean
        message?: string
      }>('/api/verify/checkout', {
        method: 'POST',
        body: JSON.stringify({ birthdate }),
      })
      if (data.alreadyVerified) {
        await refresh()
        navigate('/')
        return
      }
      if (data.mode === 'stripe' && data.url) {
        track('verify_redirect_stripe')
        window.location.href = data.url
        return
      }
      setMessage(data.message || 'Stripe not configured. Use test verification below.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed')
    } finally {
      setBusy(false)
    }
  }

  async function devComplete() {
    setError('')
    setBusy(true)
    try {
      await api('/api/verify/dev-complete', {
        method: 'POST',
        body: JSON.stringify({ birthdate }),
      })
      await refresh()
      track('verify_dev_complete')
      navigate('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="verify-page">
      <div className="verify-card">
        <ShieldCheck size={36} className="verify-icon" />
        <p className="brand brand--sm">EMBER</p>
        <h1>Pay to verify age</h1>
        <p className="page-header__sub">
          Double gate: you already confirmed 18+ at the door. Now a one-time card payment + date of birth locks it in —
          keeps minors out and helps fund the platform.
        </p>

        <div className="verify-price">
          <strong>{priceLabel || '…'}</strong>
          <span>one-time age verification</span>
        </div>

        <ol className="verify-steps">
          <li>Entry age gate (already done)</li>
          <li>Account created as 18+</li>
          <li>Pay verification fee with your card</li>
          <li>Confirm date of birth</li>
        </ol>

        <label className="field">
          <span>Date of birth</span>
          <input type="date" required value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
        </label>

        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-hint">{message}</p>}
        {status === 'cancel' && <p className="form-error">Checkout canceled. You can try again.</p>}

        <button type="button" className="btn btn--primary" disabled={busy || !birthdate} onClick={() => void startCheckout()}>
          {busy ? 'Working…' : `Verify & pay ${priceLabel}`}
        </button>

        {config?.allowDevBypass && (
          <button type="button" className="btn btn--ghost" disabled={busy || !birthdate} onClick={() => void devComplete()}>
            Test verify (dev only)
          </button>
        )}

        <p className="auth-foot">
          Signed in as @{user.handle} · <button type="button" className="linkish" onClick={logout}>Sign out</button>
        </p>
      </div>
    </div>
  )
}
