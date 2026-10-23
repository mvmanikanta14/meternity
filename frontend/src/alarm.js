// Alarm sound + vibration for reminders, and calendar exports so the phone itself
// rings at medicine times even when the app is closed.

let ctx = null
let loop = null

// Browsers only allow sound after a tap, so create the audio context on the first one.
export function unlockAudio() {
  const unlock = () => {
    try {
      ctx ??= new (window.AudioContext || window.webkitAudioContext)()
      ctx.resume()
    } catch {
      /* no audio support */
    }
  }
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}

function beep(at, freq) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.5, at + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + 0.3)
}

function ring() {
  navigator.vibrate?.([400, 200, 400, 200, 400])
  if (!ctx || ctx.state !== 'running') return
  const t = ctx.currentTime
  ;[0, 0.32, 0.64].forEach((d, i) => beep(t + d, i === 2 ? 1175 : 880))
}

// Rings every 2 seconds until stopped, for at most a minute.
export function startAlarm() {
  stopAlarm()
  ring()
  let count = 0
  loop = setInterval(() => (++count >= 30 ? stopAlarm() : ring()), 2000)
}

export function stopAlarm() {
  clearInterval(loop)
  loop = null
  navigator.vibrate?.(0)
}

// ---------- system notifications ----------

export async function showNotification(title, body) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const options = { body, icon: '/icon.svg', badge: '/icon.svg', tag: title, vibrate: [400, 200, 400], requireInteraction: true, data: { url: '/daily' } }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) return reg.showNotification(title, options)
    new Notification(title, options)
  } catch {
    /* notifications unavailable */
  }
}

// ---------- calendar alarms ----------

const pad = (n) => String(n).padStart(2, '0')
const compact = (iso) => iso.replaceAll('-', '')
const icsText = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')

const medTitle = (m) => `💊 Take ${m.name}${m.dose ? ` (${m.dose})` : ''}`

function startDay(time) {
  const now = new Date()
  const [h, min] = time.split(':').map(Number)
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min)
  if (first < now) first.setDate(first.getDate() + 1)
  return `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`
}

// "YYYYMMDDTHHMMSS" five minutes after the start, rolling into the next day if needed.
function endStamp(dayIso, time) {
  const [y, mo, d] = dayIso.split('-').map(Number)
  const [h, m] = time.split(':').map(Number)
  const end = new Date(y, mo - 1, d, h, m + 5)
  return `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`
}

// Opens Google Calendar with a daily repeating event at the medicine time (best on Android).
export function googleCalendarUrl(m, untilIso) {
  const first = startDay(m.time)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: medTitle(m),
    dates: `${compact(first)}T${m.time.replace(':', '')}00/${endStamp(first, m.time)}`,
    details: 'Medicine reminder from the Maternity app.',
    recur: `RRULE:FREQ=DAILY${untilIso ? `;UNTIL=${compact(untilIso)}T235959` : ''}`,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

// One calendar file with every timed medicine and water time, each repeating daily with an
// alert at that time.
export function alarmsIcs({ meds = [], water = [], untilIso }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const event = (uid, time, title, description) => {
    const first = startDay(time)
    return [
      'BEGIN:VEVENT',
      `UID:${uid}@maternity`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${compact(first)}T${time.replace(':', '')}00`,
      `DTEND:${endStamp(first, time)}`,
      `RRULE:FREQ=DAILY${untilIso ? `;UNTIL=${compact(untilIso)}T235959` : ''}`,
      `SUMMARY:${icsText(title)}`,
      `DESCRIPTION:${icsText(description)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsText(title)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    ].join('\r\n')
  }
  const events = [
    ...meds
      .filter((m) => m.time)
      .map((m) => event(`maternity-med-${m.id}-${m.time.replace(':', '')}`, m.time, medTitle(m), 'Medicine reminder from the Maternity app.')),
    ...water.map((t) =>
      event(`maternity-water-${t.replace(':', '')}`, t, '💧 Neellu taagandi — drink a glass of water', 'Water reminder from the Maternity app.'),
    ),
  ]
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Maternity//Medicine reminders//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR', ''].join('\r\n')
}
