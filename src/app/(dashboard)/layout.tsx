import { ensureUserProfile } from '@/lib/auth/ensure-user-profile'
import { Sidebar } from '@/components/ui/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await ensureUserProfile()
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-900">
        {children}
      </main>
    </div>
  )
}
