'use client'

import * as React from 'react'
import { AlertCircle, RotateCw } from 'lucide-react'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ErrorAlertProps = {
  children?: React.ReactNode
  title?: React.ReactNode
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function ErrorAlert({
  children,
  title,
  onRetry,
  retryLabel = 'Retry',
  className,
}: ErrorAlertProps) {
  if (!children && !title) return null
  return (
    <Alert
      variant="destructive"
      aria-live="polite"
      className={cn('border-red-200 bg-red-50 text-red-800', className)}
    >
      <AlertCircle className="size-4" aria-hidden="true" />
      {title ? <span className="font-medium">{title}</span> : null}
      {children ? (
        <AlertDescription className="text-red-800/90">{children}</AlertDescription>
      ) : null}
      {onRetry ? (
        <AlertAction>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRetry}
            className="h-7 gap-1 px-2 text-red-800 hover:bg-red-100 hover:text-red-900"
          >
            <RotateCw className="size-3.5" aria-hidden="true" />
            {retryLabel}
          </Button>
        </AlertAction>
      ) : null}
    </Alert>
  )
}
