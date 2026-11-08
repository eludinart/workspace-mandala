'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { ClientErrorBoundary } from '@/components/ClientErrorBoundary'
import { QueryProvider } from '@/components/QueryProvider'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ThemeProvider>
          <NotificationProvider>
            <ClientErrorBoundary>{children}</ClientErrorBoundary>
          </NotificationProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryProvider>
  )
}
