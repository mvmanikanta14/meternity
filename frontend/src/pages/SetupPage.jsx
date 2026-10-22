import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { ErrorBox, PageHeader } from '../components/ui.jsx'
import { fmtDate, todayISO } from '../utils.js'

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function SetupPage({ edit = false }) {
  const { user, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [method, setMethod] = useState('lmp')
  const [value, setValue] = useState(method === 'lmp' ? user.lmp_date || '' : user.due_date || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const today = todayISO()
  const preview = value ? (method === 'lmp' ? addDays(value, 280) : value) : null

  const switchMethod = (m) => {
    setMethod(m)
    setValue(m === 'lmp' ? user.lmp_date || '' : user.due_date || '')
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await updateProfile(method === 'lmp' ? { lmp_date: value } : { due_date: value })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="setup">
      {edit ? (
        <PageHeader title="Pregnancy dates" back />
      ) : (
        <div className="setup-hero">
          <div className="setup-emoji">🤰</div>
          <h1>Hi {user.name.split(' ')[0]}, congratulations!</h1>
          <p>Let's set up your pregnancy so we can follow your baby's growth week by week.</p>
        </div>
      )}

      <form className="card setup-card" onSubmit={submit}>
        <p className="label-muted">I know my…</p>
        <div className="segmented">
          <button type="button" className={method === 'lmp' ? 'active' : ''} onClick={() => switchMethod('lmp')}>
            Last period date
          </button>
          <button type="button" className={method === 'due' ? 'active' : ''} onClick={() => switchMethod('due')}>
            Due date
          </button>
        </div>

        <label className="field">
          <span>{method === 'lmp' ? 'First day of your last period' : 'Expected due date'}</span>
          <input
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            max={method === 'lmp' ? today : addDays(today, 280)}
            min={method === 'lmp' ? addDays(today, -300) : addDays(today, -20)}
            required
          />
        </label>

        {preview && (
          <div className="due-preview">
            <span>Estimated due date</span>
            <strong>{fmtDate(preview, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
          </div>
        )}

        <ErrorBox message={error} />

        <button className="btn btn-primary btn-block" disabled={busy || !value}>
          {busy ? 'Saving…' : edit ? 'Save changes' : 'Start my journey'}
        </button>
        <p className="fine-print">
          Due date is calculated as 280 days (40 weeks) from the first day of your last period. Your doctor may
          adjust it after an ultrasound.
        </p>
      </form>
    </div>
  )
}
