// Builds the WhatsApp message that tells her husband how she is feeling.
import { MOODS } from './utils.js'

// What he can do, in Telugu (English letters) so it reads naturally on WhatsApp.
const TIPS = {
  sad: 'Aame konchem baadha ga undi. Kasepu aame tho matladandi, daggara undandi 🤗',
  anxious: 'Aame tension / bhayam ga undi. Dhairyam cheppandi, avasaramaite doctor tho matladandi 🙏',
  tired: 'Aame alasipoyindi. Intlo pani lo help cheyandi, rest teeskomani cheppandi 🛌',
  sick: 'Aame ki vikaram / noppi ga undi. Neellu, light food ivvandi. Ekkuva ayithe doctor ki call cheyandi 🩺',
  happy: 'Aame happy ga undi! Mee prema ni chupinchandi 😊',
  calm: 'Aame prashantam ga undi 😌',
}

export const NEEDS_CARE = ['sad', 'anxious', 'tired', 'sick']

export function partnerMessage({ name, mood, text, week }) {
  const m = MOODS.find((x) => x.key === mood)
  const lines = [
    `💗 ${name} mood update${week ? ` (Week ${week})` : ''}`,
    `${m?.emoji || ''} ${m?.label || mood}`,
  ]
  if (text?.trim()) lines.push('', `"${text.trim().slice(0, 300)}"`)
  if (TIPS[mood]) lines.push('', TIPS[mood])
  lines.push('', '— Maternity app')
  return lines.join('\n')
}

// ---------- automatic alerts (ntfy) ----------
// Her phone publishes to a private ntfy topic; his phone runs the free ntfy app subscribed to it.
// Anyone who knows the topic name can read it, so it is long and random.

const NTFY = 'https://ntfy.sh'
const QUEUE_KEY = 'maternity_partner_queue'

const TAGS = { sad: 'cry', anxious: 'worried', tired: 'sleeping', sick: 'nauseated_face', happy: 'blush', calm: 'relieved' }

export const topicUrl = (topic) => `${NTFY}/${topic}`

export function partnerAlert({ name, mood, text, week }) {
  const m = MOODS.find((x) => x.key === mood)
  const title = m ? `${m.emoji} ${name}: ${m.label}${week ? ` · Week ${week}` : ''}` : `💬 ${name} shared a mood update`
  const parts = []
  if (text?.trim()) parts.push(`"${text.trim().slice(0, 400)}"`)
  if (TIPS[mood]) parts.push(TIPS[mood])
  return { title, message: parts.join('\n\n') || 'Mood update', mood }
}

async function publish(topic, alert) {
  const res = await fetch(NTFY, {
    method: 'POST',
    body: JSON.stringify({
      topic,
      title: alert.title,
      message: alert.message,
      tags: alert.mood && TAGS[alert.mood] ? [TAGS[alert.mood]] : ['heart'],
      priority: NEEDS_CARE.includes(alert.mood) ? 4 : 3,
    }),
  })
  if (!res.ok) throw new Error(`Alert service returned ${res.status}`)
}

const readQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}
const writeQueue = (q) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-20)))
  } catch {
    /* ignore */
  }
}

// Sends now; if offline, keeps it and retries when the phone is back online.
export async function notifyPartner(topic, alert) {
  try {
    await publish(topic, alert)
    return true
  } catch {
    writeQueue([...readQueue(), { topic, alert }])
    return false
  }
}

export async function flushPartnerQueue() {
  const queue = readQueue()
  if (!queue.length) return
  const left = []
  for (const item of queue) {
    try {
      await publish(item.topic, item.alert)
    } catch {
      left.push(item)
    }
  }
  writeQueue(left)
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', flushPartnerQueue)
  setTimeout(flushPartnerQueue, 3000)
}

// Setup steps she can forward to him on WhatsApp.
export function setupMessage(topic, name) {
  return [
    `💗 ${name} mood alerts setup`,
    '',
    '1. Install the free "ntfy" app (Play Store / App Store).',
    '2. Open it → tap + → Topic name:',
    topic,
    '   (Server: ntfy.sh — leave as default) → Subscribe.',
    '',
    `Or open this link: ${topicUrl(topic)}`,
    '',
    `Ika ${name} mood update ayinappudu mee phone ki notification vastundi.`,
  ].join('\n')
}

// 10-digit Indian numbers get the +91 country code; with no number WhatsApp lets her pick a chat.
export function whatsappUrl(phone, message) {
  let digits = (phone || '').replace(/\D/g, '')
  if (digits.length === 10) digits = `91${digits}`
  if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
