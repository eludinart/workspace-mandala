'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { ClientErrorBoundary } from '@/components/ClientErrorBoundary'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ClientErrorBoundary>{children}</ClientErrorBoundary>
      </NotificationProvider>
    </AuthProvider>
  )
}
