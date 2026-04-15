import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

const variantStyles = {
  default: 'bg-zinc-800/50 border-zinc-700/50',
  success: 'bg-emerald-950/30 border-emerald-800/30',
  warning: 'bg-amber-950/30 border-amber-800/30',
  danger: 'bg-red-950/30 border-red-800/30',
}

const iconStyles = {
  default: 'bg-zinc-700/50 text-zinc-300',
  success: 'bg-emerald-600/20 text-emerald-400',
  warning: 'bg-amber-600/20 text-amber-400',
  danger: 'bg-red-600/20 text-red-400',
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  return (
    <div className={clsx('rounded-xl border p-5', variantStyles[variant])}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="text-2xl font-semibold text-white">{value}</p>
          {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
          {trend && (
            <p className={clsx(
              'text-xs font-medium',
              trend.value < 0 ? 'text-emerald-400' : trend.value > 0 ? 'text-red-400' : 'text-zinc-400'
            )}>
              {trend.value > 0 ? '+' : ''}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div className={clsx('rounded-lg p-2.5', iconStyles[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}
