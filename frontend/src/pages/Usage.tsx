import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/api/client'
import { useAutoRefreshStore } from '@/store/autoRefresh'
import { formatTokens } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'

function formatTps(tps: number | null | undefined): string {
  if (tps == null) return '—'
  if (tps >= 100) return `${Math.round(tps)} t/s`
  return `${tps.toFixed(1)} t/s`
}

export default function Usage() {
  const [period, setPeriod] = useState('day')
  const [accountId] = useState('')
  const [model] = useState('')
  const { enabled, interval } = useAutoRefreshStore()
  const refetchInterval = enabled ? interval : false

  const { data: aggData, isLoading: aggLoading } = useQuery({
    queryKey: ['usage-aggregate', period, accountId, model],
    queryFn: () => api.getUsageAggregate({ period, ...(accountId ? { accountId } : {}), ...(model ? { model } : {}) }),
    refetchInterval,
  })

  const { data: byModelData } = useQuery({
    queryKey: ['usage-by-model'],
    queryFn: () => api.getUsageByModel(),
    refetchInterval,
  })

  const { data: usageRecords, isLoading: recLoading } = useQuery({
    queryKey: ['usage', accountId, model],
    queryFn: () => api.getUsage({ ...(accountId ? { accountId } : {}), ...(model ? { model } : {}) }),
    refetchInterval,
  })

  const totals = (aggData || []).reduce(
    (acc: any, a: any) => ({
      requests: (acc.requests || 0) + a.requestCount,
      prompt: (acc.prompt || 0) + a.promptTokens,
      completion: (acc.completion || 0) + a.completionTokens,
      total: (acc.total || 0) + a.totalTokens,
    }),
    {},
  )

  const chartData = (aggData || []).map((a: any) => ({
    label: new Date(a.periodStart).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
    requests: a.requestCount,
    prompt: a.promptTokens,
    completion: a.completionTokens,
  }))

  const barData = (byModelData || [])
    .map((m: any) => ({ name: m.model, tokens: m.totalTokens, requests: m.requestCount }))
    .sort((a: any, b: any) => b.tokens - a.tokens)

  function exportCSV() {
    const rows = (usageRecords || []).map((r: any) => {
      const tps = r.evalCount && r.evalDuration
        ? Math.round((r.evalCount / (r.evalDuration / 1e9)) * 10) / 10
        : null
      return {
        时间: new Date(r.createdAt).toISOString(),
        模型: r.model,
        端点: r.endpoint,
        输入Token: r.promptEvalCount,
        输出Token: r.evalCount,
        输出速度_tps: tps,
      }
    })
    if (!rows.length) return
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map((r: any) => headers.map((h) => JSON.stringify(r[h as keyof typeof r] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `usage-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">用量统计</h2>
        <div className="flex items-center gap-2">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="hour">按小时</option>
            <option value="day">按天</option>
          </Select>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> 导出
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">请求数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.requests?.toLocaleString() || '0'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">输入 Token</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokens(totals.prompt)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">输出 Token</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokens(totals.completion)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总 Token</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokens(totals.total)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>请求趋势</CardTitle>
          </CardHeader>
          <CardContent>
            {aggLoading ? <Skeleton className="h-60" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                  <XAxis dataKey="label" fontSize={12} stroke="currentColor" opacity={0.5} />
                  <YAxis fontSize={12} stroke="currentColor" opacity={0.5} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="requests" stroke="#4f46e5" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token 消耗分布</CardTitle>
          </CardHeader>
          <CardContent>
            {aggLoading ? <Skeleton className="h-60" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                  <XAxis type="number" fontSize={12} stroke="currentColor" opacity={0.5} />
                  <YAxis type="category" dataKey="name" width={100} fontSize={11} stroke="currentColor" opacity={0.5} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Bar dataKey="tokens" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {(byModelData?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>模型消耗明细</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">模型</th>
                    <th className="py-3 px-4 text-right font-medium text-muted-foreground">请求数</th>
                    <th className="py-3 px-4 text-right font-medium text-muted-foreground">输入 Token</th>
                    <th className="py-3 px-4 text-right font-medium text-muted-foreground">输出 Token</th>
                    <th className="py-3 px-4 text-right font-medium text-muted-foreground">总 Token</th>
                    <th className="py-3 px-4 text-right font-medium text-muted-foreground">平均速度</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(byModelData || []).map((m: any) => (
                    <tr key={m.model} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs">{m.model}</td>
                      <td className="py-3 px-4 text-right">{m.requestCount.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">{formatTokens(m.promptTokens)}</td>
                      <td className="py-3 px-4 text-right">{formatTokens(m.completionTokens)}</td>
                      <td className="py-3 px-4 text-right">{formatTokens(m.totalTokens)}</td>
                      <td className="py-3 px-4 text-right">{formatTps(m.avgTps)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>最近使用记录</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">时间</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">模型</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">端点</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">状态</th>
                  <th className="py-3 px-4 text-right font-medium text-muted-foreground">输入</th>
                  <th className="py-3 px-4 text-right font-medium text-muted-foreground">输出</th>
                  <th className="py-3 px-4 text-right font-medium text-muted-foreground">输出速度</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recLoading ? (
                  <tr><td colSpan={7} className="py-8"><Skeleton className="h-32" /></td></tr>
                ) : (usageRecords || []).length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">暂无记录</td></tr>
                ) : (usageRecords || []).map((r: any) => {
                  const tps = r.evalCount && r.evalDuration
                    ? Math.round((r.evalCount / (r.evalDuration / 1e9)) * 10) / 10
                    : null
                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">{new Date(r.createdAt).toLocaleString('zh-CN')}</td>
                      <td className="py-3 px-4 font-mono text-xs">{r.model}</td>
                      <td className="py-3 px-4 text-muted-foreground">{r.endpoint}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r.statusCode >= 400 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                          {r.statusCode}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">{r.promptEvalCount != null ? formatTokens(r.promptEvalCount) : '—'}</td>
                      <td className="py-3 px-4 text-right">{r.evalCount != null ? formatTokens(r.evalCount) : '—'}</td>
                      <td className="py-3 px-4 text-right">{formatTps(tps)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}