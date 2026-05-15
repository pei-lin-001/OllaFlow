import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { FileText, Download, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/api/client'

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export default function Logs() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [statusCode, setStatusCode] = useState('')
  const [method, setMethod] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['logs', page, pageSize, statusCode, method],
    queryFn: () => api.getLogs({ page: String(page), pageSize: String(pageSize), ...(statusCode ? { statusCode } : {}), ...(method ? { method } : {}) }),
    placeholderData: keepPreviousData,
  })

  const logs = data?.logs || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  function exportCSV() {
    if (!logs.length) return
    const headers = ['时间', '方法', '端点', '状态码', '耗时(s)', '首字延迟(s)', '模型', '错误']
    const csv = [headers.join(','), ...logs.map((r: any) => headers.map((h) => JSON.stringify(r[{
      '时间': 'createdAt',
      '方法': 'method',
      '端点': 'endpoint',
      '状态码': 'statusCode',
      '耗时(s)': 'durationMs',
      '首字延迟(s)': 'ttffbMs',
      '模型': 'model',
      '错误': 'error',
    }[h] as string] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">请求日志</h2>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> 导出 CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusCode} onChange={(e) => { setStatusCode(e.target.value); setPage(1) }}>
          <option value="">全部状态</option>
          <option value="200">200 OK</option>
          <option value="400">400 Bad Request</option>
          <option value="429">429 请求过多</option>
          <option value="502">502 网关错误</option>
        </Select>
        <Select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1) }}>
          <option value="">全部方法</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="DELETE">DELETE</option>
        </Select>
        <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
          <option value="50">50 条/页</option>
          <option value="100">100 条/页</option>
          <option value="200">200 条/页</option>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground w-12"></th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">时间</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">方法</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">端点</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">状态</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">耗时</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">首字延迟</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">错误</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={8} className="py-8"><Skeleton className="h-32" /></td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" /> 暂无日志记录。
                  </td></tr>
                ) : logs.map((r: any) => {
                  const isError = r.statusCode >= 500 || !!r.error
                  const isOpen = expanded === r.id
                  return (
                    <>
                      <tr
                        key={`row-${r.id}`}
                        className={`hover:bg-muted/30 transition-colors cursor-pointer ${isError ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                      >
                        <td className="py-3 px-4">
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </td>
                        <td className="py-3 px-4">{new Date(r.createdAt).toLocaleString('zh-CN')}</td>
                        <td className="py-3 px-4 font-mono text-xs">{r.method}</td>
                        <td className="py-3 px-4 text-muted-foreground">{r.endpoint}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.statusCode < 300 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            r.statusCode < 500 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {r.statusCode}
                          </span>
                        </td>
                        <td className="py-3 px-4">{formatDuration(r.durationMs)}</td>
                        <td className="py-3 px-4">{formatDuration(r.ttffbMs)}</td>
                        <td className="py-3 px-4">
                          {r.error ? <span className="text-red-600 text-xs truncate max-w-[200px] block">{r.error}</span> : '—'}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`detail-${r.id}`}>
                          <td colSpan={8} className="p-4 bg-muted/20">
                            <div className="space-y-3">
                              {r.model && <div className="text-xs"><span className="text-muted-foreground">模型：</span><span className="font-mono">{r.model}</span></div>}
                              {r.accountId && <div className="text-xs"><span className="text-muted-foreground">账号 ID：</span>{r.accountId}</div>}
                              {r.proxyUserId && <div className="text-xs"><span className="text-muted-foreground">用户 ID：</span>{r.proxyUserId}</div>}
                              {r.durationMs != null && <div className="text-xs"><span className="text-muted-foreground">总耗时：</span>{formatDuration(r.durationMs)}</div>}
                              {r.ttffbMs != null && <div className="text-xs"><span className="text-muted-foreground">首字延迟：</span>{formatDuration(r.ttffbMs)}</div>}
                              {r.requestBody && (
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">请求体</div>
                                  <pre className="text-xs bg-background border rounded-md p-2 overflow-auto max-h-40">{(() => { try { return JSON.stringify(JSON.parse(r.requestBody), null, 2) } catch { return r.requestBody } })()}</pre>
                                </div>
                              )}
                              {r.responseBody && (
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">响应体</div>
                                  <pre className="text-xs bg-background border rounded-md p-2 overflow-auto max-h-40">{(() => { try { return JSON.stringify(JSON.parse(r.responseBody), null, 2) } catch { return r.responseBody } })()}</pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          显示 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} 条，共 {total} 条
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">第 {page} / {totalPages || 1} 页</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}