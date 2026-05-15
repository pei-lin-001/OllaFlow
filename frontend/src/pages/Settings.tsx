import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Trash2, AlertTriangle, Loader2, UserPlus, KeyRound, Trash, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { api } from '@/api/client'
import { toast } from 'sonner'

export default function Settings() {
  const [confirmReset, setConfirmReset] = useState('')
  const [showResetDialog, setShowResetDialog] = useState(false)

  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')

  const [newAdminUser, setNewAdminUser] = useState('')
  const [newAdminPwd, setNewAdminPwd] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const qc = useQueryClient()

  const cleanup = useMutation({
    mutationFn: api.cleanup,
    onSuccess: (data: any) => toast.success(`已清理 ${data.deleted || 0} 条过期日志记录`),
    onError: (e: any) => toast.error(e.message),
  })

  const changePwd = useMutation({
    mutationFn: () => api.changePassword(oldPwd, newPwd),
    onSuccess: () => {
      toast.success('密码修改成功')
      setOldPwd('')
      setNewPwd('')
      setConfirmPwd('')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const { data: admins } = useQuery({ queryKey: ['admins'], queryFn: api.getAdmins })
  const currentUsername = localStorage.getItem('admin_username')

  const createAdmin = useMutation({
    mutationFn: () => api.createAdmin({ username: newAdminUser, password: newAdminPwd }),
    onSuccess: () => {
      toast.success('管理员已创建')
      qc.invalidateQueries({ queryKey: ['admins'] })
      setNewAdminUser('')
      setNewAdminPwd('')
      setAddDialogOpen(false)
    },
    onError: (e: any) => toast.error(e.message),
  })

  const deleteAdmin = useMutation({
    mutationFn: (id: number) => api.deleteAdmin(id),
    onSuccess: () => {
      toast.success('管理员已删除')
      qc.invalidateQueries({ queryKey: ['admins'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPwd !== confirmPwd) return toast.error('两次输入的新密码不一致')
    if (newPwd.length < 6) return toast.error('新密码至少 6 位')
    changePwd.mutate()
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">系统设置</h2>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                <CardTitle>修改密码</CardTitle>
              </div>
              <CardDescription>修改当前管理员的登录密码。</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label>当前密码</Label>
                  <Input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>新密码</Label>
                  <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required minLength={6} />
                </div>
                <div className="space-y-2">
                  <Label>确认新密码</Label>
                  <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required minLength={6} />
                </div>
                <div className="md:col-span-3">
                  <Button type="submit" isLoading={changePwd.isPending}>修改密码</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>管理员账号</CardTitle>
              </div>
              <CardDescription>管理系统登录账号。当前登录：<strong>{currentUsername}</strong></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="divide-y">
                {(admins || []).map((admin: any) => (
                  <div key={admin.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <span className="font-medium">{admin.username}</span>
                      {admin.username === currentUsername && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">当前</span>
                      )}
                      <div className="text-xs text-muted-foreground">{new Date(admin.createdAt).toLocaleString('zh-CN')}</div>
                    </div>
                    {admin.username !== currentUsername && (
                      <Button variant="ghost" size="sm" onClick={() => deleteAdmin.mutate(admin.id)}>
                        <Trash className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline"><UserPlus className="h-4 w-4 mr-1" /> 添加管理员</Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={(e) => { e.preventDefault(); createAdmin.mutate() }}>
                    <DialogHeader>
                      <DialogTitle>添加管理员</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>用户名</Label>
                        <Input value={newAdminUser} onChange={(e) => setNewAdminUser(e.target.value)} required minLength={2} placeholder="至少 2 个字符" />
                      </div>
                      <div className="space-y-2">
                        <Label>密码</Label>
                        <Input type="password" value={newAdminPwd} onChange={(e) => setNewAdminPwd(e.target.value)} required minLength={6} placeholder="至少 6 位" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>取消</Button>
                      <Button type="submit" isLoading={createAdmin.isPending}>创建</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">危险操作</CardTitle>
              </div>
              <CardDescription>以下操作不可逆，请谨慎操作。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!showResetDialog ? (
                <Button variant="destructive" onClick={() => setShowResetDialog(true)}>
                  重置所有统计数据
                </Button>
              ) : (
                <div className="space-y-3 rounded-lg border border-destructive/50 p-4 bg-destructive/5">
                  <p className="text-sm text-destructive font-medium">
                    此操作将永久删除所有使用记录和统计数据，不可恢复。
                  </p>
                  <p className="text-sm text-muted-foreground">
                    输入 "RESET" 确认：
                  </p>
                  <Input
                    value={confirmReset}
                    onChange={(e) => setConfirmReset(e.target.value)}
                    placeholder="RESET"
                    className="border-destructive/50"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setShowResetDialog(false); setConfirmReset('') }}>取消</Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={confirmReset !== 'RESET'}
                      onClick={() => {
                        toast.error('重置统计功能尚未实现。')
                        setShowResetDialog(false)
                        setConfirmReset('')
                      }}
                    >
                      确认重置
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>安全配置</CardTitle>
              </div>
              <CardDescription>加密和认证配置状态。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <div className="font-medium">加密密钥</div>
                  <div className="text-sm text-muted-foreground">AES-256-GCM，通过环境变量配置。</div>
                </div>
                <span className="text-sm text-green-600 font-medium">已配置</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <div className="font-medium">JWT 密钥</div>
                  <div className="text-sm text-muted-foreground">管理后台会话签名密钥。</div>
                </div>
                <span className="text-sm text-green-600 font-medium">已配置</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">上游地址</div>
                  <div className="text-sm text-muted-foreground">https://ollama.com</div>
                </div>
                <span className="text-sm text-muted-foreground">只读</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-primary" />
                <CardTitle>日志维护</CardTitle>
              </div>
              <CardDescription>管理请求日志的保留策略。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                超过保留期限的日志将被自动清理。也可以手动触发一次清理操作。
              </p>
              <Button variant="outline" onClick={() => cleanup.mutate()} isLoading={cleanup.isPending}>
                {cleanup.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> 清理中...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-1" /> 清理过期日志
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}