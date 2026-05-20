#!/usr/bin/env node
/** Applique docs/schema/005_mandala_events_media.sql sur la DB VPS (tunnel 3308). */
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(resolve(__dirname, '../next/package.json'))
const mysql = require('mysql2/promise')

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* optional */
  }
}
for (const f of ['../next/.env.local', '../sync-config.env', '../.env']) {
  loadEnvFile(resolve(__dirname, f))
}

const sql = readFileSync(resolve(__dirname, '../docs/schema/005_mandala_events_media.sql'), 'utf8')
const statements = sql
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith('--'))

const pool = await mysql.createPool({
  host: process.env.MARIADB_HOST || process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.MARIADB_PORT || process.env.DB_PORT || 3308),
  user: process.env.MARIADB_USER || process.env.DB_USER || 'mariadb',
  password: process.env.MARIADB_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MARIADB_DATABASE || process.env.DB_NAME || 'default',
  multipleStatements: true,
})

for (const st of statements) {
  try {
    await pool.query(st)
    console.log('OK:', st.slice(0, 60).replace(/\s+/g, ' ') + '…')
  } catch (e) {
    console.warn('Skip or error:', e.message)
  }
}
await pool.end()
console.log('Terminé.')
