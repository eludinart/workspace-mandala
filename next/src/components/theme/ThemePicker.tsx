'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { THEME_PALETTES, THEME_PALETTE_IDS, type ThemePaletteId } from '@/lib/theme/tokens'

export function ThemePicker() {
  const { mode, palette, setMode, setPalette } = useTheme()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl hover:bg-slate-800/80 transition-colors"
        aria-label="Apparence et couleurs"
        aria-expanded={open}
        title="Apparence"
      >
        <span
          className="w-6 h-6 rounded-full border-2 border-slate-600 shadow-inner"
          style={{ backgroundColor: THEME_PALETTES[palette].swatch }}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-[min(100vw-1.5rem,17rem)] rounded-2xl border border-slate-800 bg-slate-900 shadow-xl shadow-black/40 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-200">Apparence</p>
            <div className="flex rounded-lg border border-slate-700 p-0.5 bg-slate-950/60">
              <button
                type="button"
                onClick={() => setMode('light')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  mode === 'light'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Clair
              </button>
              <button
                type="button"
                onClick={() => setMode('dark')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  mode === 'dark'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sombre
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Palette</p>
            <div className="grid grid-cols-4 gap-2">
              {THEME_PALETTE_IDS.map((id) => (
                <PaletteSwatch
                  key={id}
                  id={id}
                  selected={palette === id}
                  onSelect={() => {
                    setPalette(id)
                    setOpen(false)
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PaletteSwatch({
  id,
  selected,
  onSelect,
}: {
  id: ThemePaletteId
  selected: boolean
  onSelect: () => void
}) {
  const p = THEME_PALETTES[id]
  return (
    <button
      type="button"
      onClick={onSelect}
      title={p.label}
      className={`group flex flex-col items-center gap-1 rounded-xl p-1.5 transition-colors ${
        selected ? 'bg-slate-800 ring-2 ring-accent/60' : 'hover:bg-slate-800/60'
      }`}
    >
      <span
        className="w-8 h-8 rounded-full border border-slate-600/80 shadow-sm"
        style={{ backgroundColor: p.swatch }}
      />
      <span className="text-[9px] text-slate-400 truncate w-full text-center">{p.label}</span>
    </button>
  )
}
