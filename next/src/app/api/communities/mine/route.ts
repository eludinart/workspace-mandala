import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { isBootstrapAdminEmail } from '@/lib/admin-bootstrap'
import { listCommunitiesForUser, syncUserToAllActiveCommunities } from '@/lib/db-communities'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    try {
      const profile = await authMe(uid)
      if (isBootstrapAdminEmail(profile.email)) {
        await syncUserToAllActiveCommunities(uid)
      }
    } catch {
      /* non bloquant */
    }
    const items = await listCommunitiesForUser(uid)
    return NextResponse.json({ items })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 401 })
  }
}
