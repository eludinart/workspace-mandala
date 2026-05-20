import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { isBootstrapAdminEmail } from '@/lib/admin-bootstrap'
import { listMemberDirectoryForViewer } from '@/lib/db-communities'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ communities: [], members: [] }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    let includeAll = false
    try {
      const profile = await authMe(uid)
      includeAll = isBootstrapAdminEmail(profile.email)
    } catch {
      /* visiteur standard */
    }
    const data = await listMemberDirectoryForViewer(uid, { includeAllCommunities: includeAll })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
