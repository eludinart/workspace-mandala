import mysql from 'mysql2/promise'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim()
}

const prefix = process.env.DB_PREFIX || 'mdl_'
const pool = mysql.createPool({
  host: process.env.MARIADB_HOST,
  port: parseInt(process.env.MARIADB_PORT || '3306', 10),
  database: process.env.MARIADB_DATABASE,
  user: process.env.MARIADB_USER,
  password: process.env.MARIADB_PASSWORD,
})
const tC = `${prefix}mandala_communities`
const [rows] = await pool.query(`SELECT avatar, LENGTH(avatar) as len FROM ${tC} WHERE id=1`)
console.log('avatar len:', rows[0]?.len ?? 0)
await pool.end()
