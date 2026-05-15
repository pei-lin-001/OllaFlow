import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, CheckCircle2, Loader2, Server, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/api/client'
import { useAutoRefreshStore } from '@/store/autoRefresh'
import { toast } from 'sonner'

interface Account {
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

function CooldownTimer({ disabledAt, cooldownSeconds }: { disabledAt: string; cooldownSeconds: number }) {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    const disabledTime = new Date(disabledAt).getTime()
    const recoverAt = disabledTime + cooldownSeconds * 1000

    function update() {
      const left = Math.max(0, Math.ceil((recoverAt - Date.now()) / 1000))
      setRemaining(left)
    }

    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [disabledAt, cooldownSeconds])

  if (remaining <= 0) {
    return <span className="text-green-600 text-xs">自动恢复中...</span>
  }

  const min = Math.floor(remaining / 60)
  const sec = remaining % 60
  return (
    <span className="text-amber-600 text-xs">
      自动恢复倒计时 {min > 0 ? `${min}分` : ''}{sec}秒
    </span>
  )
}

export default function Accounts() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState({ name: '', apiKey: '', proxyUrl: '', proxyAuth: '', weight: 1, isActive: true })
  const [testing, setTesting] = useState<number | null>(null)
  const [reactivating, setReactivating] = useState<number | null>(null)
  const { enabled, interval } = useAutoRefreshStore()
  const refetchInterval = enabled ? (interval || 10000) : false

  const { data, isLoading } = useQuery({ queryKey: ['accounts'], queryFn: api.getAccounts, refetchInterval })
  const { data: cbConfig } = useQuery({ queryKey: ['circuitBreakerConfig'], queryFn: api.getCircuitBreakerConfig, refetchInterval })

  const cooldownSeconds: number = cbConfig?.cooldownSeconds ?? 300

  const create = useMutation({
    mutationFn: api.createAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setDialogOpen(false)
      resetForm()
      toast.success('账号已创建')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateAccount(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setDialogOpen(false)
      setEditing(null)
      resetForm()
      toast.success('账号已更新')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('账号已删除')
    },
    onError: (e: any) => toast.error(e.message),
  })

  function resetForm() {
    setForm({ name: '', apiKey: '', proxyUrl: '', proxyAuth: '', weight: 1, isActive: true })
  }

  function openEdit(acc: Account) {
    setEditing(acc)
    setForm({
      name: acc.name,
      apiKey: '',
      proxyUrl: acc.proxyUrl || '',
      proxyAuth: '',
      weight: acc.weight,
      isActive: acc.isActive,
    })
    setDialogOpen(true)
  }

  function openCreate() {
    setEditing(null)
    resetForm()
    setDialogOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: any = { ...form }
    if (!payload.apiKey && editing) delete payload.apiKey
    payload.proxyUrl = payload.proxyUrl || null
    payload.proxyAuth = payload.proxyAuth || null
    if (editing) {
      update.mutate({ id: editing.id, data: payload })
    } else {
      create.mutate(payload)
    }
  }

  async function handleTest(id: number) {
    setTesting(id)
    try {
      const res = await api.testAccount(id)
      toast[res.success ? 'success' : 'error'](res.success ? '连接正常' : `失败：${res.error || res.statusCode}`)
      qc.invalidateQueries({ queryKey: ['accounts'] })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setTesting(null)
    }
  }

  async function handleReactivate(id: number) {
    setReactivating(id)
    try {
      await api.reactivateAccount(id)
      toast.success('账号已重新激活')
      qc.invalidateQueries({ queryKey: ['accounts'] })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setReactivating(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">账号管理</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> 添加账号
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editing ? '编辑账号' : '添加账号'}</DialogTitle>
                <DialogDescription>
                  {editing ? '修改 Ollama Cloud 账号设置。' : '添加新的 Ollama Cloud 账号到代理池。'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>名称 *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Ollama API Key{editing && '（留空保持不变）'}</Label>
                  <Input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} {...(!editing ? { required: true } : {})} />
                </div>
                <div className="space-y-2">
                  <Label>代理地址</Label>
                  <Input value={form.proxyUrl} onChange={(e) => setForm({ ...form, proxyUrl: e.target.value })} placeholder="http://proxy:port" />
                </div>
                <div className="space-y-2">
                  <Label>代理认证（用户名:密码）</Label>
                  <Input type="password" value={form.proxyAuth} onChange={(e) => setForm({ ...form, proxyAuth: e.target.value })} placeholder="username:password" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="space-y-2 flex-1">
                    <Label>权重（1-100）</Label>
                    <Input type="number" min={1} max={100} value={form.weight} onChange={(e) => setForm({ ...form, weight: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                    <Label>启用</Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
                <Button type="submit" isLoading={create.isPending || update.isPending}>{editing ? '保存' : '创建'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">名称</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">代理</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">权重</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">状态</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">最后使用</th>
                  <th className="py-3 px-4 text-right font-medium text-muted-foreground">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data || []).map((acc: Account) => {
                  const isCircuitBroken = !acc.isActive && acc.failCount >= (cbConfig?.threshold ?? 3)
                  return (
                    <tr key={acc.id} className={`hover:bg-muted/30 transition-colors${isCircuitBroken ? ' bg-destructive/5' : ''}`}>
                      <td className="py-3 px-4 font-medium">{acc.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{acc.proxyUrl || '—'}</td>
                      <td className="py-3 px-4">{acc.weight}</td>
                      <td className="py-3 px-4">
                        {isCircuitBroken ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant="destructive">熔断 ({acc.failCount}次失败)</Badge>
                            {acc.disabledAt && (
                              <CooldownTimer disabledAt={acc.disabledAt} cooldownSeconds={cooldownSeconds} />
                            )}
                          </div>
                        ) : acc.isActive ? (
                          <Badge variant="success">启用</Badge>
                        ) : (
                          <Badge variant="secondary">已禁用</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {acc.lastUsedAt ? new Date(acc.lastUsedAt).toLocaleString('zh-CN') : '—'}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isCircuitBroken && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReactivate(acc.id)}
                              disabled={reactivating === acc.id}
                              title="重新激活"
                            >
                              {reactivating === acc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleTest(acc.id)} disabled={testing === acc.id}>
                            {testing === acc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(acc)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => remove.mutate(acc.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {(!data || data.length === 0) && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      暂无账号，点击"添加账号"开始配置。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}