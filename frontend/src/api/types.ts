// ── API 响应类型定义 ──────────────────────────────────
// 与后端 admin.ts 路由返回值保持一致

// 认证
export interface LoginResponse {
  token: string
  username: string
}

// 仪表盘
export interface DashboardData {
  totalRequests: number
  todayTokens: number
  todayRequests: number
  totalAccounts: number
  totalProxyUsers: number
}

// 熔断器配置
export interface CircuitBreakerConfig {
  threshold: number
  cooldownSeconds: number
}

// 活跃请求
export interface ActiveRequest {
  id: string
  startTime: number
  accountId: number
  accountName: string
  proxyUserId?: number
  method: string
  endpoint: string
  model?: string
  streamed: boolean
  elapsedMs: number
}

// ── 账号 ──────────────────────────────────────────────

export interface Account {
  id: number
  name: string
  proxyUrl: string | null
  isActive: boolean
  weight: number
  failCount: number
  disabledAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

export interface AccountCreatePayload {
  name: string
  apiKey: string
  proxyUrl?: string | null
  proxyAuth?: string | null
  isActive?: boolean
  weight?: number
}

export interface AccountUpdatePayload extends Partial<AccountCreatePayload> {}

export interface AccountCreateResponse {
  id: number
  name: string
}

export interface AccountTestResponse {
  success: boolean
  error?: string
  statusCode?: number
}

// ── 代理用户 ──────────────────────────────────────────

export interface ProxyUser {
  id: number
  name: string
  apiKey: string
  isActive: boolean
  rateLimit: number | null
  createdAt: string
}

export interface ProxyUserCreatePayload {
  name: string
  apiKey?: string
  isActive?: boolean
  rateLimit?: number | null
}

export interface ProxyUserUpdatePayload extends Partial<ProxyUserCreatePayload> {}

export interface ProxyUserCreateResponse {
  id: number
  name: string
  apiKey: string
}

// ── 用量统计 ──────────────────────────────────────────

export interface UsageAggregate {
  id: number
  accountId: number | null
  proxyUserId: number | null
  model: string
  period: string
  periodStart: string
  requestCount: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  totalDuration: number
  errorCount: number
}

export interface UsageByModel {
  model: string
  requestCount: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  avgTps: number | null
}

export interface UsageRecord {
  id: number
  accountId: number | null
  proxyUserId: number | null
  model: string
  endpoint: string
  promptEvalCount: number | null
  evalCount: number | null
  totalDuration: number | null
  loadDuration: number | null
  promptEvalDuration: number | null
  evalDuration: number | null
  statusCode: number
  errorMessage: string | null
  streamed: boolean
  createdAt: string
}

// ── 请求日志 ──────────────────────────────────────────

export interface RequestLog {
  id: number
  accountId: number | null
  proxyUserId: number | null
  model: string | null
  endpoint: string
  method: string
  statusCode: number | null
  durationMs: number
  ttffbMs: number | null
  requestBody: string | null
  responseBody: string | null
  error: string | null
  createdAt: string
}

export interface LogsResponse {
  logs: RequestLog[]
  total: number
  page: number
  pageSize: number
}

// ── 管理员 ────────────────────────────────────────────

export interface AdminUser {
  id: number
  username: string
  createdAt: string
}

export interface AdminCreatePayload {
  username: string
  password: string
}

export interface CleanupResponse {
  deleted: number
  cutoff: string
}

export interface ChangePasswordPayload {
  oldPassword: string
  newPassword: string
}
