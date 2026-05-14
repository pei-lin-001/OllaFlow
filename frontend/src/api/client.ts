const BASE = '/admin/api'

async function fetcher(path: string, options?: RequestInit) {
  const token = localStorage.getItem('admin_token')
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })

  if (res.status === 401) {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_username')
    window.location.href = '/admin/login'
    throw new Error('未授权，请重新登录')
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `请求失败 (${res.status})`)
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  login: (username: string, password: string) =>
    fetcher('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getDashboard: () => fetcher('/dashboard'),

  getAccounts: () => fetcher('/accounts'),
  createAccount: (data: any) =>
    fetcher('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: number, data: any) =>
    fetcher(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: (id: number) =>
    fetcher(`/accounts/${id}`, { method: 'DELETE' }),
  testAccount: (id: number) =>
    fetcher(`/accounts/${id}/test`, { method: 'POST' }),

  getProxyUsers: () => fetcher('/proxy-users'),
  createProxyUser: (data: any) =>
    fetcher('/proxy-users', { method: 'POST', body: JSON.stringify(data) }),
  updateProxyUser: (id: number, data: any) =>
    fetcher(`/proxy-users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProxyUser: (id: number) =>
    fetcher(`/proxy-users/${id}`, { method: 'DELETE' }),

  getUsage: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : ''
    return fetcher(`/usage${q}`)
  },
  getUsageAggregate: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : ''
    return fetcher(`/usage/aggregate${q}`)
  },

  getLogs: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : ''
    return fetcher(`/logs${q}`)
  },

  cleanup: () => fetcher('/cleanup', { method: 'POST' }),
}
