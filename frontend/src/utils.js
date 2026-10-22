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
