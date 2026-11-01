import Link from 'next/link'
import type { ReactNode } from 'react'
import { PublicSiteChrome } from '@/components/landing/PublicSiteChrome'

export function LegalDocumentLayout({
  title,
  version,
  children,
}: {
  title: string
  version: string
  children: ReactNode
}) {
  return (
    <PublicSiteChrome user={null} authLoading={false}>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10 pb-20 text-slate-200">
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">
          Document légal · v{version}
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-50 mb-6">{title}</h1>
        <div className="prose-legal space-y-4 text-sm leading-relaxed text-slate-300">
          {children}
        </div>
        <nav className="mt-12 flex flex-wrap gap-4 text-xs text-violet-300/90">
          <Link href="/cgu" className="hover:underline">
            CGU
          </Link>
          <Link href="/cgv" className="hover:underline">
            CGV
          </Link>
          <Link href="/confidentialite" className="hover:underline">
            Confidentialité
          </Link>
          <Link href="/" className="hover:underline">
            Accueil
          </Link>
        </nav>
      </main>
    </PublicSiteChrome>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-slate-100 pt-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
