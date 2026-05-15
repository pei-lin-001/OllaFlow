import { create } from 'zustand'

const RefreshIntervals = [0, 3000, 10000, 30000, 60000] as const
type RefreshInterval = (typeof RefreshIntervals)[number]

interface AutoRefreshState {
  enabled: boolean
  interval: RefreshInterval
  toggle: () => void
  setInterval: (ms: number) => void
}

export const useAutoRefreshStore = create<AutoRefreshState>((set, get) => ({
  enabled: (() => {
    try { return localStorage.getItem('autoRefresh') === 'true' } catch { return false }
  })(),
  interval: (() => {
    try {
      const v = parseInt(localStorage.getItem('autoRefreshInterval') || '0', 10)
      if ((RefreshIntervals as readonly number[]).includes(v)) return v as RefreshInterval
    } catch {}
    return 10000
  })(),
  toggle: () => {
    const next = !get().enabled
    try { localStorage.setItem('autoRefresh', String(next)) } catch {}
    set({ enabled: next })
  },
  setInterval: (ms) => {
    try { localStorage.setItem('autoRefreshInterval', String(ms)) } catch {}
    set({ interval: ms as RefreshInterval })
  },
}))
