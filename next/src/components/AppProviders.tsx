'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { ClientErrorBoundary } from '@/components/ClientErrorBoundary'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <ClientErrorBoundary>{children}</ClientErrorBoundary>
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}
