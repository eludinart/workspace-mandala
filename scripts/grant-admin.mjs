#!/usr/bin/env node
/**
 * Accorde le rôle admin Mandala à un utilisateur (email ou pseudo).
 * Usage: node scripts/grant-admin.mjs ludinard
 * Env: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (comme next/.env.local)
 */
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(resolve(__dirname, '../next/package.json'))
const mysql = require('mysql2/promise')
const ident = process.argv[2]
if (!ident) {
  console.error('Usage: node scripts/grant-admin.mjs <email-ou-pseudo>')
  process.exit(1)
}

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

const pool = await mysql.createPool({
  host: process.env.MARIADB_HOST || process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.MARIADB_PORT || process.env.DB_PORT || 3308),
  user: process.env.MARIADB_USER || process.env.DB_USER || 'mariadb',
  password: process.env.MARIADB_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MARIADB_DATABASE || process.env.DB_NAME || 'default',
})

const [rows] = await pool.query(
  `SELECT ID FROM mdl_users WHERE user_email = ? OR user_login = ? LIMIT 1`,
  [ident, ident],
)
const user = rows[0]
if (!user) {
  console.error('Utilisateur introuvable:', ident)
  process.exit(1)
}
const uid = user.ID
await pool.query(
  `INSERT INTO mdl_mandala_app_roles (user_id, app_role) VALUES (?, 'admin')
   ON DUPLICATE KEY UPDATE app_role = 'admin'`,
  [uid],
)
console.log(`OK: user_id=${uid} → admin`)
await pool.end()
