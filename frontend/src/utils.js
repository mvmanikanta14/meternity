export const todayISO = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

const parse = (iso) => new Date(`${iso}T00:00:00`)

export const fmtDate = (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  iso ? parse(iso).toLocaleDateString('en-IN', opts) : '—'

export const fmtShort = (iso) => fmtDate(iso, { day: 'numeric', month: 'short' })

export const fmtWeekday = (iso) => fmtDate(iso, { weekday: 'short', day: 'numeric', month: 'short' })

export const daysUntil = (iso) => Math.round((parse(iso) - parse(todayISO())) / 86400000)

// Pregnancy week (1-40) on a given date, counted from the last period.
export const weekOn = (lmp, iso) =>
  Math.max(1, Math.min(40, Math.floor(Math.round((parse(iso) - parse(lmp)) / 86400000) / 7) + 1))

export const WATER_GOAL = 10

export const fmtTime = (stamp) => new Date(stamp).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

export const fmtTime24 = (hhmm) => {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export const fmtSize = (bytes) =>
  bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

export const fmtDuration = (sec) => {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export const TRIMESTER_LABEL = { 1: 'First trimester', 2: 'Second trimester', 3: 'Third trimester' }

export const MOODS = [
  { key: 'happy', emoji: '😊', label: 'Happy' },
  { key: 'calm', emoji: '😌', label: 'Calm' },
  { key: 'tired', emoji: '😴', label: 'Tired' },
  { key: 'anxious', emoji: '😟', label: 'Anxious' },
  { key: 'sad', emoji: '😢', label: 'Low' },
  { key: 'sick', emoji: '🤢', label: 'Nauseous' },
]

export const SYMPTOMS = [
  'Nausea', 'Fatigue', 'Headache', 'Back pain', 'Heartburn', 'Swelling',
  'Cramps', 'Insomnia', 'Cravings', 'Dizziness', 'Constipation', 'Mood swings',
]

export const moodEmoji = (key) => MOODS.find((m) => m.key === key)?.emoji || ''
