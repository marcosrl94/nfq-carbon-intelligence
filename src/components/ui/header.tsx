import type { Profile } from '@/types/database'

interface HeaderProps {
  title: string
  description?: string
  profile?: Profile | null
  children?: React.ReactNode
}

export function Header({ title, description, profile, children }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/50 px-8 py-5">
      <div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {description && (
          <p className="text-sm text-zinc-400 mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-4">
        {children}
        {profile && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-zinc-200">{profile.full_name}</p>
              <p className="text-xs text-zinc-500 capitalize">{profile.role}</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-emerald-600/20 flex items-center justify-center">
              <span className="text-xs font-medium text-emerald-400">
                {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
