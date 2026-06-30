import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { listCommunities, seedDefaultCommunitiesIfEmpty } from '@/lib/db-communities'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    await seedDefaultCommunitiesIfEmpty()
    const items = await listCommunities()
    return NextResponse.json({ items })
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const e = err as { message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: 500 })
  }
}
