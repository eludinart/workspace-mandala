/** Fenêtres journalières Pilotage (jour civil Paris) — safe client. */

export type PilotageDays = 1 | 7 | 30 | 90 | 365

export const PILOTAGE_DAY_OPTIONS: ReadonlyArray<{ days: PilotageDays; label: string }> = [
  { days: 1, label: '1 j' },
  { days: 7, label: '7 j' },
  { days: 30, label: '30 j' },
  { days: 90, label: '90 j' },
  { days: 365, label: '1 an' },
]

export function isPilotageDays(n: number): n is PilotageDays {
  return n === 1 || n === 7 || n === 30 || n === 90 || n === 365
}

export function normalizePilotageDays(raw: string | null | undefined): PilotageDays {
  const n = Number(raw)
  if (isPilotageDays(n)) return n
  return 7
}
