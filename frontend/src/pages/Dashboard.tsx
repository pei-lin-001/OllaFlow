import { useState, useMemo, memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, CreditCard, Users, Server, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/api/client'
import type { UsageAggregate, UsageByModel } from '@/api/types'
import { useAutoRefreshStore } from '@/store/autoRefresh'
import { formatTokens, fmtDate } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import type { LucideIcon } from 'lucide-react'

const COLORS = ['#4f46e5', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444']
const TOOLTIP_STYLE = { backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px' }

function formatKMB(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1000) return (v / 1000).toFixed(1) + 'K'
  return String(v)
}

function StatCard({ title, value, icon: Icon, trend }: { title: string; value: string; icon: LucideIcon; trend?: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend !== undefined && trend !== 0 && (
          <p className={`text-xs flex items-center mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
            较昨日 {Math.abs(trend)}%
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface TokenChartDataPoint {
  label: string
  prompt: number
  completion: number
}

const TokenChart = memo(function TokenChart({ data }: { data: UsageAggregate[] }) {
  const chartData = useMemo<TokenChartDataPoint[]>(() => (data || []).slice(-24).map((a) => ({
    label: fmtDate(a.periodStart, { hour: '2-digit', minute: '2-digit', hour12: false }),
    prompt: a.promptTokens,
    completion: a.completionTokens,
  })), [data])

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="db-prompt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="db-comp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
        <XAxis dataKey="label" fontSize={11} stroke="currentColor" opacity={0.5} interval={2} />
        <YAxis fontSize={11} stroke="currentColor" opacity={0.5} tickFormatter={formatKMB} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatTokens(v), '']} />
        <Area type="monotone" dataKey="prompt" stackId="1" stroke="#4f46e5" fill="url(#db-prompt)" name="输入" isAnimationActive={false} />
        <Area type="monotone" dataKey="completion" stackId="1" stroke="#06b6d4" fill="url(#db-comp)" name="输出" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
})

type PieMode = 'requests' | 'tokens'

interface PieDataEntry {
  name: string
  requests: number
  tokens: number
  value: number
}

const ModelChart = memo(function ModelChart({ data }: { data: UsageByModel[] }) {
  const [pieMode, setPieMode] = useState<PieMode>('tokens')

  const pieData = useMemo<PieDataEntry[]>(() => (data || [])
    .map((m) => ({
      name: m.model,
      requests: m.requestCount,
      tokens: m.totalTokens,
      value: pieMode === 'tokens' ? m.totalTokens : m.requestCount,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6), [data, pieMode])

  return (
    <>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" isAnimationActive={false}>
            {pieData.map((_, i) => (
              <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number, name: string) => [pieMode === 'tokens' ? formatTokens(value) : value.toLocaleString(), name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {pieData.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="font-medium">{pieMode === 'tokens' ? formatTokens(entry.tokens) : entry.requests.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1 text-xs mt-3">
        <button
          className={`px-2 py-1 rounded ${pieMode === 'tokens' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          onClick={() => setPieMode('tokens')}
        >
          Token
        </button>
        <button
          className={`px-2 py-1 rounded ${pieMode === 'requests' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          onClick={() => setPieMode('requests')}
        >
          请求
        </button>
      </div>
    </>
  )
})

export default function Dashboard() {
  const { enabled, interval } = useAutoRefreshStore()
  const refetchInterval = enabled ? (interval || 10000) : false

  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: api.getDashboard, refetchInterval })

  const { data: aggData } = useQuery({
    queryKey: ['usage-aggregate', 'hour'],
    queryFn: () => api.getUsageAggregate({ period: 'hour' }),
    refetchInterval,
  })

  const { data: byModelData } = useQuery({
    queryKey: ['usage-by-model'],
    queryFn: () => api.getUsageByModel(),
    refetchInterval,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="总请求数" value={data?.totalRequests?.toLocaleString() || '0'} icon={Activity}  />
        <StatCard title="今日 Token" value={formatTokens(data?.todayTokens)} icon={CreditCard}  trend={data?.tokenTrend} />
        <StatCard title="活跃账号" value={data?.totalAccounts?.toString() || '0'} icon={Server} />
        <StatCard title="代理用户" value={data?.totalProxyUsers?.toString() || '0'} icon={Users} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Token 用量（24小时）</CardTitle>
          </CardHeader>
          <CardContent>
            <TokenChart data={aggData || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>模型分布</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ModelChart data={byModelData || []} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
