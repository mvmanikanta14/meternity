import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icon.jsx'
import { ErrorBox, Sheet } from '../components/ui.jsx'
import { fmtDate } from '../utils.js'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export default function ProfilePage() {
  const { user, logout, updateProfile } = useAuth()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const openEdit = () => {
    setForm({
      name: user.name,
      phone: user.phone || '',
      blood_group: user.blood_group || '',
      doctor_name: user.doctor_name || '',
      hospital: user.hospital || '',
    })
    setError('')
    setOpen(true)
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await updateProfile(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])))
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const rows = [
    { icon: '📅', label: 'Last period', value: fmtDate(user.lmp_date) },
    { icon: '👶', label: 'Due date', value: fmtDate(user.due_date) },
    { icon: '🩸', label: 'Blood group', value: user.blood_group || 'Not set' },
    { icon: '👩‍⚕️', label: 'Doctor', value: user.doctor_name || 'Not set' },
    { icon: '🏥', label: 'Hospital', value: user.hospital || 'Not set' },
    { icon: '📞', label: 'Phone', value: user.phone || 'Not set' },
  ]

  return (
    <div className="page">
      <div className="profile-head">
        <div className="avatar avatar-lg">{user.name[0]?.toUpperCase()}</div>
        <h1>{user.name}</h1>
        <p className="muted">@{user.username}</p>
        <button className="btn btn-ghost btn-sm" onClick={openEdit}>
          <Icon name="edit" size={16} /> Edit profile
        </button>
      </div>

      <div className="card info-list">
        {rows.map((r) => (
          <div className="info-row" key={r.label}>
            <span className="info-icon">{r.icon}</span>
            <span className="info-label">{r.label}</span>
            <span className="info-value">{r.value}</span>
          </div>
        ))}
      </div>

      <div className="card menu">
        <Link to="/setup" className="menu-item">
          <span>🗓️</span> Change pregnancy dates <Icon name="chevron" size={18} className="chev" />
        </Link>
        <Link to="/kicks" className="menu-item">
          <span>👣</span> Kick counter <Icon name="chevron" size={18} className="chev" />
        </Link>
        <button className="menu-item danger" onClick={logout}>
          <Icon name="logout" size={20} /> Log out
        </button>
      </div>

      <div className="card emergency">
        <h3 className="card-title">🚨 Call your doctor if you have</h3>
        <ul>
          <li>Vaginal bleeding or fluid leaking</li>
          <li>Severe headache, blurred vision or sudden swelling</li>
          <li>Strong belly pain or regular contractions before 37 weeks</li>
          <li>Baby moving less than usual</li>
          <li>High fever or painful urination</li>
        </ul>
        <a className="btn btn-danger btn-block" href="tel:108">Call 108 – Emergency</a>
      </div>

      <Sheet open={open} title="Edit profile" onClose={() => setOpen(false)}>
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>Name</span>
            <input value={form.name || ''} onChange={set('name')} required />
          </label>
          <label className="field">
            <span>Phone</span>
            <input type="tel" value={form.phone || ''} onChange={set('phone')} placeholder="+91" />
          </label>
          <p className="field-label">Blood group</p>
          <div className="chips-select">
            {BLOOD_GROUPS.map((b) => (
              <button type="button" key={b} className={`chip-toggle ${form.blood_group === b ? 'active' : ''}`} onClick={() => setForm({ ...form, blood_group: b })}>
                {b}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Doctor's name</span>
            <input value={form.doctor_name || ''} onChange={set('doctor_name')} />
          </label>
          <label className="field">
            <span>Hospital</span>
            <input value={form.hospital || ''} onChange={set('hospital')} />
          </label>
          <ErrorBox message={error} />
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </form>
      </Sheet>
    </div>
  )
}
