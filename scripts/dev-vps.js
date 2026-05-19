#!/usr/bin/env node
/**
 * Tunnel SSH → MariaDB Mandala (VPS Coolify) + Next.js dev (port 3002).
 * Usage : npm run dev.vps
 * Config : sync-config.env (SSH_VPS_*, TUNNEL_LOCAL_PORT, VPS_DB_PORT, LOCAL_*)
 */
import { spawn, spawnSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { platform } from 'os'

const NEXT_DEV_PORT = 3002

function killListenersOnPortWin(port) {
  const r = spawnSync('cmd', ['/c', 'netstat -ano'], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
  const pids = new Set()
  for (const line of (r.stdout || '').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('TCP')) continue
    const parts = trimmed.split(/\s+/).filter(Boolean)
    if (parts.length < 5) continue
    const localAddr = parts[1]
    const state = parts[3]
    const pid = parts[parts.length - 1]
    if (!/LISTEN/i.test(state)) continue
    const lm = localAddr.match(/:(\d+)$/)
    if (!lm || Number(lm[1]) !== port) continue
    if (!/^\d+$/.test(pid)) continue
    pids.add(pid)
  }
  for (const pid of pids) {
    if (pid === String(process.pid)) continue
    spawnSync('taskkill', ['/F', '/T', '/PID', pid], { stdio: 'ignore' })
  }
}

function killListenersOnPort(port) {
  const n = Number(port)
  if (!Number.isFinite(n) || n < 1 || n > 65535) return
  if (platform() === 'win32') {
    killListenersOnPortWin(n)
    return
  }
  const r = spawnSync('sh', ['-c', `lsof -nP -iTCP:${n} -sTCP:LISTEN -t 2>/dev/null`], {
    encoding: 'utf8',
  })
  const pids = [...new Set(r.stdout.trim().split(/\n/).filter(Boolean))]
  for (const pid of pids) {
    if (pid === String(process.pid)) continue
    spawnSync('kill', ['-9', pid], { stdio: 'ignore' })
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
  const env = { ...process.env }
  for (const p of [resolve(ROOT, 'sync-config.env'), resolve(ROOT, '.env')]) {
    if (existsSync(p)) {
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/)
        if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  }
  return env
}

const env = loadEnv()
const SSH_HOST = env.SSH_VPS_HOST || '187.124.42.135'
const SSH_USER = env.SSH_VPS_USER || 'root'
const TUNNEL_PORT = env.TUNNEL_LOCAL_PORT || '3308'
const VPS_DB_PORT = env.VPS_DB_PORT || '3307'
const dbTarget = '127.0.0.1'

console.log(
  `\n🔗 Mandala — tunnel SSH → ${SSH_USER}@${SSH_HOST}  localhost:${TUNNEL_PORT} → VPS ${dbTarget}:${VPS_DB_PORT}\n`,
)

const portsToFree = [...new Set([Number(TUNNEL_PORT), NEXT_DEV_PORT])].filter(
  (p) => Number.isFinite(p) && p > 0,
)
for (const p of portsToFree) killListenersOnPort(p)

function buildSshOpts() {
  return [
    '-N',
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'ServerAliveInterval=15',
    '-o',
    'ServerAliveCountMax=6',
    '-o',
    'TCPKeepAlive=yes',
    '-o',
    'ConnectTimeout=10',
    '-o',
    'StrictHostKeyChecking=no',
    '-L',
    `${TUNNEL_PORT}:${dbTarget}:${VPS_DB_PORT}`,
    `${SSH_USER}@${SSH_HOST}`,
  ]
}

let tunnel = spawn('ssh', buildSshOpts(), { stdio: 'inherit' })
let nextProcess = null
let exiting = false
let lastRestart = 0

function onTunnelError(err) {
  console.error('Impossible de lancer le tunnel SSH :', err.message)
  process.exit(1)
}

function onTunnelClose() {
  if (nextProcess && !exiting) {
    const now = Date.now()
    if (now - lastRestart < 5000) {
      console.error('\n❌ Tunnel inaccessible. Relancez npm run dev.vps.')
      process.exit(1)
    }
    lastRestart = now
    console.error('\n⚠ Tunnel SSH fermé. Reconnexion dans 2 s...')
    setTimeout(() => {
      tunnel = spawn('ssh', buildSshOpts(), { stdio: 'inherit' })
      tunnel.on('error', onTunnelError)
      tunnel.on('close', onTunnelClose)
    }, 2000)
  }
}

tunnel.on('error', onTunnelError)
tunnel.on('close', onTunnelClose)

setTimeout(() => {
  console.log('\n▶  Démarrage Next.js Mandala (port 3002)...\n')
  killListenersOnPort(NEXT_DEV_PORT)

  const nextEnv = {
    ...process.env,
    ...env,
    MARIADB_HOST: '127.0.0.1',
    MARIADB_PORT: TUNNEL_PORT,
    MARIADB_DATABASE: env.LOCAL_DB || 'default',
    MARIADB_USER: env.LOCAL_USER || 'mariadb',
    MARIADB_PASSWORD: env.LOCAL_PASS || '',
    MARIADB_POOL_LIMIT: env.MARIADB_POOL_LIMIT || '2',
    MARIADB_VIA_TUNNEL: 'true',
    MARIADB_TUNNEL_TARGET: SSH_HOST,
    DB_PREFIX: env.DB_PREFIX || 'mdl_',
    JWT_SECRET: env.JWT_SECRET || 'change_me_dev_mandala_only',
    NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002',
  }

  nextProcess = spawn('npm', ['run', 'dev', '--prefix', 'next'], {
    stdio: 'inherit',
    shell: true,
    env: nextEnv,
    cwd: ROOT,
  })

  nextProcess.on('close', (code) => {
    exiting = true
    tunnel.kill()
    process.exit(code ?? 0)
  })
}, 2000)

function shutdown() {
  exiting = true
  if (nextProcess) nextProcess.kill()
  tunnel.kill()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
