#!/usr/bin/env node
/**
 * Bloque les balises JSX invalides connues (ex. <motion> sans framer-motion)
 * qui provoquent un écran blanc au runtime.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'next', 'src')
const PATTERNS = [
  { re: /<motion[\s>/]/, label: '<motion> (utiliser <div> ou installer framer-motion)' },
  { re: /<\/motion>/, label: '</motion>' },
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (name.endsWith('.tsx') || name.endsWith('.jsx')) out.push(path)
  }
  return out
}

let failed = false
for (const file of walk(ROOT)) {
  const content = readFileSync(file, 'utf8')
  for (const { re, label } of PATTERNS) {
    if (re.test(content)) {
      console.error(`${file}: balise invalide ${label}`)
      failed = true
    }
  }
}

if (failed) {
  console.error('\nCorrigez ces fichiers avant de lancer le serveur (écran blanc garanti sinon).')
  process.exit(1)
}

console.log('check-invalid-jsx: OK')
