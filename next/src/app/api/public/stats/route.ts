import { NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getPublicNetworkStats } from '@/lib/db-public-stats'

export const dynamic = 'force-dynamic'

/** Compteurs réseau pour la landing (lieux actifs + personnes inscrites). */
export async function GET() {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ places: 0, people: 0 }, { status: 503 })
    }
    const stats = await getPublicNetworkStats()
    return NextResponse.json({ ok: true, ...stats })
  } catch (err: unknown) {
    const e = err as { message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: 500 })
  }
}
