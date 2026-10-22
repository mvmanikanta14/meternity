import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api.js'
import { ErrorBox, Loader, PageHeader } from '../components/ui.jsx'
import { TRIMESTER_LABEL } from '../utils.js'

export default function WeeksPage() {
  const location = useLocation()
  const [weeks, setWeeks] = useState([])
  const [current, setCurrent] = useState(null)
  const [selected, setSelected] = useState(location.state?.week || null)
  const [error, setError] = useState('')
  const stripRef = useRef(null)

  useEffect(() => {
    Promise.all([api.weeks(), api.status()])
      .then(([list, status]) => {
        setWeeks(list)
        setCurrent(status.week)
        setSelected((s) => s || status.week)
      })
      .catch((e) => setError(e.message))
  }, [])

  const firstScroll = useRef(true)
  useEffect(() => {
    const strip = stripRef.current
    const el = strip?.querySelector('.week-chip.active')
    if (!el) return
    const left = el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2
    strip.scrollTo({ left, behavior: firstScroll.current ? 'auto' : 'smooth' })
    firstScroll.current = false
  }, [selected, weeks.length])

  if (error) return <div className="page"><ErrorBox message={error} /></div>
  if (!weeks.length) return <Loader />

  const w = weeks[selected - 1]

  return (
    <div className="page">
      <PageHeader title="Week by week" subtitle="Follow your baby's growth" />

      <div className="week-strip" ref={stripRef}>
        {weeks.map((wk) => (
          <button
            key={wk.week}
            className={`week-chip t${wk.trimester} ${wk.week === selected ? 'active' : ''} ${wk.week === current ? 'current' : ''}`}
            onClick={() => setSelected(wk.week)}
          >
            <span className="wc-num">{wk.week}</span>
            <span className="wc-emoji">{wk.emoji}</span>
          </button>
        ))}
      </div>

      <div className={`week-hero t${w.trimester}`} key={w.week}>
        <div className="week-hero-emoji">{w.emoji}</div>
        <div>
          <p className="label-muted">
            Week {w.week} · {TRIMESTER_LABEL[w.trimester]}
            {w.week === current && <span className="chip chip-white">You are here</span>}
          </p>
          <h2>{w.size}</h2>
          <div className="baby-metrics">
            <span>📏 {w.length}</span>
            <span>⚖️ {w.weight}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">👶 Baby's development</h3>
        <p>{w.baby}</p>
      </div>
      <div className="card">
        <h3 className="card-title">🤱 Changes in your body</h3>
        <p>{w.mom}</p>
      </div>
      <div className="card tip-card">
        <h3 className="card-title">💡 Tip</h3>
        <p>{w.tip}</p>
      </div>

      <div className="week-nav">
        <button className="btn btn-ghost" disabled={selected <= 1} onClick={() => setSelected(selected - 1)}>
          ← Week {Math.max(1, selected - 1)}
        </button>
        <button className="btn btn-ghost" disabled={selected >= 40} onClick={() => setSelected(selected + 1)}>
          Week {Math.min(40, selected + 1)} →
        </button>
      </div>
    </div>
  )
}
