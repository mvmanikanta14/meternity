import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { ErrorBox } from '../components/ui.jsx'

export default function AuthPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') await login(form.username, form.password)
      else await register(form.name, form.username, form.password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <div className="auth-bubbles" aria-hidden="true">
          <span>🍓</span><span>🥑</span><span>🍌</span><span>🍉</span>
        </div>
        <img src="/icon.svg" alt="" className="auth-logo" />
        <h1>Maternity</h1>
        <p>Your gentle companion for every week of the 9-month journey.</p>
      </div>

      <form className="auth-card" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Log in
          </button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
            Sign up
          </button>
        </div>

        {mode === 'register' && (
          <label className="field">
            <span>Your name</span>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Priya" required autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span>Username</span>
          <input
            value={form.username}
            onChange={set('username')}
            placeholder="e.g. priya"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder={mode === 'register' ? 'At least 6 characters' : '••••••'}
            minLength={mode === 'register' ? 6 : undefined}
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>

        <ErrorBox message={error} />

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
