import { useState, useCallback } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { FileText, Download, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/api/client'
import { fmtDate } from '@/lib/utils'

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
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['logs', page, pageSize, statusCode, method],
    queryFn: () => api.getLogs({ page: String(page), pageSize: String(pageSize), ...(statusCode ? { statusCode } : {}), ...(method ? { method } : {}) }),
    placeholderData: keepPreviousData,
  })

  const logs = data?.logs || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  const toggleExpanded = useCallback((id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  function expandAllErrors() {
    const errorIds = new Set<number>()
    logs.forEach((r: any) => {
      if (r.statusCode >= 400 || r.error) errorIds.add(r.id)
    })
    setExpandedIds(errorIds)
  }

  function collapseAll() {
    setExpandedIds(new Set())
  }

  function exportCSV() {
    if (!logs.length) return
    const headers = ['时间', '方法', '端点', '状态码', '模型', '耗时(ms)', '首字延迟(ms)', '请求体', '响应体', '错误']
    const rows = logs.map((r: any) => [
      new Date(r.createdAt).toISOString(),
      r.method,
      r.endpoint,
      r.statusCode ?? '',
      r.model ?? '',
      r.durationMs ?? '',
      r.ttffbMs ?? '',
      (r.requestBody ?? '').slice(0, 500),
      (r.responseBody ?? '').slice(0, 500),
      r.error ?? '',
    ])
    const csv = [headers.join(','), ...rows.map((row: string[]) => row.map((c) => JSON.stringify(c)).join(','))].join('\n')
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAllErrors}>
            <AlertTriangle className="h-3.5 w-3.5 mr-1" /> 展开错误
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            全部收起
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" /> 导出 CSV
          </Button>
        </div>
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
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">模型</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">状态</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">耗时</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">首字延迟</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">错误</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading && !isPlaceholderData ? (
                  <tr><td colSpan={9} className="py-8"><Skeleton className="h-32" /></td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" /> 暂无日志记录。
                  </td></tr>
                ) : logs.map((r: any) => {
                  const isError = r.statusCode >= 400 || !!r.error
                  const isOpen = expandedIds.has(r.id)
                  return (
                    <>
                      <tr
                        key={`row-${r.id}`}
                        className={`hover:bg-muted/30 transition-colors cursor-pointer ${isError ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
                        onClick={() => toggleExpanded(r.id)}
                      >
                        <td className="py-3 px-4">
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </td>
                        <td className="py-3 px-4">{fmtDate(r.createdAt, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                        <td className="py-3 px-4 font-mono text-xs">{r.method}</td>
                        <td className="py-3 px-4 text-muted-foreground">{r.endpoint}</td>
                        <td className="py-3 px-4 font-mono text-xs">{r.model ?? '—'}</td>
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
                          {r.error ? <span className="text-red-600 text-xs truncate max-w-[200px] block" title={r.error}>{r.error}</span> : '—'}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`detail-${r.id}`}>
                          <td colSpan={9} className="p-4 bg-muted/20">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-3">
                                <div className="text-xs font-medium text-muted-foreground mb-1">基本信息</div>
                                <div className="text-xs grid grid-cols-[80px_1fr] gap-y-1">
                                  <span className="text-muted-foreground">账号 ID：</span><span>{r.accountId ?? '—'}</span>
                                  <span className="text-muted-foreground">用户 ID：</span><span>{r.proxyUserId ?? '—'}</span>
                                  <span className="text-muted-foreground">总耗时：</span><span>{formatDuration(r.durationMs)}</span>
                                  <span className="text-muted-foreground">首字延迟：</span><span>{formatDuration(r.ttffbMs)}</span>
                                </div>
                              </div>
                              <div className="space-y-3">
                                {r.requestBody && (
                                  <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">请求体</div>
                                    <pre className="text-xs bg-background border rounded-md p-2 overflow-auto max-h-40">{(() => { try { return JSON.stringify(JSON.parse(r.requestBody), null, 2) } catch { return r.requestBody } })()}</pre>
                                  </div>
                                )}
                              </div>
                              <div className="col-span-2 space-y-3">
                                {r.responseBody && (
                                  <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">响应体</div>
                                    <pre className="text-xs bg-background border rounded-md p-2 overflow-auto max-h-40">{(() => { try { return JSON.stringify(JSON.parse(r.responseBody), null, 2) } catch { return r.responseBody } })()}</pre>
                                  </div>
                                )}
                              </div>
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