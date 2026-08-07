import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function AuthPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    handle: '',
    age: '21',
  })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') {
        const user = await login(form.email, form.password)
        navigate(user.role === 'admin' ? '/admin' : '/profile')
      } else {
        await register({
          email: form.email,
          password: form.password,
          displayName: form.displayName,
          handle: form.handle,
          age: Number(form.age),
        })
        navigate('/profile')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <p className="brand brand--sm">EMBER</p>
      <h1>{mode === 'login' ? 'Welcome back' : 'Create your heat profile'}</h1>
      <p className="page-header__sub">18+ only. Free basic: upload, message, follow. Premium unlocks map meetups.</p>

      <div className="auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          className={mode === 'register' ? 'is-active' : ''}
          onClick={() => setMode('register')}
        >
          Join
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={mode === 'login' ? 'is-active' : ''}
          onClick={() => setMode('login')}
        >
          Log in
        </button>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
        {mode === 'register' && (
          <>
            <label>
              Display name
              <input
                required
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </label>
            <label>
              Handle
              <input
                required
                value={form.handle}
                onChange={(e) => setForm({ ...form, handle: e.target.value })}
                placeholder="your.name"
              />
            </label>
            <label>
              Age
              <input
                required
                type="number"
                min={18}
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
              />
            </label>
          </>
        )}
        <label>
          Email
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label>
          Password
          <input
            required
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Join EMBER'}
        </button>
      </form>

      <p className="auth-foot">
        <Link to="/">Back to feed</Link>
        {' · '}
        <Link to="/admin">Admin hub</Link>
      </p>
    </div>
  )
}
