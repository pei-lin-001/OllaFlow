import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Copy, Check, KeyRound } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/api/client'
import { toast } from 'sonner'

interface ProxyUser {
  id: number
  name: string
  apiKey: string
  isActive: boolean
  rateLimit: number | null
  createdAt: string
}

export default function ProxyUsers() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProxyUser | null>(null)
  const [form, setForm] = useState({ name: '', apiKey: '', isActive: true, rateLimit: '' })
  const [copied, setCopied] = useState<number | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['proxy-users'], queryFn: api.getProxyUsers })

  const create = useMutation({
    mutationFn: api.createProxyUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proxy-users'] })
      setDialogOpen(false)
      resetForm()
      toast.success('代理用户已创建')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateProxyUser(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proxy-users'] })
      setDialogOpen(false)
      setEditing(null)
      resetForm()
      toast.success('代理用户已更新')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: api.deleteProxyUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proxy-users'] })
      toast.success('代理用户已删除')
    },
    onError: (e: any) => toast.error(e.message),
  })

  function resetForm() {
    setForm({ name: '', apiKey: '', isActive: true, rateLimit: '' })
  }

  function openEdit(u: ProxyUser) {
    setEditing(u)
    setForm({
      name: u.name,
      apiKey: u.apiKey,
      isActive: u.isActive,
      rateLimit: u.rateLimit ? String(u.rateLimit) : '',
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
    const payload: any = {
      name: form.name,
      isActive: form.isActive,
      rateLimit: form.rateLimit ? parseInt(form.rateLimit) : null,
    }
    if (form.apiKey) payload.apiKey = form.apiKey
    if (editing) {
      update.mutate({ id: editing.id, data: payload })
    } else {
      create.mutate(payload)
    }
  }

  function copyKey(key: string, id: number) {
    navigator.clipboard.writeText(key)
    setCopied(id)
    toast.success('API Key 已复制')
    setTimeout(() => setCopied(null), 2000)
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
        <h2 className="text-lg font-semibold">代理用户</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> 添加用户
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editing ? '编辑用户' : '添加用户'}</DialogTitle>
                <DialogDescription>
                  {editing ? '修改代理用户设置。' : '创建新的代理用户用于 API 访问。'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>名称 *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>API Key{editing && '（留空保持不变）'}</Label>
                  <Input value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={editing ? undefined : '留空则自动生成'} />
                </div>
                <div className="space-y-2">
                  <Label>速率限制（请求/分钟）</Label>
                  <Input type="number" value={form.rateLimit} onChange={(e) => setForm({ ...form, rateLimit: e.target.value })} placeholder="留空则不限制" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                  <Label>启用</Label>
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
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">API Key</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">速率限制</th>
                  <th className="py-3 px-4 text-left font-medium text-muted-foreground">状态</th>
                  <th className="py-3 px-4 text-right font-medium text-muted-foreground">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data || []).map((u: ProxyUser) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium">{u.name}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                          {u.apiKey.slice(0, 8)}...{u.apiKey.slice(-4)}
                        </span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyKey(u.apiKey, u.id)}>
                          {copied === u.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                    <td className="py-3 px-4">{u.rateLimit ? `${u.rateLimit}/分钟` : '—'}</td>
                    <td className="py-3 px-4">
                      {u.isActive ? <Badge variant="success">启用</Badge> : <Badge variant="secondary">已禁用</Badge>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => remove.mutate(u.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!data || data.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      <KeyRound className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      暂无代理用户。
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