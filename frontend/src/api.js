// All app data lives in this browser's localStorage — there is no backend.
// The `api` object keeps the same async shape the pages already use.
import { WEEKS, getWeek } from './weekData.js'

const DB_KEY = 'maternity_data'
const TOKEN_KEY = 'maternity_token'
const PREGNANCY_DAYS = 280
const DAY_MS = 24 * 60 * 60 * 1000

// Built-in account so the app can be logged into on a fresh device.
const DEFAULT_USER = { name: 'Prasu', username: 'prasu', password: '123456' }

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

// Ask the browser not to clear our data when it runs low on space.
navigator.storage?.persist?.().catch(() => {})

// ---------- storage ----------

const emptyDb = () => ({
  users: [],
  sessions: {},
  health_logs: [],
  appointments: [],
  kick_sessions: [],
  next_id: 1,
})

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return { ...emptyDb(), ...JSON.parse(raw) }
  } catch {
    /* corrupt or unavailable storage: start fresh */
  }
  return emptyDb()
}

function saveDb(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    throw new ApiError('Could not save — browser storage is full or blocked', 507)
  }
}

// Runs fn against the stored data and saves it afterwards when `write` is set.
async function tx(fn, { write = false } = {}) {
  const db = loadDb()
  await ensureDefaultUser(db)
  const result = await fn(db)
  if (write || db._dirty) {
    delete db._dirty
    saveDb(db)
  }
  return result
}

const nextId = (db) => db.next_id++

const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

const newToken = () =>
  Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')

// ---------- passwords ----------

async function hashPassword(password, salt = newToken()) {
  const input = `${salt}:${password}`
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    const hex = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
    return `sha256$${salt}$${hex}`
  }
  // crypto.subtle is missing on plain-http pages (e.g. phone on LAN); use FNV-1a there.
  let h = 0x811c9dc5
  for (const ch of input) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193) >>> 0
  return `fnv$${salt}$${h.toString(16)}`
}

async function verifyPassword(password, stored) {
  const salt = stored.split('$')[1]
  return (await hashPassword(password, salt)) === stored
}

async function ensureDefaultUser(db) {
  if (db.users.some((u) => u.username === DEFAULT_USER.username)) return
  db.users.push({
    id: nextId(db),
    name: DEFAULT_USER.name,
    username: DEFAULT_USER.username,
    password_hash: await hashPassword(DEFAULT_USER.password),
    lmp_date: null,
    blood_group: null,
    doctor_name: null,
    hospital: null,
    phone: null,
    created_at: nowStamp(),
  })
  db._dirty = true
}

// ---------- dates ----------

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const isoToUtc = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const isIsoDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(isoToUtc(v))
const addDays = (iso, days) => new Date(isoToUtc(iso) + days * DAY_MS).toISOString().slice(0, 10)
const daysBetween = (fromIso, toIso) => Math.round((isoToUtc(toIso) - isoToUtc(fromIso)) / DAY_MS)

// ---------- helpers ----------

const PUBLIC_USER_FIELDS = ['id', 'name', 'username', 'lmp_date', 'blood_group', 'doctor_name', 'hospital', 'phone']

function publicUser(user) {
  const data = Object.fromEntries(PUBLIC_USER_FIELDS.map((k) => [k, user[k] ?? null]))
  data.due_date = user.lmp_date ? addDays(user.lmp_date, PREGNANCY_DAYS) : null
  return data
}

function pregnancyStatus(lmp) {
  const today = todayIso()
  const due = addDays(lmp, PREGNANCY_DAYS)
  const elapsed = daysBetween(lmp, today)
  const week = Math.floor(elapsed / 7) + 1
  const day = ((elapsed % 7) + 7) % 7
  const clampedWeek = Math.max(1, Math.min(40, week))
  return {
    lmp_date: lmp,
    due_date: due,
    days_elapsed: Math.max(0, elapsed),
    days_left: Math.max(0, daysBetween(today, due)),
    week: clampedWeek,
    day: week >= 1 && week <= 40 ? day : 0,
    weeks_completed: Math.max(0, Math.min(40, Math.floor(elapsed / 7))),
    trimester: clampedWeek <= 13 ? 1 : clampedWeek <= 27 ? 2 : 3,
    progress: Math.round(Math.max(0, Math.min(1, elapsed / PREGNANCY_DAYS)) * 10000) / 10000,
    month: Math.max(1, Math.min(9, Math.floor(elapsed / 30) + 1)),
    overdue: elapsed > PREGNANCY_DAYS,
    week_info: getWeek(clampedWeek),
  }
}

