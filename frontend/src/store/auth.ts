import { useState, useEffect } from 'react'
import { create } from 'zustand'

interface AuthState {
  token: string | null
  username: string | null
  setAuth: (token: string, username: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('admin_token'),
  username: localStorage.getItem('admin_username'),
  setAuth: (token, username) => {
    localStorage.setItem('admin_token', token)
    localStorage.setItem('admin_username', username)
    set({ token, username })
  },
  logout: () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_username')
    set({ token: null, username: null })
  },
}))

export function useAuth() {
  const store = useAuthStore()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  return { ...store, hydrated }
}
