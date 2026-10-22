import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { showNotification, startAlarm, stopAlarm, unlockAudio } from '../alarm.js'
import { WATER_GOAL, todayISO } from '../utils.js'

const CHECK_EVERY = 20 * 1000
const SNOOZE_MIN = 10
const WATER_HOURS = [8, 21] // only remind about water between 8 am and 9 pm

const seenKey = (userId) => `maternity_reminded_${userId}`

// Per-day record of reminders already shown: 'done', or a snooze-until timestamp.
function readSeen(userId, today) {
  try {
    const seen = JSON.parse(localStorage.getItem(seenKey(userId)) || '{}')
    return seen.date === today ? seen : { date: today }
  } catch {
    return { date: today }
  }
}

function writeSeen(userId, seen) {
  try {
    localStorage.setItem(seenKey(userId), JSON.stringify(seen))
  } catch {
    /* ignore */
  }
}

unlockAudio()

// While the app is open (or in the background on Android), rings an alarm at medicine
// times and nudges about water. Phone-level alarms come from the calendar export.
export default function Reminders() {
  const { user } = useAuth()
  const [banner, setBanner] = useState(null)
  const bannerRef = useRef(null)
  bannerRef.current = banner

  const dismiss = useCallback(() => {
    stopAlarm()
    setBanner(null)
  }, [])

  useEffect(() => {
    const check = async () => {
      if (bannerRef.current?.medId) return // an alarm is already ringing
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
        const due = m.time && m.time <= hm && !day.taken.includes(m.id)
        const waiting = seen[key] === 'done' || (typeof seen[key] === 'number' && Date.now() < seen[key])
        if (due && !waiting) {
          seen[key] = 'done'
          writeSeen(user.id, seen)
          const msg = { medId: m.id, key, title: `💊 Time for ${m.name}`, body: m.dose || 'Tap Taken once you have had it.' }
          setBanner(msg)
          startAlarm()
          showNotification(msg.title, msg.body)
          return
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
          navigator.vibrate?.([200, 100, 200])
          showNotification(msg.title, msg.body)
        }
      }
      writeSeen(user.id, seen)
    }

    check()
    const t = setInterval(check, CHECK_EVERY)
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user.id, user.water_reminder])

  useEffect(() => stopAlarm, [])

  const taken = async () => {
    await api.toggleMedicine(banner.medId, todayISO()).catch(() => {})
    window.dispatchEvent(new Event('maternity-data'))
    dismiss()
  }

  const snooze = () => {
    const seen = readSeen(user.id, todayISO())
    seen[banner.key] = Date.now() + SNOOZE_MIN * 60000
    writeSeen(user.id, seen)
    dismiss()
  }

  if (!banner) return null
  return (
    <div className={`reminder ${banner.medId ? 'reminder-alarm' : ''}`} role="alert">
      <div className="reminder-top">
        <div className="grow">
          <strong>{banner.title}</strong>
          <p className="small">{banner.body}</p>
        </div>
        <button className="reminder-x" onClick={dismiss} aria-label="Dismiss">×</button>
      </div>
      {banner.medId ? (
        <div className="reminder-actions">
          <button className="btn btn-sm btn-ghost" onClick={snooze}>Snooze {SNOOZE_MIN} min</button>
          <button className="btn btn-sm btn-primary" onClick={taken}>Taken ✓</button>
        </div>
      ) : (
        <div className="reminder-actions">
          <Link to="/daily" className="btn btn-sm btn-primary" onClick={dismiss}>Open</Link>
        </div>
      )}
    </div>
  )
}
