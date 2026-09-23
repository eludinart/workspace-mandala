'use client'

import { useEffect, useRef } from 'react'

/**
 * Publie la hauteur réellement visible (--vvh) et l'espace masqué par la
 * barre du navigateur (--vv-bottom-inset). Sur iPhone, 100vh reste la grande
 * fenêtre même quand la barre d'adresse recouvre le bas.
 */
export function VisualViewportSync() {
  const probeRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const root = document.documentElement
    let frame = 0

    const sync = () => {
      const vv = window.visualViewport
      const height = vv?.height ?? window.innerHeight
      const offsetTop = vv?.offsetTop ?? 0
      const large = probeRef.current?.getBoundingClientRect().height || window.innerHeight
      const bottom = Math.max(0, Math.round(large - offsetTop - height))
      const nextHeight = `${Math.round(height)}px`
      const nextTop = `${Math.round(offsetTop)}px`
      const nextBottom = `${bottom}px`
      if (root.style.getPropertyValue('--vvh') !== nextHeight) {
        root.style.setProperty('--vvh', nextHeight)
      }
      if (root.style.getPropertyValue('--vv-offset-top') !== nextTop) {
        root.style.setProperty('--vv-offset-top', nextTop)
      }
      if (root.style.getPropertyValue('--vv-bottom-inset') !== nextBottom) {
        root.style.setProperty('--vv-bottom-inset', nextBottom)
      }
    }

    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(sync)
    }

    sync()
    const vv = window.visualViewport
    vv?.addEventListener('resize', schedule)
    vv?.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    return () => {
      cancelAnimationFrame(frame)
      vv?.removeEventListener('resize', schedule)
      vv?.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
    }
  }, [])

  return (
    <span
      ref={probeRef}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 h-lvh w-0 invisible"
    />
  )
}
