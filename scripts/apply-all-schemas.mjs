#!/usr/bin/env node
/**
 * Applique les migrations SQL docs/schema/*.sql (ordre 001 → 007).
 * Dev : tunnel actif (MARIADB_PORT=3308 via sync-config / .env.local).
 * Prod : depuis le VPS ou machine avec accès réseau coolify à MariaDB.
 */
import { createRequire } from 'module'
import { readFileSync, readdirSync } from 'fs'
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
for (const f of ['../next/.env.local', '../sync-config.env', '../docker-compose.env', '../.env']) {
  loadEnvFile(resolve(__dirname, f))
}

const prefix = process.env.DB_PREFIX || 'mdl_'
const schemaDir = resolve(__dirname, '../docs/schema')
const files = readdirSync(schemaDir)
  .filter((f) => /^\d{3}_.*\.sql$/.test(f))
  .sort()

const pool = await mysql.createPool({
  host: process.env.MARIADB_HOST || '127.0.0.1',
  port: Number(process.env.MARIADB_PORT || 3308),
  user: process.env.MARIADB_USER || 'mariadb',
  password: process.env.MARIADB_PASSWORD || '',
  database: process.env.MARIADB_DATABASE || 'default',
  multipleStatements: true,
})

console.log(`DB ${process.env.MARIADB_HOST}:${process.env.MARIADB_PORT}/${process.env.MARIADB_DATABASE} prefix=${prefix}`)
console.log(`Fichiers : ${files.join(', ')}\n`)

for (const file of files) {
  let sql = readFileSync(resolve(schemaDir, file), 'utf8')
  sql = sql.replace(/\bmdl_/g, prefix)
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('--'))
  console.log(`--- ${file} (${statements.length} requêtes) ---`)
  for (const st of statements) {
    try {
      await pool.query(st)
      console.log('  OK:', st.slice(0, 70).replace(/\s+/g, ' ') + '…')
    } catch (e) {
      console.warn('  WARN:', e.message)
    }
  }
}

await pool.end()
console.log('\nMigrations terminées.')
