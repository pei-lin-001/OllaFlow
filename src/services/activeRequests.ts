type ActiveRequest = {
  id: string
  startTime: number
  accountId: number
  accountName: string
  proxyUserId?: number
  method: string
  endpoint: string
  model?: string
  streamed: boolean
}

const activeRequests = new Map<string, ActiveRequest>()

let counter = 0

export function registerRequest(data: Omit<ActiveRequest, 'id' | 'startTime'>): string {
  const id = `${Date.now()}-${++counter}`
  activeRequests.set(id, { ...data, id, startTime: Date.now() })
  return id
}

export function unregisterRequest(id: string) {
  activeRequests.delete(id)
}

export function updateRequestStreamed(id: string) {
  const entry = activeRequests.get(id)
  if (entry) {
    activeRequests.set(id, { ...entry, streamed: true })
  }
}

export function getActiveRequests(): ActiveRequest[] {
  return Array.from(activeRequests.values())
}

setInterval(() => {
  const staleTimeout = 30 * 60 * 1000
  const now = Date.now()
  for (const [id, req] of activeRequests.entries()) {
    if (now - req.startTime > staleTimeout) {
      activeRequests.delete(id)
    }
  }
}, 60_000)
