'use client'

import { useEffect, useState } from 'react'

export function MemberGalleryRail({
  images,
  label = 'Photos',
}: {
  images: string[]
  label?: string
}) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const list = images.filter(Boolean).slice(0, 2)

  useEffect(() => {
    if (!lightbox) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  if (!list.length) return null

  return (
    <>
      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</h4>
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {list.map((src, i) => (
            <li key={`${i}-${src.slice(0, 24)}`} className="shrink-0">
              <button
                type="button"
                onClick={() => setLightbox(src)}
                className="block overflow-hidden rounded-xl border border-slate-700 bg-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-28 w-40 object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      </section>
      {lightbox && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Aperçu photo"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
