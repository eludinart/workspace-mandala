#!/usr/bin/env node
/** Applique docs/schema/007_mandala_communities_profile.sql (tunnel VPS 3308). */
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

const prefix = process.env.DB_PREFIX || 'mdl_'
const sql = readFileSync(resolve(__dirname, '../docs/schema/007_mandala_communities_profile.sql'), 'utf8')
  .replace(/mdl_mandala_communities/g, `${prefix}mandala_communities`)

const statements = sql
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith('--'))

const pool = await mysql.createPool({
  host: process.env.MARIADB_HOST || '127.0.0.1',
  port: Number(process.env.MARIADB_PORT || 3308),
  user: process.env.MARIADB_USER || 'mariadb',
  password: process.env.MARIADB_PASSWORD || '',
  database: process.env.MARIADB_DATABASE || 'default',
  multipleStatements: true,
})

for (const stmt of statements) {
  console.log('→', stmt.slice(0, 80).replace(/\s+/g, ' '), '…')
  await pool.query(stmt)
}
console.log('OK — schéma 007 appliqué')
await pool.end()
