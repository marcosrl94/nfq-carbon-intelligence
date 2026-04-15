import { clsx } from 'clsx'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

const styles = {
  default: 'bg-zinc-700/50 text-zinc-300',
  success: 'bg-emerald-600/20 text-emerald-400',
  warning: 'bg-amber-600/20 text-amber-400',
  danger: 'bg-red-600/20 text-red-400',
  info: 'bg-blue-600/20 text-blue-400',
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', styles[variant])}>
      {children}
    </span>
  )
}
