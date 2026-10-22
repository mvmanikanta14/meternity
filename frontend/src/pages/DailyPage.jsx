import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icon.jsx'
import { Empty, ErrorBox, Loader, PageHeader, Sheet } from '../components/ui.jsx'
import { googleCalendarUrl, medicinesIcs } from '../alarm.js'
import { WATER_GOAL, fmtDate, fmtTime24, todayISO } from '../utils.js'

// Calendar alarms run until 3 months after the due date (iron / calcium often continue after birth).
const alarmsUntil = (dueIso) => {
  if (!dueIso) return null
  const d = new Date(`${dueIso}T00:00:00`)
  d.setDate(d.getDate() + 90)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const SUGGESTED = [
  { name: 'Folic acid', dose: '5 mg', time: '08:00' },
  { name: 'Iron', dose: '1 tablet', time: '14:00' },
  { name: 'Calcium', dose: '1 tablet', time: '21:00' },
  { name: 'Vitamin D3', dose: '1 tablet', time: '09:00' },
  { name: 'DHA / Omega-3', dose: '1 capsule', time: '13:00' },
  { name: 'Thyroid tablet', dose: 'empty stomach', time: '06:30' },
]

const WATER_REMINDERS = [
  { value: 0, label: 'Off' },
  { value: 60, label: '1 hr' },
  { value: 120, label: '2 hrs' },
  { value: 180, label: '3 hrs' },
]

const emptyMed = () => ({ name: '', dose: '', time: '' })

export default function DailyPage() {
  const { user, updateProfile } = useAuth()
  const [day, setDay] = useState(null)
  const [history, setHistory] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyMed)
  const [error, setError] = useState('')
  const [perm, setPerm] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission))

  const load = useCallback(() => {
    api.daily(todayISO()).then(setDay).catch((e) => setError(e.message))
    api.dailyHistory(7).then(setHistory).catch(() => {})
  }, [])
  useEffect(() => {
    load()
    window.addEventListener('maternity-data', load)
    return () => window.removeEventListener('maternity-data', load)
  }, [load])

  const close = useCallback(() => setEditing(null), [])

  const changeWater = async (delta) => {
    const next = Math.max(0, Math.min(30, day.water + delta))
    setDay({ ...day, water: next })
    await api.setWater(todayISO(), next)
    if (delta > 0) navigator.vibrate?.(20)
    load()
  }

  const toggle = async (id) => {
    await api.toggleMedicine(id, todayISO())
    navigator.vibrate?.(20)
    load()
  }

  const openAdd = (preset) => {
    setForm(preset ? { ...preset } : emptyMed())
    setError('')
    setEditing('new')
  }
  const openEdit = (m) => {
    setForm({ name: m.name, dose: m.dose || '', time: m.time || '' })
    setError('')
    setEditing(m)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const body = { name: form.name, dose: form.dose || null, time: form.time || null }
      if (editing === 'new') await api.addMedicine(body)
      else await api.updateMedicine(editing.id, body)
      setEditing(null)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const remove = async () => {
    if (!confirm(`Remove ${editing.name}?`)) return
    await api.deleteMedicine(editing.id)
    setEditing(null)
    load()
  }

  const saveIcs = async () => {
    const text = medicinesIcs(day.medicines, alarmsUntil(user.due_date))
    const file = new File([text], 'medicine-alarms.ics', { type: 'text/calendar' })
    const download = () => {
      const url = URL.createObjectURL(file)
      Object.assign(document.createElement('a'), { href: url, download: file.name }).click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    }
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Medicine alarms' }).catch(download)
    else download()
  }

  const askPermission = async () => {
    if (typeof Notification === 'undefined') return
    setPerm(await Notification.requestPermission())
  }

  if (!day) return error ? <div className="page"><ErrorBox message={error} /></div> : <Loader />

  const waterPct = Math.min(1, day.water / WATER_GOAL)
  const doneAll = day.medicines.length > 0 && day.taken.length === day.medicines.length
  const timed = day.medicines.filter((m) => m.time)
  const unused = SUGGESTED.filter((s) => !day.medicines.some((m) => m.name.toLowerCase() === s.name.toLowerCase()))

  return (
    <div className="page">
      <PageHeader
        title="Medicines & water"
        subtitle={fmtDate(todayISO(), { weekday: 'long', day: 'numeric', month: 'long' })}
        back
        action={
          <button className="icon-btn icon-btn-primary" onClick={() => openAdd()} aria-label="Add medicine">
            <Icon name="plus" />
          </button>
        }
      />

      <div className="card water-card">
        <div className="water-head">
          <div>
            <h3 className="card-title">💧 Water today</h3>
            <p>
              <strong className="water-count">{day.water}</strong> / {WATER_GOAL} glasses
            </p>
          </div>
          <div className="water-btns">
            <button className="round-btn" onClick={() => changeWater(-1)} disabled={day.water === 0} aria-label="Remove a glass">
              −
            </button>
            <button className="round-btn round-btn-blue" onClick={() => changeWater(1)} aria-label="Add a glass">
              +
            </button>
          </div>
        </div>
        <div className="glasses">
          {Array.from({ length: WATER_GOAL }, (_, i) => (
            <span key={i} className={i < day.water ? 'full' : ''}>
              <Icon name="drop" size={20} />
            </span>
          ))}
        </div>
        <div className="bar bar-blue"><div style={{ width: `${waterPct * 100}%` }} /></div>
        {day.water >= WATER_GOAL && <p className="small ok-text">🎉 Goal reached — well done!</p>}
      </div>

      <h3 className="section-title">
        💊 Today's medicines {day.medicines.length > 0 && <span className="muted small">· {day.taken.length}/{day.medicines.length} taken</span>}
      </h3>
      {day.medicines.length === 0 ? (
        <Empty emoji="💊" title="No medicines added" text="Add the tablets your doctor prescribed and tick them off each day.">
          <button className="btn btn-primary" onClick={() => openAdd()}>Add medicine</button>
        </Empty>
      ) : (
        <div className="list">
          {day.medicines.map((m) => {
            const taken = day.taken.includes(m.id)
            return (
              <div className={`card med ${taken ? 'done' : ''}`} key={m.id}>
                <button className={`check ${taken ? 'checked' : ''}`} onClick={() => toggle(m.id)} aria-label={taken ? 'Mark not taken' : 'Mark taken'}>
                  <Icon name="check" size={18} stroke={3} />
                </button>
                <button className="med-body" onClick={() => openEdit(m)}>
                  <h4>{m.name}</h4>
                  <p className="muted small">
                    {[m.dose, m.time && fmtTime24(m.time)].filter(Boolean).join(' · ') || 'Tap to edit'}
                  </p>
                </button>
                {taken && <span className="chip chip-ok">Taken</span>}
              </div>
            )
          })}
          {doneAll && <div className="card ok-card">✅ All medicines taken today!</div>}
        </div>
      )}

      {unused.length > 0 && (
        <>
          <p className="field-label">Quick add</p>
          <div className="chips-select">
            {unused.map((s) => (
              <button key={s.name} className="chip-toggle" onClick={() => openAdd(s)}>
                + {s.name}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="card alarm-card">
        <h3 className="card-title">⏰ Phone alarms</h3>
        <p className="small">
          Rings on your phone every day at the medicine time — <b>even when this app is closed</b>. Add your medicine
          times to your phone's calendar once:
        </p>
        {timed.length === 0 ? (
          <p className="small muted" style={{ marginTop: 10 }}>Set a reminder time on a medicine first (tap it above).</p>
        ) : (
          <>
            <div className="alarm-list">
              {timed.map((m) => (
                <div className="alarm-row" key={m.id}>
                  <span className="alarm-time">{fmtTime24(m.time)}</span>
                  <span className="grow">{m.name}</span>
                  <a className="btn btn-sm btn-ghost" href={googleCalendarUrl(m, alarmsUntil(user.due_date))} target="_blank" rel="noreferrer">
                    + Google Calendar
                  </a>
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-sm btn-block" onClick={saveIcs}>
              <Icon name="calendar" size={16} /> Add all to phone calendar (.ics)
            </button>
            <ul className="alarm-help small">
              <li><b>Android:</b> tap <b>+ Google Calendar</b> for each medicine and press Save.</li>
              <li><b>iPhone:</b> tap <b>Add all to phone calendar</b>, open the file, then <b>Add All</b>.</li>
              <li>For a louder ring, set your calendar app's notification sound to an alarm tone.</li>
              <li>If you change a medicine time, add it again and delete the old calendar event.</li>
            </ul>
          </>
        )}
      </div>

      <div className="card">
        <h3 className="card-title"><Icon name="bell" size={18} /> In-app reminders</h3>
        <p className="small">
          While the app is open, an alarm sound rings at each medicine time (with Snooze / Taken). Water reminders come
          every:
        </p>
        <div className="segmented" style={{ marginTop: 10 }}>
          {WATER_REMINDERS.map((r) => (
            <button
              key={r.value}
              className={(user.water_reminder || 0) === r.value ? 'active' : ''}
              onClick={() => updateProfile({ water_reminder: r.value })}
            >
              {r.label}
            </button>
          ))}
        </div>
        {perm === 'default' && (
          <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 12 }} onClick={askPermission}>
            Allow notifications
          </button>
        )}
        {perm === 'denied' && <p className="small muted" style={{ marginTop: 10 }}>Notifications are blocked in browser settings — reminders will show inside the app.</p>}
        <p className="fine-print" style={{ marginTop: 10 }}>
          These work while the app is open or in the background. For alarms when it's closed, use Phone alarms above.
        </p>
      </div>

      {history.length > 0 && (
        <div className="card">
          <h3 className="card-title">📅 Last 7 days</h3>
          <div className="week-grid">
            {history.slice().reverse().map((d) => (
              <div key={d.date} className={`week-day ${d.date === todayISO() ? 'today' : ''}`}>
                <span className="wd-name">{fmtDate(d.date, { weekday: 'narrow' })}</span>
                <span className={`wd-dot ${d.total && d.taken >= d.total ? 'on' : d.taken ? 'half' : ''}`}>💊</span>
                <span className="wd-water">{d.water}💧</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Sheet open={!!editing} title={editing === 'new' ? 'Add medicine' : 'Edit medicine'} onClose={close}>
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>Medicine name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Folic acid" required autoFocus />
          </label>
          <div className="row-2">
            <label className="field">
              <span>Dose</span>
              <input value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="1 tablet" />
            </label>
            <label className="field">
              <span>Reminder time</span>
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </label>
          </div>
          <ErrorBox message={error} />
          <button className="btn btn-primary btn-block">Save</button>
          {editing && editing !== 'new' && (
            <button type="button" className="btn btn-danger-ghost btn-block" onClick={remove}>
              <Icon name="trash" size={18} /> Remove medicine
            </button>
          )}
        </form>
      </Sheet>
    </div>
  )
}
