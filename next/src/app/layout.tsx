import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AppProviders } from '@/components/AppProviders'
import { ThemeInitScript } from '@/components/theme/ThemeInitScript'

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: {
    default: 'Mandala — Lieux & communautés',
    template: '%s · Mandala',
  },
  description: 'Lieux, communautés et événements — France et espace francophone',
  ...(appUrl ? { metadataBase: new URL(appUrl) } : {}),
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Mandala',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="h-full font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
