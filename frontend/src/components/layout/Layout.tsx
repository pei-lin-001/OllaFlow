import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  KeyRound,
  BarChart3,
  FileText,
  Settings,
  LogOut,
  Menu,
  Zap,
  Moon,
  Sun,
  ChevronDown,
  RefreshCw,
  Activity,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/store/auth'
import { useAutoRefreshStore } from '@/store/autoRefresh'
import { api } from '@/api/client'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/admin', label: '仪表盘', icon: LayoutDashboard },
  { path: '/admin/accounts', label: '账号管理', icon: Users },
  { path: '/admin/users', label: '代理用户', icon: KeyRound },
  { path: '/admin/usage', label: '用量统计', icon: BarChart3 },
  { path: '/admin/logs', label: '请求日志', icon: FileText },
  { path: '/admin/settings', label: '系统设置', icon: Settings },
]

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem('theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const toggle = () => {
    const next = !dark
    setDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    if (next) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return { dark, toggle }
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { username, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { dark, toggle } = useDarkMode()
  const { enabled, interval, toggle: toggleRefresh, setInterval } = useAutoRefreshStore()

  const { data: activeRequests } = useQuery({
    queryKey: ['active-requests'],
    queryFn: api.getActiveRequests,
    refetchInterval: enabled ? Math.max(interval, 3000) : false,
  })

  const intervalOptions: { label: string; value: number }[] = [
    { label: '3秒', value: 3000 },
    { label: '10秒', value: 10000 },
    { label: '30秒', value: 30000 },
    { label: '60秒', value: 60000 },
  ]

  return (
    <div className={cn('min-h-screen bg-background', dark ? 'dark' : '')}>
      <div className="flex h-screen overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-56 border-r bg-card transition-transform lg:static lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex h-14 items-center border-b px-4">
              <Zap className="h-5 w-5 text-primary mr-2" />
              <span className="text-lg font-bold tracking-tight">OllaFlow</span>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                )
              })}
            </nav>

            <div className="border-t p-3">
              <button
                onClick={toggle}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {dark ? '浅色模式' : '深色模式'}
              </button>
              <button
                onClick={() => {
                  logout()
                  navigate('/admin/login')
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </button>
            </div>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Topbar */}
          <header className="flex h-14 items-center justify-between border-b bg-card px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden rounded-md p-2 hover:bg-accent"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="text-sm font-semibold text-foreground">
                {navItems.find((i) => i.path === location.pathname)?.label || '仪表盘'}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm">
                <span className="text-muted-foreground">管理员：</span>
                <span className="font-medium">{username}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2 text-xs">
                {activeRequests?.length > 0 && (
                  <div className="flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1">
                    <Activity className="h-3 w-3 animate-pulse" />
                    <span>{activeRequests.length} 活跃</span>
                  </div>
                )}
                <button
                  onClick={toggleRefresh}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors',
                    enabled
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent',
                  )}
                  title={enabled ? '关闭自动刷新' : '开启自动刷新'}
                >
                  <RefreshCw className={cn('h-3 w-3', enabled && 'animate-spin')} />
                  {enabled ? '开' : '关'}
                </button>
                {enabled && (
                  <select
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value))}
                    className="rounded-full bg-muted px-2 py-1 text-xs border-0 outline-none cursor-pointer hover:bg-accent"
                  >
                    {intervalOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
