'use client'

import { useState } from 'react'
import { ImageLightbox } from '@/components/ImageLightbox'

export function MemberGalleryRail({
  images,
  label = 'Photos',
}: {
  images: string[]
  label?: string
}) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const list = images.filter(Boolean).slice(0, 2)

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
        <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  )
}
