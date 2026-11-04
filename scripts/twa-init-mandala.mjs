/**
 * Non-interactive Bubblewrap init for Mandala TWA.
 * Usage (from repo root, JAVA_HOME set):
 *   node scripts/twa-init-mandala.mjs
 */
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const bubblewrapCliRoot = dirname(
  require.resolve('@bubblewrap/cli/package.json', {
    paths: [
      join(process.env.APPDATA || '', 'npm/node_modules'),
      join(process.env.HOME || '', '.npm-global/lib/node_modules'),
    ],
  })
)
const core = require(join(bubblewrapCliRoot, 'node_modules/@bubblewrap/core'))
const { TwaManifest, TwaGenerator, Config } = core

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const targetDirectory = join(repoRoot, 'android-twa')
const nogitDir = join(repoRoot, 'nogit')
const keystorePath = join(nogitDir, 'mandala-upload.keystore')
const secretsPath = join(nogitDir, 'mandala-twa-signing.env')

const MANIFEST_URL = 'https://mandala.eludein.art/manifest.webmanifest'
const PACKAGE_ID = 'art.eludein.mandala'

function randomPassword(len = 24) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

mkdirSync(targetDirectory, { recursive: true })
mkdirSync(nogitDir, { recursive: true })

console.log('Fetching web manifest…')
let twaManifest = await TwaManifest.fromWebManifest(MANIFEST_URL)

twaManifest.host = 'mandala.eludein.art'
// dist=play : détecté par resolvePaymentSurface() pour bloquer Stripe in-app.
twaManifest.startUrl = '/app?dist=play'
twaManifest.name = 'Mandala'
twaManifest.launcherName = 'Mandala'
// Play Console a déjà figé ce package (sans suffixe .twa).
twaManifest.packageId = PACKAGE_ID
twaManifest.appVersionName = '1'
twaManifest.appVersionCode = 1
twaManifest.display = 'standalone'
twaManifest.orientation = 'default'
twaManifest.iconUrl = twaManifest.iconUrl || 'https://mandala.eludein.art/icon-512.png'
twaManifest.maskableIconUrl =
  twaManifest.maskableIconUrl || 'https://mandala.eludein.art/icon-512.png'
twaManifest.shortcuts = []
twaManifest.features = {
  ...(twaManifest.features || {}),
  playBilling: { enabled: true },
  locationDelegation: { enabled: false },
}
twaManifest.signingKey = {
  path: keystorePath,
  alias: 'mandala',
}

const configPath = join(process.env.USERPROFILE || process.env.HOME, '.bubblewrap', 'config.json')
const rawConfig = JSON.parse(readFileSync(configPath, 'utf8'))
const config = new Config(rawConfig.jdkPath, rawConfig.androidSdkPath)

await twaManifest.saveToFile(join(targetDirectory, 'twa-manifest.json'))
console.log('Generating Android project…')
const generator = new TwaGenerator()
await generator.createTwaProject(targetDirectory, twaManifest, config)

let keystorePassword
let keyPassword
if (existsSync(secretsPath)) {
  const env = Object.fromEntries(
    readFileSync(secretsPath, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i), l.slice(i + 1)]
      })
  )
  keystorePassword = env.BUBBLEWRAP_KEYSTORE_PASSWORD
  keyPassword = env.BUBBLEWRAP_KEY_PASSWORD
}

if (!existsSync(keystorePath)) {
  keystorePassword = keystorePassword || randomPassword()
  keyPassword = keyPassword || randomPassword()
  writeFileSync(
    secretsPath,
    [
      '# Secrets TWA Mandala — NE PAS COMMITTER',
      `BUBBLEWRAP_KEYSTORE_PASSWORD=${keystorePassword}`,
      `BUBBLEWRAP_KEY_PASSWORD=${keyPassword}`,
      `BUBBLEWRAP_KEYSTORE_PATH=${keystorePath}`,
      `BUBBLEWRAP_KEY_ALIAS=mandala`,
      '',
    ].join('\n'),
    { mode: 0o600 }
  )
  console.log('Creating upload keystore…')
  const keytool = join(rawConfig.jdkPath, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool')
  const r = spawnSync(
    keytool,
    [
      '-genkeypair',
      '-v',
      '-keystore',
      keystorePath,
      '-alias',
      'mandala',
      '-keyalg',
      'RSA',
      '-keysize',
      '2048',
      '-validity',
      '10000',
      '-storepass',
      keystorePassword,
      '-keypass',
      keyPassword,
      '-dname',
      'CN=Élude In Art, OU=Mandala, O=Élude In Art, L=France, C=FR',
    ],
    { encoding: 'utf8' }
  )
  if (r.status !== 0) {
    console.error(r.stdout)
    console.error(r.stderr)
    process.exit(1)
  }
} else {
  console.log('Keystore already exists, reusing.')
}

console.log('Done.')
console.log(`Project: ${targetDirectory}`)
console.log(`Keystore: ${keystorePath}`)
console.log(`Secrets: ${secretsPath}`)
