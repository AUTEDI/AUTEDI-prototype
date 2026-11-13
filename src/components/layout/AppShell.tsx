import type { ReactNode } from 'react'
import { useAppStore } from '../../stores/useAppStore'
import { useDesktopEvents } from '../../hooks/useDesktopEvents'
import { cn } from '../../utils/cn'
import { Toast } from '../common/Toast'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { PhoneUploadModal } from '../review-flow/PhoneUploadModal'

export function AppShell({ children }: { children: ReactNode }) {
  useDesktopEvents()
  const collapsed = useAppStore((state) => state.sidebarCollapsed)

  return (
    <div
      className={cn(
        'grid min-h-screen transition-[grid-template-columns] duration-240 max-sm:block',
        collapsed ? 'grid-cols-[78px_1fr]' : 'grid-cols-[248px_1fr] sm:max-md:grid-cols-[84px_1fr]',
      )}
    >
      <Sidebar />
      <main className="col-start-2 min-w-0">
        <Topbar />
        {children}
      </main>
      <Toast />
      <PhoneUploadModal />
    </div>
  )
}
