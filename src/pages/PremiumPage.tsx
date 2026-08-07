import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MapPin } from 'lucide-react'
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
        setMessage('Premium unlocked — you can appear on the meetup map.')
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
        <h1>Ember Premium</h1>
        <p className="page-header__sub">Sign in first, then unlock map meetups.</p>
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
          <MapPin size={36} className="verify-icon" />
          <p className="brand brand--sm">EMBER</p>
          <h1>You’re Premium</h1>
          <p className="page-header__sub">
            Appear on the meetup map anytime from your profile
            {user.premiumUntil ? ` · active until ${new Date(user.premiumUntil).toLocaleDateString()}` : ''}.
          </p>
          <Link className="btn btn--primary" to="/map">
            Open map
          </Link>
          <Link className="btn btn--ghost" to="/profile">
            Profile settings
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
        <MapPin size={36} className="verify-icon" />
        <p className="brand brand--sm">EMBER</p>
        <h1>Appear on the map</h1>
        <p className="page-header__sub">
          Basic is free — message, upload XXX to the feed, follow people, and browse the map. Premium unlocks
          appearing for meetups and casual encounters.
        </p>
        <div className="verify-price">
          <strong>{priceLabel}</strong>
          <span>cancel anytime</span>
        </div>
        <ol className="verify-steps">
          <li>Keep the feed & messaging free</li>
          <li>Subscribe to show your pin nearby</li>
          <li>Toggle visibility anytime in profile</li>
        </ol>
        {message && <p className="form-hint">{message}</p>}
        {error && <p className="form-error">{error}</p>}
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void startCheckout()}>
          {busy ? 'Starting…' : config?.allowDevBypass && !config.stripeEnabled ? 'Test Premium (dev)' : `Go Premium — ${priceLabel}`}
        </button>
        <Link className="btn btn--ghost" to="/">
          Keep free basic
        </Link>
      </div>
    </div>
  )
}
