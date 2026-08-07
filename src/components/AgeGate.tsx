import { useEffect, useState, type MouseEvent } from 'react'

const STORAGE_KEY = 'ember-age-verified'

type AgeGateProps = {
  onVerified: () => void
}

export function AgeGate({ onVerified }: AgeGateProps) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  function verify(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (exiting) return
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* private mode */
    }
    setExiting(true)
    window.setTimeout(onVerified, 320)
  }

  function leave() {
    window.location.href = 'https://www.google.com'
  }

  return (
    <div className={`age-gate ${exiting ? 'age-gate--out' : ''}`}>
      <div className="age-gate__glow" aria-hidden />
      <div className="age-gate__noise" aria-hidden />
      <div className="age-gate__card">
        <p className="brand brand--hero">EMBER</p>
        <h1 className="age-gate__title">Adults only.</h1>
        <p className="age-gate__copy">
          Explicit clips and casual encounters — not a dating app. You must be 18+. Free: feed, messages, follows, browse the map. Premium: post what you want right now and go live nearby.
        </p>
        <div className="age-gate__actions">
          <button type="button" className="btn btn--primary" onClick={verify}>
            I am 18+
          </button>
          <button type="button" className="btn btn--ghost" onClick={leave}>
            Exit
          </button>
        </div>
        <p className="age-gate__legal">
          By entering you confirm you are of legal age in your region and want to view adult content.
        </p>
      </div>
    </div>
  )
}

export function hasVerifiedAge(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
