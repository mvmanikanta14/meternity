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

  const login = useCallback(async (email, password) => {
    const res = await api.login({ email, password })
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const register = useCallback(async (name, email, password) => {
    const res = await api.register({ name, email, password })
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

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
