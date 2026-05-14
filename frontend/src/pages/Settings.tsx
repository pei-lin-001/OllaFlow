import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Shield, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/api/client'
import { toast } from 'sonner'

export default function Settings() {
  const [confirmReset, setConfirmReset] = useState('')
  const [showResetDialog, setShowResetDialog] = useState(false)

  const cleanup = useMutation({
    mutationFn: api.cleanup,
    onSuccess: (data: any) => {
      toast.success(`已清理 ${data.deleted || 0} 条过期日志记录`)
    },
    onError: (e: any) => toast.error(e.message),
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-lg font-semibold">系统设置</h2>

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
  )
}