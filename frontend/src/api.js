const BASE = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'maternity_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0)
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    let msg = data?.detail || 'Something went wrong'
    if (Array.isArray(msg)) msg = msg.map((d) => d.msg?.replace(/^Value error, /, '')).join(', ')
    throw new ApiError(msg, res.status)
  }
  return data
}

export const api = {
  register: (b) => request('/auth/register', { method: 'POST', body: b }),
  login: (b) => request('/auth/login', { method: 'POST', body: b }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/me'),
  updateMe: (b) => request('/me', { method: 'PUT', body: b }),
  status: () => request('/pregnancy/status'),
  weeks: () => request('/weeks'),

  logs: () => request('/health-logs'),
  addLog: (b) => request('/health-logs', { method: 'POST', body: b }),
  deleteLog: (id) => request(`/health-logs/${id}`, { method: 'DELETE' }),

  appointments: () => request('/appointments'),
  addAppointment: (b) => request('/appointments', { method: 'POST', body: b }),
  updateAppointment: (id, b) => request(`/appointments/${id}`, { method: 'PUT', body: b }),
  deleteAppointment: (id) => request(`/appointments/${id}`, { method: 'DELETE' }),

  kicks: () => request('/kicks'),
  addKicks: (b) => request('/kicks', { method: 'POST', body: b }),
  deleteKicks: (id) => request(`/kicks/${id}`, { method: 'DELETE' }),
}
