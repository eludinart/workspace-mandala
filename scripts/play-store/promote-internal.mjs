#!/usr/bin/env node
/**
 * Place versionCode 1 on the internal testing track as completed.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { google } from 'googleapis'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '../..')
const keyPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(REPO, 'nogit/play-certs/play-api-sa.json')
const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'))
const pkg = 'art.eludein.mandala'
const versionCode = String(process.argv[2] || '1')

const auth = new google.auth.GoogleAuth({
  credentials: key,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
})
const ap = google.androidpublisher({ version: 'v3', auth })

const edit = await ap.edits.insert({ packageName: pkg, requestBody: {} })
const editId = edit.data.id
console.log('edit', editId)

await ap.edits.tracks.update({
  packageName: pkg,
  editId,
  track: 'internal',
  requestBody: {
    track: 'internal',
    releases: [
      {
        name: `${versionCode} (${versionCode})`,
        versionCodes: [versionCode],
        status: 'completed',
      },
    ],
  },
})

const committed = await ap.edits.commit({ packageName: pkg, editId })
console.log('committed', committed.data.id || 'ok')

const check = await ap.edits.insert({ packageName: pkg, requestBody: {} })
const eid = check.data.id
const track = await ap.edits.tracks.get({
  packageName: pkg,
  editId: eid,
  track: 'internal',
})
console.log(JSON.stringify(track.data, null, 2))
await ap.edits.delete({ packageName: pkg, editId: eid })
