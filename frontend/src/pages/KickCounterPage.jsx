import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import Icon from '../components/Icon.jsx'
import { Empty, PageHeader } from '../components/ui.jsx'
import { fmtDuration } from '../utils.js'

const GOAL = 10

export default function KickCounterPage() {
  const [sessions, setSessions] = useState([])
  const [startedAt, setStartedAt] = useState(null)
  const [kicks, setKicks] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [pulse, setPulse] = useState(0)
  const timer = useRef(null)

  const load = useCallback(() => api.kicks().then(setSessions).catch(() => {}), [])
  useEffect(() => {
    load()
    return () => clearInterval(timer.current)
  }, [load])

  const start = () => {
    const now = new Date()
    setStartedAt(now)
    setKicks(0)
    setElapsed(0)
    clearInterval(timer.current)
    timer.current = setInterval(() => setElapsed(Math.floor((Date.now() - now.getTime()) / 1000)), 1000)
  }

  const tap = () => {
    if (!startedAt) start()
    setKicks((k) => k + 1)
    setPulse((p) => p + 1)
    navigator.vibrate?.(30)
  }

  const finish = async () => {
    clearInterval(timer.current)
    if (kicks > 0) {
      await api.addKicks({ started_at: startedAt.toISOString(), duration_seconds: elapsed, kicks })
      load()
    }
    setStartedAt(null)
    setKicks(0)
    setElapsed(0)
  }

  const remove = async (id) => {
    await api.deleteKicks(id)
    load()
  }

  const pct = Math.min(1, kicks / GOAL)

  return (
    <div className="page">
      <PageHeader title="Kick counter" subtitle="Count your baby's movements" back />

      <div className="kick-panel">
        <div className="kick-stats">
          <div>
            <strong>{kicks}</strong>
            <span>kicks</span>
          </div>
          <div>
            <strong>{fmtDuration(elapsed)}</strong>
            <span>time</span>
          </div>
        </div>

        <button className="kick-btn" onClick={tap} style={{ '--pct': pct }}>
          <span key={pulse} className="kick-ripple" />
          <Icon name="foot" size={56} stroke={1.8} />
          <span>{startedAt ? 'Tap for each kick' : 'Tap to start'}</span>
        </button>

        <div className="kick-goal">
          <div className="bar"><div style={{ width: `${pct * 100}%` }} /></div>
          <span>{kicks >= GOAL ? '🎉 Goal reached!' : `${GOAL - kicks} more to reach ${GOAL}`}</span>
        </div>

        {startedAt && (
          <button className="btn btn-primary btn-block" onClick={finish}>
            {kicks > 0 ? 'Finish & save' : 'Cancel'}
          </button>
        )}
      </div>

      <div className="card tip-card">
        <h3 className="card-title">💡 How to count</h3>
        <p>
          From week 28, pick a time when your baby is usually active (often after a meal). Lie on your left side and
          count every kick, roll or flutter. You should feel <b>10 movements within 2 hours</b>. If you notice fewer
          movements than usual, contact your doctor right away.
        </p>
      </div>

      <h3 className="section-title">Recent sessions</h3>
      {sessions.length === 0 ? (
        <Empty emoji="👣" title="No sessions yet" text="Your saved kick counts will appear here." />
      ) : (
        <div className="list">
          {sessions.map((s) => {
            const d = new Date(s.started_at)
            return (
              <div className="card kick-item" key={s.id}>
                <div className="kick-count">{s.kicks}</div>
                <div className="grow">
                  <strong>{d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
                  <p className="muted small">
                    {d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · {fmtDuration(s.duration_seconds)}
                  </p>
                </div>
                {s.kicks >= GOAL && <span className="chip chip-ok">Goal ✓</span>}
                <button className="icon-btn icon-btn-sm" onClick={() => remove(s.id)} aria-label="Delete">
                  <Icon name="trash" size={18} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
