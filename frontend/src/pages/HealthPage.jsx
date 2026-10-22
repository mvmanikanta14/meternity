import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import Icon from '../components/Icon.jsx'
import { Empty, ErrorBox, Loader, PageHeader, Sheet } from '../components/ui.jsx'
import { MOODS, SYMPTOMS, fmtShort, fmtWeekday, moodEmoji, todayISO } from '../utils.js'

const blank = () => ({
  log_date: todayISO(),
  weight: '',
  systolic: '',
  diastolic: '',
  water_glasses: 0,
  mood: '',
  symptoms: [],
  notes: '',
})

function WeightChart({ logs }) {
  const points = logs
    .filter((l) => l.weight)
    .slice()
    .sort((a, b) => (a.log_date < b.log_date ? -1 : 1))
    .slice(-12)
  if (points.length < 2) {
    return <p className="muted small">Log your weight on two or more days to see your trend.</p>
  }
  const W = 320
  const H = 120
  const pad = 14
  const ws = points.map((p) => p.weight)
  const min = Math.min(...ws) - 1
  const max = Math.max(...ws) + 1
  const x = (i) => pad + (i * (W - pad * 2)) / (points.length - 1)
  const y = (v) => H - pad - ((v - min) / (max - min)) * (H - pad * 2)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.weight)}`).join(' ')
  const area = `${line} L${x(points.length - 1)},${H} L${x(0)},${H} Z`
  const diff = (ws[ws.length - 1] - ws[0]).toFixed(1)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Weight trend">
        <defs>
          <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e8618c" stopOpacity=".28" />
            <stop offset="1" stopColor="#e8618c" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#wfill)" />
        <path d={line} fill="none" stroke="#e8618c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={p.id} cx={x(i)} cy={y(p.weight)} r="4" fill="#fff" stroke="#e8618c" strokeWidth="2.5" />
        ))}
      </svg>
      <div className="chart-foot">
        <span>{fmtShort(points[0].log_date)}</span>
        <span className="chip chip-soft">
          {diff > 0 ? '+' : ''}
          {diff} kg
        </span>
        <span>{fmtShort(points[points.length - 1].log_date)}</span>
      </div>
    </div>
  )
}

export default function HealthPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [logs, setLogs] = useState(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [trackedWater, setTrackedWater] = useState(0)

  const load = useCallback(() => {
    api.logs().then(setLogs).catch((e) => setError(e.message))
    api.daily(todayISO()).then((d) => setTrackedWater(d.water)).catch(() => {})
  }, [])
  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (location.state?.openLog) {
      setOpen(true)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location, navigate])

  const close = useCallback(() => setOpen(false), [])
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const toggleSymptom = (s) =>
    setForm({
      ...form,
      symptoms: form.symptoms.includes(s) ? form.symptoms.filter((x) => x !== s) : [...form.symptoms, s],
    })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const num = (v) => (v === '' || v === null ? null : Number(v))
    try {
      await api.addLog({
        ...form,
        weight: num(form.weight),
        systolic: num(form.systolic),
        diastolic: num(form.diastolic),
        water_glasses: num(form.water_glasses),
        mood: form.mood || null,
        notes: form.notes || null,
      })
      setOpen(false)
      setForm(blank())
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this entry?')) return
    await api.deleteLog(id)
    load()
  }

  if (!logs) return error ? <div className="page"><ErrorBox message={error} /></div> : <Loader />

  const latest = logs[0]
  const latestWeight = logs.find((l) => l.weight)
  const latestBp = logs.find((l) => l.systolic && l.diastolic)
  const todayWater =
    trackedWater + logs.filter((l) => l.log_date === todayISO()).reduce((s, l) => s + (l.water_glasses || 0), 0)

  return (
    <div className="page">
      <PageHeader
        title="Health"
        subtitle="Track how you feel each day"
        action={
          <button className="icon-btn icon-btn-primary" onClick={() => setOpen(true)} aria-label="Add log">
            <Icon name="plus" />
          </button>
        }
      />

      <div className="metric-grid">
        <div className="metric m-pink">
          <Icon name="scale" />
          <strong>{latestWeight ? `${latestWeight.weight} kg` : '—'}</strong>
          <span>Weight</span>
        </div>
        <div className="metric m-violet">
          <Icon name="pulse" />
          <strong>{latestBp ? `${latestBp.systolic}/${latestBp.diastolic}` : '—'}</strong>
          <span>Blood pressure</span>
        </div>
        <Link to="/daily" className="metric m-blue">
          <Icon name="drop" />
          <strong>{todayWater} / 10</strong>
          <span>Water today ›</span>
        </Link>
        <div className="metric m-peach">
          <span className="metric-emoji">{latest?.mood ? moodEmoji(latest.mood) : '🙂'}</span>
          <strong>{latest?.mood ? MOODS.find((m) => m.key === latest.mood)?.label : '—'}</strong>
          <span>Last mood</span>
        </div>
      </div>

      {latestBp && (latestBp.systolic >= 140 || latestBp.diastolic >= 90) && (
        <div className="alert">
          Your last blood pressure reading was high. Please contact your doctor, especially if you have headache,
          blurred vision or swelling.
        </div>
      )}

      <div className="card">
        <h3 className="card-title">⚖️ Weight trend</h3>
        <WeightChart logs={logs} />
      </div>

      <h3 className="section-title">History</h3>
      {logs.length === 0 ? (
        <Empty emoji="📝" title="No entries yet" text="Log your weight, BP, mood and symptoms to see them here.">
          <button className="btn btn-primary" onClick={() => setOpen(true)}>Add first log</button>
        </Empty>
      ) : (
        <div className="list">
          {logs.map((l) => (
            <div className="card log-item" key={l.id}>
              <div className="log-head">
                <strong>{fmtWeekday(l.log_date)}</strong>
                <span className="log-mood">{moodEmoji(l.mood)}</span>
                <button className="icon-btn icon-btn-sm" onClick={() => remove(l.id)} aria-label="Delete">
                  <Icon name="trash" size={18} />
                </button>
              </div>
              <div className="log-values">
                {l.weight && <span className="chip">⚖️ {l.weight} kg</span>}
                {l.systolic && l.diastolic && <span className="chip">❤️ {l.systolic}/{l.diastolic}</span>}
                {l.water_glasses > 0 && <span className="chip">💧 {l.water_glasses} glasses</span>}
              </div>
              {l.symptoms.length > 0 && (
                <div className="log-values">
                  {l.symptoms.map((s) => (
                    <span key={s} className="chip chip-soft">{s}</span>
                  ))}
                </div>
              )}
              {l.notes && <p className="muted small">{l.notes}</p>}
            </div>
          ))}
        </div>
      )}

      <Sheet open={open} title="Log today" onClose={close}>
        <form onSubmit={submit} className="form">
          <label className="field">
            <span>Date</span>
            <input type="date" value={form.log_date} max={todayISO()} onChange={set('log_date')} required />
          </label>

          <p className="field-label">Mood</p>
          <div className="mood-row">
            {MOODS.map((m) => (
              <button
                type="button"
                key={m.key}
                className={`mood ${form.mood === m.key ? 'active' : ''}`}
                onClick={() => setForm({ ...form, mood: form.mood === m.key ? '' : m.key })}
              >
                <span>{m.emoji}</span>
                <small>{m.label}</small>
              </button>
            ))}
          </div>

          <div className="row-2">
            <label className="field">
              <span>Weight (kg)</span>
              <input type="number" inputMode="decimal" step="0.1" value={form.weight} onChange={set('weight')} placeholder="58.5" />
            </label>
            <label className="field">
              <span>Water (glasses)</span>
              <div className="stepper">
                <button type="button" onClick={() => setForm({ ...form, water_glasses: Math.max(0, form.water_glasses - 1) })}>−</button>
                <strong>{form.water_glasses}</strong>
                <button type="button" onClick={() => setForm({ ...form, water_glasses: Math.min(30, form.water_glasses + 1) })}>+</button>
              </div>
            </label>
          </div>

          <div className="row-2">
            <label className="field">
              <span>BP systolic</span>
              <input type="number" inputMode="numeric" value={form.systolic} onChange={set('systolic')} placeholder="120" />
            </label>
            <label className="field">
              <span>BP diastolic</span>
              <input type="number" inputMode="numeric" value={form.diastolic} onChange={set('diastolic')} placeholder="80" />
            </label>
          </div>

          <p className="field-label">Symptoms</p>
          <div className="chips-select">
            {SYMPTOMS.map((s) => (
              <button
                type="button"
                key={s}
                className={`chip-toggle ${form.symptoms.includes(s) ? 'active' : ''}`}
                onClick={() => toggleSymptom(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <label className="field">
            <span>Notes</span>
            <textarea rows="3" value={form.notes} onChange={set('notes')} placeholder="Anything you'd like to remember…" />
          </label>

          <ErrorBox message={error} />
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Saving…' : 'Save entry'}
          </button>
        </form>
      </Sheet>
    </div>
  )
}
