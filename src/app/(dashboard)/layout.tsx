import { ensureUserProfile } from '@/lib/auth/ensure-user-profile'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/ui/sidebar'
import type { UserRole } from '@/types/database'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await ensureUserProfile()
  // Sidebar necesita el rol para mostrar links sólo-admin (audit log).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .maybeSingle()
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <Sidebar role={profile?.role as UserRole | undefined} />
      <main className="flex-1 overflow-y-auto bg-zinc-900">
        {children}
      </main>
    </div>
  )
}
