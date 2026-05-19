import { NextResponse } from 'next/server'
import { listCommunities, seedDefaultCommunitiesIfEmpty } from '@/lib/db-communities'

export const dynamic = 'force-dynamic'

export async function GET() {
  await seedDefaultCommunitiesIfEmpty()
  const items = await listCommunities()
  return NextResponse.json({ items })
}
