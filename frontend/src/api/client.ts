const BASE = '/admin/api'

import type {
  LoginResponse, DashboardData, CircuitBreakerConfig, ActiveRequest,
  Account, AccountCreatePayload, AccountUpdatePayload, AccountCreateResponse, AccountTestResponse,
  ProxyUser, ProxyUserCreatePayload, ProxyUserUpdatePayload, ProxyUserCreateResponse,
  UsageAggregate, UsageByModel, UsageRecord,
  LogsResponse, AdminUser, AdminCreatePayload, CleanupResponse, ChangePasswordPayload,
} from './types'

async function fetcher<T>(path: string, options?: RequestInit): Promise<T> {
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

  if (res.status === 204) return null as T
  return res.json() as Promise<T>
}

export const api = {
  login: (username: string, password: string): Promise<LoginResponse> =>
    fetcher('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getDashboard: (): Promise<DashboardData> => fetcher('/dashboard'),

  getAccounts: (): Promise<Account[]> => fetcher('/accounts'),
  createAccount: (data: AccountCreatePayload): Promise<AccountCreateResponse> =>
    fetcher('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: number, data: AccountUpdatePayload): Promise<void> =>
    fetcher(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: (id: number): Promise<void> =>
    fetcher(`/accounts/${id}`, { method: 'DELETE' }),
  testAccount: (id: number): Promise<AccountTestResponse> =>
    fetcher(`/accounts/${id}/test`, { method: 'POST' }),
  reactivateAccount: (id: number): Promise<void> =>
    fetcher(`/accounts/${id}/reactivate`, { method: 'POST' }),

  getProxyUsers: (): Promise<ProxyUser[]> => fetcher('/proxy-users'),
  createProxyUser: (data: ProxyUserCreatePayload): Promise<ProxyUserCreateResponse> =>
    fetcher('/proxy-users', { method: 'POST', body: JSON.stringify(data) }),
  updateProxyUser: (id: number, data: ProxyUserUpdatePayload): Promise<void> =>
    fetcher(`/proxy-users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProxyUser: (id: number): Promise<void> =>
    fetcher(`/proxy-users/${id}`, { method: 'DELETE' }),

  getUsage: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : ''
    return fetcher<UsageRecord[]>(`/usage${q}`)
  },
  getUsageAggregate: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : ''
    return fetcher<UsageAggregate[]>(`/usage/aggregate${q}`)
  },
  getUsageByModel: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : ''
    return fetcher<UsageByModel[]>(`/usage/by-model${q}`)
  },

  getLogs: (params?: Record<string, string>) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : ''
    return fetcher<LogsResponse>(`/logs${q}`)
  },

  cleanup: (): Promise<CleanupResponse> => fetcher('/cleanup', { method: 'POST' }),

  changePassword: (oldPassword: string, newPassword: string) =>
    fetcher('/password', {
      method: 'PATCH',
      body: JSON.stringify({ oldPassword, newPassword } as ChangePasswordPayload),
    }),

  getCircuitBreakerConfig: (): Promise<CircuitBreakerConfig> => fetcher('/circuit-breaker-config'),

  getActiveRequests: (): Promise<ActiveRequest[]> => fetcher('/active-requests'),

  getAdmins: (): Promise<AdminUser[]> => fetcher('/admins'),
  createAdmin: (data: AdminCreatePayload): Promise<AdminUser> =>
    fetcher('/admins', { method: 'POST', body: JSON.stringify(data) }),
  deleteAdmin: (id: number): Promise<void> =>
    fetcher(`/admins/${id}`, { method: 'DELETE' }),
}
