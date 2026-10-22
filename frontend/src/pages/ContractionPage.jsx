import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import Icon from '../components/Icon.jsx'
import { Empty, PageHeader } from '../components/ui.jsx'
import { fmtDuration, fmtTime } from '../utils.js'

const HOUR = 60 * 60 * 1000

const secs = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 1000))

// Pattern over the last hour of finished contractions (list is newest first).
function lastHour(list) {
  const now = Date.now()
  const recent = list.filter((c) => c.end && now - Date.parse(c.start) <= HOUR)
  if (recent.length < 2) return { count: recent.length, recent }
  const durations = recent.map((c) => secs(c.start, c.end))
  const gaps = recent.slice(0, -1).map((c, i) => secs(recent[i + 1].start, c.start))
  const avgDuration = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
  const avgGap = Math.round(gaps.reduce((s, d) => s + d, 0) / gaps.length)
  const spanMin = (Date.parse(recent[0].start) - Date.parse(recent[recent.length - 1].start)) / 60000
  // 5-1-1: about every 5 minutes, lasting about 1 minute, for about 1 hour.
  const labour = avgGap <= 330 && avgDuration >= 50 && spanMin >= 45
  return { count: recent.length, avgDuration, avgGap, labour, recent }
}

export default function ContractionPage() {
  const [list, setList] = useState([])
  const [now, setNow] = useState(Date.now())

  const load = useCallback(() => api.contractions().then(setList).catch(() => {}), [])
  useEffect(() => {
    load()
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [load])

  const active = list.find((c) => !c.end)
  const last = list.find((c) => c.end)

  const toggle = async () => {
    navigator.vibrate?.(40)
    const stamp = new Date().toISOString()
    if (active) await api.updateContraction(active.id, { end: stamp })
    else await api.addContraction({ start: stamp })
    load()
  }

  const remove = async (id) => {
    await api.deleteContraction(id)
    load()
  }

  const clearAll = async () => {
    if (!confirm('Clear all timed contractions?')) return
    await api.clearContractions()
    load()
  }

  const stats = lastHour(list)
  const running = active ? Math.round((now - Date.parse(active.start)) / 1000) : 0
  const sinceLast = !active && list[0] ? Math.round((now - Date.parse(list[0].start)) / 1000) : null

  return (
    <div className="page">
      <PageHeader title="Contractions" subtitle="Time your contractions in labour" back />

      {stats.labour && (
        <div className="alert alert-strong">
          🏥 <b>Your contractions match the 5-1-1 pattern</b> — about every 5 minutes, lasting a minute, for an hour.
          Call your doctor and get ready to go to the hospital.
        </div>
      )}

      <div className="kick-panel">
        <div className="kick-stats">
          <div>
            <strong>{active ? fmtDuration(running) : last ? fmtDuration(secs(last.start, last.end)) : '00:00'}</strong>
            <span>{active ? 'lasting' : 'last length'}</span>
          </div>
          <div>
            <strong>{sinceLast !== null ? fmtDuration(Math.min(sinceLast, 5999)) : '—'}</strong>
            <span>since last began</span>
          </div>
        </div>

        <button className={`kick-btn contraction-btn ${active ? 'running' : ''}`} onClick={toggle}>
          {active && <span className="kick-ripple pulse-loop" />}
          <Icon name={active ? 'close' : 'clock'} size={52} stroke={1.8} />
          <span>{active ? 'Tap when it ends' : 'Tap when it starts'}</span>
        </button>

        <div className="stats stats-3 inner">
          <div className="stat">
            <strong>{stats.count}</strong>
            <span>in last hour</span>
          </div>
          <div className="stat">
            <strong>{stats.avgDuration ? fmtDuration(stats.avgDuration) : '—'}</strong>
            <span>avg length</span>
          </div>
          <div className="stat">
            <strong>{stats.avgGap ? fmtDuration(Math.min(stats.avgGap, 5999)) : '—'}</strong>
            <span>avg every</span>
          </div>
        </div>
      </div>

      <div className="card tip-card">
        <h3 className="card-title">💡 When to go to the hospital</h3>
        <p>
          Go when contractions come <b>every 5 minutes, last 1 minute, for 1 hour</b> (5-1-1). Go right away if your
          water breaks, you have bleeding, the baby moves less, or you have contractions <b>before 37 weeks</b>.
          Practice (Braxton Hicks) contractions are irregular and fade when you rest or change position.
        </p>
      </div>

      <div className="section-row">
        <h3 className="section-title">History</h3>
        {list.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={clearAll}>Clear all</button>
        )}
      </div>
      {list.length === 0 ? (
        <Empty emoji="⏱️" title="No contractions timed" text="Tap the button when a contraction starts and again when it ends." />
      ) : (
        <div className="list">
          {list.map((c, i) => {
            const prev = list[i + 1]
            return (
              <div className="card kick-item" key={c.id}>
                <div className="kick-count contraction-count">{c.end ? fmtDuration(secs(c.start, c.end)) : '…'}</div>
                <div className="grow">
                  <strong>{fmtTime(c.start)}</strong>
                  <p className="muted small">
                    {c.end ? 'length' : 'in progress'}
                    {prev ? ` · ${fmtDuration(Math.min(secs(prev.start, c.start), 5999))} after previous` : ''}
                  </p>
                </div>
                <button className="icon-btn icon-btn-sm" onClick={() => remove(c.id)} aria-label="Delete">
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
