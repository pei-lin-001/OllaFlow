import { create } from 'zustand'

const DEFAULT_INTERVAL = 10000

const RefreshIntervals = [3000, 10000, 30000, 60000] as const
type RefreshInterval = (typeof RefreshIntervals)[number]

interface AutoRefreshState {
  enabled: boolean
  interval: RefreshInterval
  toggle: () => void
  setInterval: (ms: number) => void
}

function readStoredInterval(): RefreshInterval {
  try {
    const v = parseInt(localStorage.getItem('autoRefreshInterval') || '', 10)
    if ((RefreshIntervals as readonly number[]).includes(v)) return v as RefreshInterval
  } catch {}
  return DEFAULT_INTERVAL
}

export const useAutoRefreshStore = create<AutoRefreshState>((set, get) => ({
  enabled: (() => {
    try { return localStorage.getItem('autoRefresh') === 'true' } catch { return false }
  })(),
  interval: readStoredInterval(),
  toggle: () => {
    const next = !get().enabled
    try { localStorage.setItem('autoRefresh', String(next)) } catch {}
    if (next && get().interval <= 0) {
      try { localStorage.setItem('autoRefreshInterval', String(DEFAULT_INTERVAL)) } catch {}
      set({ enabled: next, interval: DEFAULT_INTERVAL as RefreshInterval })
    } else {
      set({ enabled: next })
    }
  },
  setInterval: (ms) => {
    try { localStorage.setItem('autoRefreshInterval', String(ms)) } catch {}
    set({ interval: ms as RefreshInterval })
  },
}))
