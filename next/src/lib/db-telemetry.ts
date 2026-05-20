import { exec, getPool, isDbConfigured, table } from './db'

export type TelemetryEventRow = {
  ts: string
  event_name: string
  user_id: number | null
  anon_id: string | null
  path: string | null
  feature: string | null
  env: string | null
  properties: Record<string, unknown>
}

let _tableEnsured = false

export async function ensureTelemetryTable(): Promise<void> {
  if (_tableEnsured || !isDbConfigured()) return
  const pool = getPool()
  const t = table('app_events')
  await exec(
    pool,
    `CREATE TABLE IF NOT EXISTS ${t} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      ts DATETIME(3) NOT NULL,
      event_name VARCHAR(80) NOT NULL,
      user_id BIGINT NULL,
      anon_id VARCHAR(64) NULL,
      path VARCHAR(255) NULL,
      feature VARCHAR(64) NULL,
      env VARCHAR(24) NULL,
      properties_json JSON NULL,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_ts (ts),
      KEY idx_event_ts (event_name, ts),
      KEY idx_user_ts (user_id, ts)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
  _tableEnsured = true
}

export async function insertTelemetryEvents(events: TelemetryEventRow[]): Promise<number> {
  if (!isDbConfigured() || !events.length) return 0
  await ensureTelemetryTable()
  const pool = getPool()
  const t = table('app_events')
  const values: unknown[] = []
  const rowsSql: string[] = []
  for (const ev of events) {
    rowsSql.push('(?, ?, ?, ?, ?, ?, ?, ?)')
    values.push(
      new Date(ev.ts),
      ev.event_name,
      ev.user_id,
      ev.anon_id,
      ev.path,
      ev.feature,
      ev.env,
      JSON.stringify(ev.properties ?? {})
    )
  }
  const sql = `INSERT INTO ${t} (ts, event_name, user_id, anon_id, path, feature, env, properties_json) VALUES ${rowsSql.join(',')}`
  const [result] = await exec(pool, sql, values)
  return (result as { affectedRows?: number }).affectedRows ?? 0
}

export async function listTelemetryEvents(params: {
  fromIso?: string
  toIso?: string
  eventName?: string
  limit?: number
}): Promise<Record<string, unknown>[]> {
  if (!isDbConfigured()) return []
  await ensureTelemetryTable()
  const pool = getPool()
  const t = table('app_events')
  const where: string[] = []
  const args: unknown[] = []
  if (params.fromIso) {
    where.push('ts >= ?')
    args.push(new Date(params.fromIso))
  }
  if (params.toIso) {
    where.push('ts <= ?')
    args.push(new Date(params.toIso))
  }
  if (params.eventName) {
    where.push('event_name = ?')
    args.push(params.eventName)
  }
  const limit = Math.min(500, Math.max(1, params.limit ?? 200))
  const sql = `SELECT id, ts, event_name, user_id, path, feature, env, properties_json
    FROM ${t} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ts DESC LIMIT ?`
  const [rows] = await exec(pool, sql, [...args, limit])
  return ((rows as Record<string, unknown>[]) ?? []).map((x) => ({
    id: x.id,
    ts: x.ts,
    name: x.event_name,
    user_id: x.user_id,
    path: x.path,
    feature: x.feature,
    env: x.env,
    properties: (() => {
      try {
        return x.properties_json ? JSON.parse(String(x.properties_json)) : {}
      } catch {
        return {}
      }
    })(),
  }))
}

export async function clearTelemetryEvents(): Promise<void> {
  if (!isDbConfigured()) return
  await ensureTelemetryTable()
  const pool = getPool()
  await exec(pool, `TRUNCATE TABLE ${table('app_events')}`)
}
