import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api, formatMoney, track } from '../lib/api'

type PremiumConfig = {
  priceCents: number
  currency: string
  interval: string
  stripeEnabled: boolean
  allowDevBypass: boolean
  label: string
  description: string
  features?: string[]
}

export function PremiumPage() {
  const { user, loading, refresh } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [config, setConfig] = useState<PremiumConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const status = params.get('status')
  const sessionId = params.get('session_id')

  useEffect(() => {
    api<PremiumConfig>('/api/premium/config').then(setConfig).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!user || !sessionId || status !== 'success') return
    setBusy(true)
    api<{ premium: boolean }>('/api/premium/confirm', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    })
      .then(async () => {
        await refresh()
        setMessage('Premium unlocked — post what you want and go live nearby.')
        track('premium_confirm_success')
        navigate('/map', { replace: true })
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not confirm payment'))
      .finally(() => setBusy(false))
  }, [user, sessionId, status, refresh, navigate])

  const priceLabel = useMemo(() => {
    if (!config) return '$9.99'
    return `${formatMoney(config.priceCents, config.currency)}/mo`
  }, [config])

  const features = config?.features || [
    'Post “Right now” — what you want for a casual meet',
    'Go live on the nearby map so others can find you',
    'Set hosting / cruising / car / hotel intent',
    'Pulse freshness so people know you’re available',
  ]

  if (loading) {
    return (
      <div className="verify-page">
        <p>Loading…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="verify-page">
        <p className="brand brand--sm">EMBER</p>
        <h1>Casual encounters Premium</h1>
        <p className="page-header__sub">Sign in first — this isn’t a dating tier, it’s for going live nearby.</p>
        <Link className="btn btn--primary" to="/auth">
          Sign in
        </Link>
      </div>
    )
  }

  if (user.premium || user.role === 'admin') {
    return (
      <div className="verify-page">
        <div className="verify-card">
          <Flame size={36} className="verify-icon" />
          <p className="brand brand--sm">EMBER</p>
          <h1>You’re live-ready</h1>
          <p className="page-header__sub">
            Post what you’re looking for and appear on the encounter map
            {user.premiumUntil ? ` · active until ${new Date(user.premiumUntil).toLocaleDateString()}` : ''}.
          </p>
          <Link className="btn btn--primary" to="/map">
            Post right now
          </Link>
          <Link className="btn btn--ghost" to="/profile">
            Encounter settings
          </Link>
        </div>
      </div>
    )
  }

  async function startCheckout() {
    setBusy(true)
    setError('')
    try {
      const result = await api<{ mode?: string; url?: string | null; alreadyPremium?: boolean }>(
        '/api/premium/checkout',
        { method: 'POST' },
      )
      if (result.alreadyPremium) {
        await refresh()
        navigate('/map')
        return
      }
      if (result.url) {
        track('premium_redirect_stripe')
        window.location.href = result.url
        return
      }
      await api('/api/premium/dev-activate', { method: 'POST' })
      await refresh()
      track('premium_dev_activate')
      navigate('/map')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="verify-page">
      <div className="verify-card">
        <Flame size={36} className="verify-icon" />
        <p className="brand brand--sm">EMBER</p>
        <h1>Casual encounters</h1>
        <p className="page-header__sub">
          Not a dating app. Premium is built for now: post what you want, go live on the map, and meet nearby.
          The XXX feed, messaging, and follows stay free.
        </p>
        <div className="verify-price">
          <strong>{priceLabel}</strong>
          <span>cancel anytime</span>
        </div>
        <ol className="verify-steps">
          {features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ol>
        {message && <p className="form-hint">{message}</p>}
        {error && <p className="form-error">{error}</p>}
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void startCheckout()}>
          {busy
            ? 'Starting…'
            : config?.allowDevBypass && !config.stripeEnabled
              ? 'Test Premium (dev)'
              : `Go Premium — ${priceLabel}`}
        </button>
        <Link className="btn btn--ghost" to="/">
          Keep free feed
        </Link>
      </div>
    </div>
  )
}