function currentUser(db) {
  const userId = db.sessions[getToken()]
  const user = userId && db.users.find((u) => u.id === userId)
  if (!user) throw new ApiError('Please log in again', 401)
  return user
}

function ownedOr404(list, id, userId) {
  const item = list.find((r) => r.id === Number(id) && r.user_id === userId)
  if (!item) throw new ApiError('Not found', 404)
  return item
}

const fail = (msg) => {
  throw new ApiError(msg, 400)
}

const blank = (v) => v === undefined || v === null || v === ''

function checkNumber(v, label, { min, max, integer = false, inclusive = false }) {
  if (blank(v)) return null
  const n = Number(v)
  const ok = inclusive ? n >= min && n <= max : n > min && n < max
  if (Number.isNaN(n) || !ok || (integer && !Number.isInteger(n))) fail(`${label} must be between ${min} and ${max}`)
  return n
}

function checkText(v, label, max) {
  if (blank(v)) return null
  const s = String(v)
  if (s.length > max) fail(`${label} can be at most ${max} characters`)
  return s
}

const sortDesc = (key) => (a, b) => (a[key] < b[key] ? 1 : a[key] > b[key] ? -1 : b.id - a.id)
const copy = (rows) => rows.map((r) => ({ ...r, ...(r.symptoms ? { symptoms: [...r.symptoms] } : {}) }))

// ---------- auth ----------

async function startSession(db, user) {
  const token = newToken()
  db.sessions[token] = user.id
  return { token, user: publicUser(user) }
}

const register = (body) =>
  tx(
    async (db) => {
      const name = (body.name || '').trim()
      const username = (body.username || '').trim().toLowerCase()
      const password = body.password || ''
      if (!name || name.length > 80) fail('Please enter your name')
      if (!/^[a-z0-9._]{3,30}$/.test(username))
        fail('Username can use only letters, numbers, dot and underscore (3-30 characters)')
      if (password.length < 6 || password.length > 128) fail('Password must be at least 6 characters')
      if (db.users.some((u) => u.username === username)) fail('This username is already taken')

      const user = {
        id: nextId(db),
        name,
        username,
        password_hash: await hashPassword(password),
        lmp_date: null,
        blood_group: null,
        doctor_name: null,
        hospital: null,
        phone: null,
        created_at: nowStamp(),
      }
      db.users.push(user)
      return startSession(db, user)
    },
    { write: true },
  )

const login = (body) =>
  tx(
    async (db) => {
      const username = (body.username || '').trim().toLowerCase()
      const user = db.users.find((u) => u.username === username)
      if (!user || !(await verifyPassword(body.password || '', user.password_hash)))
        throw new ApiError('Incorrect username or password', 401)
      return startSession(db, user)
    },
    { write: true },
  )

const logout = () =>
  tx(
    (db) => {
      delete db.sessions[getToken()]
      return { ok: true }
    },
    { write: true },
  )

// ---------- profile ----------

const updateMe = (body) =>
  tx(
    (db) => {
      const user = currentUser(db)
      const updates = {}
      const today = todayIso()

      let lmp = body.lmp_date
      if (!blank(body.due_date) && blank(lmp)) {
        if (!isIsoDate(body.due_date)) fail('Please enter a valid date')
        lmp = addDays(body.due_date, -PREGNANCY_DAYS)
      }
      if ('lmp_date' in body || !blank(lmp)) {
        if (blank(lmp)) updates.lmp_date = null
        else {
          if (!isIsoDate(lmp)) fail('Please enter a valid date')
          if (lmp > today) fail("Last period date can't be in the future")
          if (daysBetween(lmp, today) > 310) fail('That date is more than 44 weeks ago')
          updates.lmp_date = lmp
        }
      }
      if ('name' in body && !blank(body.name) && String(body.name).trim())
        updates.name = checkText(String(body.name).trim(), 'Name', 80)
      if ('blood_group' in body) updates.blood_group = checkText(body.blood_group, 'Blood group', 5)
      if ('doctor_name' in body) updates.doctor_name = checkText(body.doctor_name, 'Doctor name', 80)
      if ('hospital' in body) updates.hospital = checkText(body.hospital, 'Hospital', 120)
      if ('phone' in body) updates.phone = checkText(body.phone, 'Phone', 20)

      Object.assign(user, updates)
      return publicUser(user)
    },
    { write: true },
  )

// ---------- health logs ----------

