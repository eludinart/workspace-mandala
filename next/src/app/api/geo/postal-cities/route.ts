import { NextRequest, NextResponse } from 'next/server'
import { lookupCitiesByPostalCode } from '@/lib/geo-postal-lookup'

export const dynamic = 'force-dynamic'

/** GET ?code=37000 — communes FR pour un code postal (données publiques). */
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')?.trim() ?? ''
    if (!/^\d{5}$/.test(code)) {
      return NextResponse.json(
        { error: 'Indiquez un code postal à 5 chiffres', cities: [] },
        { status: 422 }
      )
    }
    const cities = await lookupCitiesByPostalCode(code)
    return NextResponse.json({ postal_code: code, cities })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    return NextResponse.json(
      { error: e.message || 'Erreur', cities: [] },
      { status: e.status && e.status >= 400 ? e.status : 500 }
    )
  }
}
