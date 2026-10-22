import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icon.jsx'
import { ErrorBox, Loader, ProgressRing } from '../components/ui.jsx'
import { TRIMESTER_LABEL, WATER_GOAL, daysUntil, fmtDate, fmtWeekday, greeting, todayISO } from '../utils.js'

const TOOLS = [
  { to: '/daily', emoji: '💊', label: 'Medicines & water' },
  { to: '/reports', emoji: '🩻', label: 'Scan reports' },
  { to: '/contractions', emoji: '⏱️', label: 'Contractions' },
  { to: '/bag', emoji: '🎒', label: 'Hospital bag' },
  { to: '/names', emoji: '📝', label: 'Baby names' },
  { to: '/backup', emoji: '💾', label: 'Backup' },
]

export default function HomePage() {
  const { user } = useAuth()
  const [status, setStatus] = useState(null)
  const [nextVisit, setNextVisit] = useState(null)
  const [today, setToday] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.status().then(setStatus).catch((e) => setError(e.message))
    api.daily(todayISO()).then(setToday).catch(() => {})
    api
      .appointments()
      .then((list) => setNextVisit(list.find((a) => !a.done && a.date >= todayISO()) || null))
      .catch(() => {})
  }, [user.lmp_date])

  if (error) return <div className="page"><ErrorBox message={error} /></div>
  if (!status) return <Loader />

  const w = status.week_info
  const firstName = user.name.split(' ')[0]

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-top">
          <div>
            <p className="hero-greet">{greeting()},</p>
            <h1 className="hero-name">{firstName} 🌸</h1>
          </div>
          <Link to="/profile" className="avatar" aria-label="Profile">
            {firstName[0]?.toUpperCase()}
          </Link>
        </div>

        <div className="hero-ring">
          <ProgressRing value={status.progress} size={210} stroke={14}>
            <span className="ring-emoji">{w.emoji}</span>
            <span className="ring-week">Week {status.week}</span>
            <span className="ring-sub">
              {status.day > 0 ? `+ ${status.day} day${status.day > 1 ? 's' : ''}` : 'just started'}
            </span>
          </ProgressRing>
        </div>

        <div className="hero-pills">
          <span className="pill-glass">{TRIMESTER_LABEL[status.trimester]}</span>
          <span className="pill-glass">Month {status.month} of 9</span>
        </div>
      </section>

      <div className="page home-body">
        <div className="stats">
          <div className="stat">
            <strong>{status.overdue ? '0' : status.days_left}</strong>
            <span>days to go</span>
          </div>
          <div className="stat">
            <strong>{Math.round(status.progress * 100)}%</strong>
            <span>completed</span>
          </div>
          <div className="stat">
            <strong>{fmtDate(status.due_date, { day: 'numeric', month: 'short' })}</strong>
            <span>due date</span>
          </div>
        </div>

        {status.overdue && (
          <div className="alert">
            You've passed your due date. Please stay in close touch with your doctor. 💗
          </div>
        )}

        <Link to="/weeks" state={{ week: status.week }} className="card baby-card">
          <div className="baby-emoji">{w.emoji}</div>
          <div className="baby-text">
            <p className="label-muted">Your baby is the size of a</p>
            <h2>{w.size}</h2>
            <div className="baby-metrics">
              <span>📏 {w.length}</span>
              <span>⚖️ {w.weight}</span>
            </div>
          </div>
          <Icon name="chevron" className="chev" />
        </Link>

        <div className="card">
          <h3 className="card-title">👶 Baby this week</h3>
          <p>{w.baby}</p>
        </div>

        <div className="card tip-card">
          <h3 className="card-title"><Icon name="sparkle" size={18} /> Tip of the week</h3>
          <p>{w.tip}</p>
        </div>

        <h3 className="section-title">Quick actions</h3>
        <div className="quick">
          <Link to="/kicks" className="quick-item q-pink">
            <Icon name="foot" size={26} />
            <span>Kick counter</span>
          </Link>
          <Link to="/health" state={{ openLog: true }} className="quick-item q-violet">
            <Icon name="heart" size={26} />
            <span>Log today</span>
          </Link>
          <Link to="/visits" state={{ openAdd: true }} className="quick-item q-peach">
            <Icon name="calendar" size={26} />
            <span>Add visit</span>
          </Link>
        </div>

        {today && (
          <Link to="/daily" className="card today-card">
            <div className="today-item">
              <span className="today-emoji">💊</span>
              <div>
                <strong>{today.medicines.length ? `${today.taken.length}/${today.medicines.length}` : 'Add'}</strong>
                <span>medicines</span>
              </div>
            </div>
            <div className="today-item">
              <span className="today-emoji">💧</span>
              <div>
                <strong>{today.water}/{WATER_GOAL}</strong>
                <span>glasses</span>
              </div>
            </div>
            <Icon name="chevron" className="chev" />
          </Link>
        )}

        <h3 className="section-title">All tools</h3>
        <div className="tools">
          {TOOLS.map((t) => (
            <Link key={t.to} to={t.to} className="tool">
              <span className="tool-emoji">{t.emoji}</span>
              <span>{t.label}</span>
            </Link>
          ))}
        </div>

        <h3 className="section-title">Next appointment</h3>
        {nextVisit ? (
          <Link to="/visits" className="card visit-mini">
            <div className="date-badge">
              <strong>{new Date(`${nextVisit.date}T00:00:00`).getDate()}</strong>
              <span>{fmtDate(nextVisit.date, { month: 'short' })}</span>
            </div>
            <div>
              <h4>{nextVisit.title}</h4>
              <p className="muted">
                {fmtWeekday(nextVisit.date)}
                {nextVisit.time ? ` · ${nextVisit.time}` : ''}
              </p>
            </div>
            <span className="chip chip-soft">
              {daysUntil(nextVisit.date) === 0 ? 'Today' : `in ${daysUntil(nextVisit.date)}d`}
            </span>
          </Link>
        ) : (
          <Link to="/visits" state={{ openAdd: true }} className="card card-dashed">
            <Icon name="plus" /> Schedule your next check-up
          </Link>
        )}

        <div className="card">
          <h3 className="card-title">🤱 How you may feel</h3>
          <p>{w.mom}</p>
        </div>

        <p className="disclaimer">
          This app is for information only and does not replace medical advice. Always consult your doctor.
        </p>
      </div>
    </div>
  )
}