const addLog = (body) =>
  tx(
    (db) => {
      const user = currentUser(db)
      if (!isIsoDate(body.log_date)) fail('Please enter a valid date')
      const log = {
        id: nextId(db),
        user_id: user.id,
        log_date: body.log_date,
        weight: checkNumber(body.weight, 'Weight', { min: 20, max: 250 }),
        systolic: checkNumber(body.systolic, 'Systolic BP', { min: 50, max: 250, integer: true }),
        diastolic: checkNumber(body.diastolic, 'Diastolic BP', { min: 30, max: 180, integer: true }),
        water_glasses: checkNumber(body.water_glasses, 'Water', { min: 0, max: 30, integer: true, inclusive: true }),
        mood: checkText(body.mood, 'Mood', 20),
        symptoms: Array.isArray(body.symptoms) ? body.symptoms.map(String) : [],
        notes: checkText(body.notes, 'Notes', 500),
        created_at: nowStamp(),
      }
      db.health_logs.push(log)
      return { ...log, symptoms: [...log.symptoms] }
    },
    { write: true },
  )

// ---------- appointments ----------

function appointmentFields(body) {
  const title = (body.title || '').trim()
  if (!title) fail('Please enter a title')
  if (!isIsoDate(body.date)) fail('Please enter a valid date')
  return {
    title: checkText(title, 'Title', 100),
    doctor: checkText(body.doctor, 'Doctor', 80),
    location: checkText(body.location, 'Location', 120),
    date: body.date,
    time: checkText(body.time, 'Time', 10),
    notes: checkText(body.notes, 'Notes', 500),
    done: !!body.done,
  }
}

const appointmentOrder = (a, b) =>
  a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.time || '') < (b.time || '') ? -1 : (a.time || '') > (b.time || '') ? 1 : 0

// ---------- kick counter ----------

function kickFields(body) {
  if (!body.started_at || Number.isNaN(Date.parse(body.started_at))) fail('Invalid start time')
  return {
    started_at: String(body.started_at),
    duration_seconds: checkNumber(body.duration_seconds, 'Duration', { min: 0, max: 6 * 60 * 60, integer: true, inclusive: true }) ?? 0,
    kicks: checkNumber(body.kicks, 'Kicks', { min: 0, max: 500, integer: true, inclusive: true }) ?? 0,
  }
}

// ---------- generic list helpers ----------

const listFor = (table, order, limit) =>
  tx((db) => {
    const user = currentUser(db)
    const rows = db[table].filter((r) => r.user_id === user.id).sort(order)
    return copy(limit ? rows.slice(0, limit) : rows)
  })

const deleteFrom = (table, id) =>
  tx(
    (db) => {
      const user = currentUser(db)
      const item = ownedOr404(db[table], id, user.id)
      db[table] = db[table].filter((r) => r !== item)
      return { ok: true }
    },
    { write: true },
  )

export const api = {
  register,
  login,
  logout,
  me: () => tx((db) => publicUser(currentUser(db))),
  updateMe,
  status: () =>
    tx((db) => {
      const user = currentUser(db)
      if (!user.lmp_date) throw new ApiError('Pregnancy details not set up yet', 409)
      return pregnancyStatus(user.lmp_date)
    }),
  weeks: async () => WEEKS.map((w) => ({ ...w })),

  logs: () => listFor('health_logs', sortDesc('log_date')),
  addLog,
  deleteLog: (id) => deleteFrom('health_logs', id),

  appointments: () => listFor('appointments', appointmentOrder),
  addAppointment: (b) =>
    tx(
      (db) => {
        const user = currentUser(db)
        const appt = { id: nextId(db), user_id: user.id, ...appointmentFields(b), created_at: nowStamp() }
        db.appointments.push(appt)
        return { ...appt }
      },
      { write: true },
    ),
  updateAppointment: (id, b) =>
    tx(
      (db) => {
        const user = currentUser(db)
        const appt = ownedOr404(db.appointments, id, user.id)
        Object.assign(appt, appointmentFields(b))
        return { ...appt }
      },
      { write: true },
    ),
  deleteAppointment: (id) => deleteFrom('appointments', id),

  kicks: () => listFor('kick_sessions', sortDesc('started_at'), 50),
  addKicks: (b) =>
    tx(
      (db) => {
        const user = currentUser(db)
        const session = { id: nextId(db), user_id: user.id, ...kickFields(b), created_at: nowStamp() }
        db.kick_sessions.push(session)
        return { ...session }
      },
      { write: true },
    ),
  deleteKicks: (id) => deleteFrom('kick_sessions', id),
}
