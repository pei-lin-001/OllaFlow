import React, { useState, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'

type DialogCtx = { open: boolean; setOpen: (v: boolean) => void }

const DialogContext = createContext<DialogCtx | null>(null)

function Dialog({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (v: boolean) => void }) {
  return <DialogContext.Provider value={{ open, setOpen: onOpenChange }}>{children}</DialogContext.Provider>
}

function DialogTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const ctx = useContext(DialogContext)
  if (!ctx) return null
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, {
      onClick: () => ctx.setOpen(true),
    } as any)
  }
  return <button onClick={() => ctx.setOpen(true)}>{children}</button>
}

function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const ctx = useContext(DialogContext)
  if (!ctx || !ctx.open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => ctx.setOpen(false)}>
      <div
        className={cn(
          'relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg rounded-xl',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function DialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}>{children}</div>
}

function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)}>{children}</h2>
}

function DialogDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>
}

function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}>{children}</div>
}

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter }
