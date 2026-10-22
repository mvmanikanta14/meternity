import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from '../api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(!!getToken())

  useEffect(() => {
    if (!getToken()) return
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username, password) => {
    const res = await api.login({ username, password })
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const register = useCallback(async (name, username, password) => {
    const res = await api.register({ name, username, password })
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      /* session may already be gone */
    }
    setToken(null)
    setUser(null)
  }, [])

  const updateProfile = useCallback(async (data) => {
    const fresh = await api.updateMe(data)
    setUser(fresh)
    return fresh
  }, [])

  const refresh = useCallback(() => api.me().then(setUser), [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
