'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  Factory,
  Target,
  FileText,
  Settings,
  LogOut,
  Leaf,
  Sprout,
  ShieldCheck,
  Compass,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@/types/database'

interface NavItem {
  name: string
  href: string
  icon: typeof LayoutDashboard
  /** Si está presente, sólo se muestra a usuarios con uno de estos roles. */
  roles?: UserRole[]
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Emisiones', href: '/emissions', icon: Factory },
  { name: 'Removals', href: '/removals', icon: Sprout },
  { name: 'Materialidad', href: '/materiality', icon: Compass },
  { name: 'Objetivos', href: '/targets', icon: Target },
  { name: 'Disclosures', href: '/disclosures', icon: FileText },
  { name: 'Configuración', href: '/settings', icon: Settings },
  { name: 'Audit log', href: '/admin/audit-log', icon: ShieldCheck, roles: ['admin'] },
]

export function Sidebar({ role }: { role?: UserRole }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-zinc-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
          <Leaf className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white leading-none">Carbon Intelligence</h1>
          <p className="text-[11px] text-zinc-500 mt-0.5">by NFQ</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          if (item.roles && (!role || !item.roles.includes(role))) return null
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-emerald-600/10 text-emerald-400'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-zinc-800 px-3 py-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
