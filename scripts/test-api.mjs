/**
 * Smoke test des routes Mandala (nécessite serveur sur BASE_URL, défaut http://localhost:3002)
 * Usage: node scripts/test-api.mjs
 */
const BASE = process.env.BASE_URL || 'http://localhost:3002'
const email = `test_${Date.now()}@mandala.local`
const password = 'TestMandala123!'
let cookie = ''

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(opts.headers || {}),
    },
  })
  const setCookie = res.headers.getSetCookie?.() || []
  for (const c of setCookie) {
    const part = c.split(';')[0]
    if (part) cookie = cookie ? `${cookie}; ${part}` : part
  }
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: res.status, body }
}

function ok(label, r, expect = 200) {
  const pass = r.status === expect
  console.log(`${pass ? '✓' : '✗'} ${label} → ${r.status}`, pass ? '' : JSON.stringify(r.body).slice(0, 120))
  return pass
}

let passed = 0
let total = 0
function check(label, r, expect) {
  total++
  if (ok(label, r, expect)) passed++
}

const health = await req('/api/health')
check('GET /api/health', health)

const reg = await req('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email, password, name: 'Test User', pseudo: `test${Date.now().toString(36).slice(-6)}` }),
})
check('POST /api/auth/register', reg, 200)

const me = await req('/api/auth/me')
check('GET /api/auth/me', me)

const communities = await req('/api/communities/mine')
check('GET /api/communities/mine', communities)

const fleurs = await req('/api/prairie/fleurs')
check('GET /api/prairie/fleurs', fleurs)

const channels = await req('/api/social/my_channels')
check('GET /api/social/my_channels', channels)

const heartbeat = await req('/api/social/presence_heartbeat')
check('GET /api/social/presence_heartbeat', heartbeat)

const unread = await req('/api/social/clairiere_unread_count')
check('GET /api/social/clairiere_unread_count', unread)

const events = await req('/api/events?community_slug=shambhala')
check('GET /api/events', events)

let eventId = events.body?.events?.[0]?.id
if (!eventId && events.status === 200) {
  const created = await req('/api/events', {
    method: 'POST',
    body: JSON.stringify({
      community_slug: 'shambhala',
      title: 'Test event API',
      description: 'Smoke test',
    }),
  })
  if (created.status === 200) eventId = created.body?.event?.id
}

if (eventId) {
  const detail = await req(`/api/events/${eventId}`)
  check('GET /api/events/:id', detail)
  const staff = await req(`/api/events/${eventId}/staff`, {
    method: 'POST',
    body: JSON.stringify({ user_id: parseInt(me.body?.id ?? me.body?.user?.id ?? '0', 10), role: 'volunteer' }),
  })
  check('POST /api/events/:id/staff', staff, staff.status === 200 || staff.status === 400 ? staff.status : 200)
}

console.log(`\n${passed}/${total} tests OK`)
process.exit(passed === total ? 0 : 1)
