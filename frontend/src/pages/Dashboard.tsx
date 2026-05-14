import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, CreditCard, Users, Server, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/api/client'
import { formatTokens } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

const COLORS = ['#4f46e5', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444']

function StatCard({ title, value, icon: Icon, trend }: { title: string; value: string; icon: any; trend?: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend !== undefined && (
          <p className={`text-xs flex items-center mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
            {Math.abs(trend)}%
          </p>
        )}
      </CardContent>
    </Card>
  )
}

type PieMode = 'requests' | 'tokens'

export default function Dashboard() {
  const [pieMode, setPieMode] = useState<PieMode>('tokens')

  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: api.getDashboard })

  const { data: aggData } = useQuery({
    queryKey: ['usage-aggregate', 'day'],
    queryFn: () => api.getUsageAggregate({ period: 'day' }),
  })

  const { data: byModelData } = useQuery({
    queryKey: ['usage-by-model'],
    queryFn: () => api.getUsageByModel(),
  })

  const chartData = (aggData || []).slice(-7).map((a: any) => ({
    date: new Date(a.periodStart).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
    prompt: a.promptTokens,
    completion: a.completionTokens,
  }))

  const pieData = (byModelData || [])
    .map((m: any) => ({
      name: m.model,
      requests: m.requestCount,
      tokens: m.totalTokens,
      value: pieMode === 'tokens' ? m.totalTokens : m.requestCount,
    }))
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, 6)

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
        <StatCard title="总请求数" value={data?.totalRequests?.toLocaleString() || '0'} icon={Activity} trend={12} />
        <StatCard title="今日 Token" value={formatTokens(data?.todayTokens)} icon={CreditCard} trend={8} />
        <StatCard title="活跃账号" value={data?.totalAccounts?.toString() || '0'} icon={Server} />
        <StatCard title="代理用户" value={data?.totalProxyUsers?.toString() || '0'} icon={Users} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Token 用量（7天）</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPrompt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorComp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="date" fontSize={12} stroke="currentColor" opacity={0.5} />
                <YAxis fontSize={12} stroke="currentColor" opacity={0.5} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="prompt" stackId="1" stroke="#4f46e5" fill="url(#colorPrompt)" name="输入" />
                <Area type="monotone" dataKey="completion" stackId="1" stroke="#06b6d4" fill="url(#colorComp)" name="输出" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>模型分布</CardTitle>
              <div className="flex gap-1 text-xs">
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
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                  {pieData.map((_: any, i: number) => (
                    <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  formatter={(value: number, name: string) => [pieMode === 'tokens' ? formatTokens(value) : value.toLocaleString(), name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {pieData.map((entry: any, i: number) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-muted-foreground">{entry.name}</span>
                  <span className="font-medium">{pieMode === 'tokens' ? formatTokens(entry.tokens) : entry.requests.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}