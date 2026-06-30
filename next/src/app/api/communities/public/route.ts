import { NextResponse } from 'next/server'
import { listPublicCommunitiesForLanding } from '@/lib/db-communities'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ items: [] }, { status: 503 })
    }
    const items = await listPublicCommunitiesForLanding()
    return NextResponse.json({ items })
  } catch (err: unknown) {
    const e = err as { message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: 500 })
  }
}
