import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { showNotification, startAlarm, stopAlarm, unlockAudio } from '../alarm.js'
import { WATER_GOAL, todayISO, waterSlots } from '../utils.js'

const CHECK_EVERY = 20 * 1000
const MED_SNOOZE_MIN = 10
const WATER_SNOOZE_MIN = 15
const WATER_LATE_MIN = 45 // opening the app long after a water time doesn't ring for it

const seenKey = (userId) => `maternity_reminded_${userId}`

// Per-day record of reminders already rung: 'done' or a snooze-until timestamp per medicine,
// plus the last water time rung and any water snooze.
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

const minutesSince = (hhmm, now) => {
  const [h, m] = hhmm.split(':').map(Number)
  return now.getHours() * 60 + now.getMinutes() - (h * 60 + m)
}

const changed = () => window.dispatchEvent(new Event('maternity-data'))

unlockAudio()

// While the app is open (or in the background on Android), rings an alarm at medicine
// and water times. Phone-level alarms when the app is closed come from the calendar export.
export default function Reminders() {
  const { user } = useAuth()
  const [banner, setBanner] = useState(null)
  const bannerRef = useRef(null)
  bannerRef.current = banner

  const dismiss = useCallback(() => {
    stopAlarm()
    setBanner(null)
  }, [])

  const ring = (msg) => {
    setBanner(msg)
    startAlarm()
    showNotification(msg.title, msg.body)
  }

  useEffect(() => {
    const check = async () => {
      if (bannerRef.current) return // an alarm is already showing
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
          ring({ kind: 'med', medId: m.id, key, title: `💊 Time for ${m.name}`, body: m.dose || 'Tap Taken once you have had it.' })
          return
        }
      }

      if (day.water < WATER_GOAL) {
        const lastDue = waterSlots(user).filter((s) => s <= hm).pop()
        const snooze = seen.waterSnooze
        const snoozeOver = typeof snooze === 'number' && Date.now() >= snooze
        const fresh = lastDue && seen.waterSlot !== lastDue && minutesSince(lastDue, now) <= WATER_LATE_MIN
        if (snoozeOver || (fresh && typeof snooze !== 'number')) {
          seen.waterSlot = lastDue || seen.waterSlot
          delete seen.waterSnooze
          writeSeen(user.id, seen)
          ring({
            kind: 'water',
            title: '💧 Neellu taagandi — time for water',
            body: `${day.water} of ${WATER_GOAL} glasses so far today.`,
          })
          return
        }
        if (fresh) seen.waterSlot = lastDue // a newer water time replaces an old snooze
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
  }, [user])

  useEffect(() => stopAlarm, [])

  const taken = async () => {
    await api.toggleMedicine(banner.medId, todayISO()).catch(() => {})
    changed()
    dismiss()
  }

  const drank = async () => {
    try {
      const day = await api.daily(todayISO())
      await api.setWater(todayISO(), day.water + 1)
      navigator.vibrate?.(30)
    } catch {
      /* ignore */
    }
    changed()
    dismiss()
  }

  const snooze = () => {
    const seen = readSeen(user.id, todayISO())
    if (banner.kind === 'water') seen.waterSnooze = Date.now() + WATER_SNOOZE_MIN * 60000
    else seen[banner.key] = Date.now() + MED_SNOOZE_MIN * 60000
    writeSeen(user.id, seen)
    dismiss()
  }

  if (!banner) return null
  return (
    <div className={`reminder reminder-alarm ${banner.kind === 'water' ? 'reminder-water' : ''}`} role="alert">
      <div className="reminder-top">
        <div className="grow">
          <strong>{banner.title}</strong>
          <p className="small">{banner.body}</p>
        </div>
        <button className="reminder-x" onClick={dismiss} aria-label="Dismiss">×</button>
      </div>
      <div className="reminder-actions">
        <button className="btn btn-sm btn-ghost" onClick={snooze}>
          Snooze {banner.kind === 'water' ? WATER_SNOOZE_MIN : MED_SNOOZE_MIN} min
        </button>
        {banner.kind === 'water' ? (
          <button className="btn btn-sm btn-water" onClick={drank}>Taagaanu 💧 +1</button>
        ) : (
          <button className="btn btn-sm btn-primary" onClick={taken}>Taken ✓</button>
        )}
      </div>
    </div>
  )
}
