import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icon.jsx'
import { Empty, ErrorBox, Loader, PageHeader, Sheet } from '../components/ui.jsx'
import { daysUntil, fmtDate, fmtWeekday, todayISO } from '../utils.js'

const PRESETS = ['Monthly check-up', 'Ultrasound scan', 'Blood test', 'NT scan', 'Anomaly scan', 'Glucose test (GTT)', 'Vaccination']

export default function AppointmentsPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  const [tab, setTab] = useState('upcoming')
  const [editing, setEditing] = useState(null) // null | 'new' | appointment
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => api.appointments().then(setItems).catch((e) => setError(e.message)), [])
  useEffect(() => {
    load()
  }, [load])

  const openNew = useCallback(() => {
    setForm({ title: '', doctor: user.doctor_name || '', location: user.hospital || '', date: todayISO(), time: '10:00', notes: '', done: false })
    setError('')
    setEditing('new')
  }, [user])

  useEffect(() => {
    if (location.state?.openAdd) {
      openNew()
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location, navigate, openNew])

  const openEdit = (a) => {
    setForm({ ...a, doctor: a.doctor || '', location: a.location || '', time: a.time || '', notes: a.notes || '' })
    setError('')
    setEditing(a)
  }
  const close = useCallback(() => setEditing(null), [])
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const payload = (f) => ({
    title: f.title,
    doctor: f.doctor || null,
    location: f.location || null,
    date: f.date,
    time: f.time || null,
    notes: f.notes || null,
    done: !!f.done,
  })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (editing === 'new') await api.addAppointment(payload(form))
      else await api.updateAppointment(editing.id, payload(form))
      setEditing(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleDone = async (a) => {
    await api.updateAppointment(a.id, payload({ ...a, done: !a.done }))
    load()
  }

  const remove = async () => {
    if (!confirm('Delete this appointment?')) return
    await api.deleteAppointment(editing.id)
    setEditing(null)
    load()
  }

  if (!items) return error ? <div className="page"><ErrorBox message={error} /></div> : <Loader />

  const today = todayISO()
  const upcoming = items.filter((a) => !a.done && a.date >= today)
  const past = items.filter((a) => a.done || a.date < today).reverse()
  const shown = tab === 'upcoming' ? upcoming : past

  return (
    <div className="page">
      <PageHeader
        title="Doctor visits"
        subtitle="Never miss a check-up"
        action={
          <button className="icon-btn icon-btn-primary" onClick={openNew} aria-label="Add appointment">
            <Icon name="plus" />
          </button>
        }
      />

      <div className="segmented">
        <button className={tab === 'upcoming' ? 'active' : ''} onClick={() => setTab('upcoming')}>
          Upcoming ({upcoming.length})
        </button>
        <button className={tab === 'past' ? 'active' : ''} onClick={() => setTab('past')}>
          Past ({past.length})
        </button>
      </div>

      {shown.length === 0 ? (
        <Empty
          emoji={tab === 'upcoming' ? '🗓️' : '📂'}
          title={tab === 'upcoming' ? 'No upcoming visits' : 'No past visits'}
          text={tab === 'upcoming' ? 'Add your next check-up, scan or test so you get reminded.' : 'Completed visits will show up here.'}
        >
          {tab === 'upcoming' && <button className="btn btn-primary" onClick={openNew}>Add appointment</button>}
        </Empty>
      ) : (
        <div className="list">
          {shown.map((a) => {
            const d = daysUntil(a.date)
            return (
              <div className={`card appt ${a.done ? 'done' : ''}`} key={a.id}>
                <div className="date-badge">
                  <strong>{new Date(`${a.date}T00:00:00`).getDate()}</strong>
                  <span>{fmtDate(a.date, { month: 'short' })}</span>
                </div>
                <button className="appt-body" onClick={() => openEdit(a)}>
                  <h4>{a.title}</h4>
                  <p className="muted small">
                    <Icon name="clock" size={14} /> {fmtWeekday(a.date)}
                    {a.time ? ` · ${a.time}` : ''}
                  </p>
                  {(a.doctor || a.location) && (
                    <p className="muted small">
                      <Icon name="pin" size={14} /> {[a.doctor, a.location].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {!a.done && d >= 0 && (
                    <span className={`chip ${d <= 2 ? 'chip-hot' : 'chip-soft'}`}>
                      {d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`}
                    </span>
                  )}
                </button>
                <button
                  className={`check ${a.done ? 'checked' : ''}`}
                  onClick={() => toggleDone(a)}
                  aria-label={a.done ? 'Mark as not done' : 'Mark as done'}
                >
                  <Icon name="check" size={18} stroke={3} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <Sheet open={!!editing} title={editing === 'new' ? 'New appointment' : 'Edit appointment'} onClose={close}>
        <form onSubmit={submit} className="form">
          <label className="field">
            <span>Title</span>
            <input value={form.title || ''} onChange={set('title')} placeholder="e.g. Monthly check-up" required />
          </label>
          <div className="chips-select">
            {PRESETS.map((p) => (
              <button type="button" key={p} className={`chip-toggle ${form.title === p ? 'active' : ''}`} onClick={() => setForm({ ...form, title: p })}>
                {p}
              </button>
            ))}
          </div>
          <div className="row-2">
            <label className="field">
              <span>Date</span>
              <input type="date" value={form.date || ''} onChange={set('date')} required />
            </label>
            <label className="field">
              <span>Time</span>
              <input type="time" value={form.time || ''} onChange={set('time')} />
            </label>
          </div>
          <label className="field">
            <span>Doctor</span>
            <input value={form.doctor || ''} onChange={set('doctor')} placeholder="Dr. name" />
          </label>
          <label className="field">
            <span>Hospital / clinic</span>
            <input value={form.location || ''} onChange={set('location')} placeholder="Location" />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea rows="2" value={form.notes || ''} onChange={set('notes')} placeholder="Questions to ask, reports to carry…" />
          </label>
          <ErrorBox message={error} />
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          {editing && editing !== 'new' && (
            <button type="button" className="btn btn-danger-ghost btn-block" onClick={remove}>
              Delete appointment
            </button>
          )}
        </form>
      </Sheet>
    </div>
  )
}
