import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { WATER_GOAL, todayISO } from '../utils.js'

const CHECK_EVERY = 30 * 1000
const WATER_HOURS = [8, 21] // only remind about water between 8 am and 9 pm

const seenKey = (userId) => `maternity_reminded_${userId}`

function readSeen(userId, today) {
  try {
    const seen = JSON.parse(localStorage.getItem(seenKey(userId)) || '{}')
    return seen.date === today ? seen : { date: today }
  } catch {
    return { date: today }
  }
}

function notify(title, body) {
  navigator.vibrate?.([120, 60, 120])
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return
  try {
    new Notification(title, { body, icon: '/icon.svg' })
  } catch {
    navigator.serviceWorker?.ready.then((reg) => reg.showNotification(title, { body, icon: '/icon.svg' })).catch(() => {})
  }
}

// Checks medicine times and the water interval while the app is open, and shows a banner.
export default function Reminders() {
  const { user } = useAuth()
  const [banner, setBanner] = useState(null)

  useEffect(() => {
    const check = async () => {
      const today = todayISO()
      const now = new Date()
      const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const seen = readSeen(user.id, today)
      let day
      try {
        day = await api.daily(today)
      } catch {
        return
      }

      for (const m of day.medicines) {
        const key = `med${m.id}`
        if (m.time && m.time <= hm && !day.taken.includes(m.id) && !seen[key]) {
          seen[key] = 1
          const msg = { title: `💊 Time for ${m.name}`, body: m.dose || 'Tick it off once you have taken it.' }
          setBanner(msg)
          notify(msg.title, msg.body)
          break
        }
      }

      const every = user.water_reminder || 0
      const hour = now.getHours()
      if (every && day.water < WATER_GOAL && hour >= WATER_HOURS[0] && hour < WATER_HOURS[1]) {
        if (!seen.water) seen.water = Date.now()
        else if (Date.now() - seen.water >= every * 60000) {
          seen.water = Date.now()
          const msg = { title: '💧 Time for a glass of water', body: `${day.water} of ${WATER_GOAL} glasses so far today.` }
          setBanner(msg)
          notify(msg.title, msg.body)
        }
      }

      try {
        localStorage.setItem(seenKey(user.id), JSON.stringify(seen))
      } catch {
        /* ignore */
      }
    }

    check()
    const t = setInterval(check, CHECK_EVERY)
    return () => clearInterval(t)
  }, [user.id, user.water_reminder])

  if (!banner) return null
  return (
    <div className="reminder" role="status">
      <div className="grow">
        <strong>{banner.title}</strong>
        <p className="small">{banner.body}</p>
      </div>
      <Link to="/daily" className="btn btn-sm btn-primary" onClick={() => setBanner(null)}>Open</Link>
      <button className="reminder-x" onClick={() => setBanner(null)} aria-label="Dismiss">×</button>
    </div>
  )
}
