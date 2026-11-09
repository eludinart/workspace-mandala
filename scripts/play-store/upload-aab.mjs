/**
 * Upload AAB to Play internal track and commit edit.
 * Usage: node scripts/play-store/upload-aab.mjs [path-to.aab]
 */
import { createReadStream } from 'fs'
import { resolve } from 'path'
import { google } from 'googleapis'

const packageName = process.env.PLAY_PACKAGE_NAME || 'art.eludein.mandala'
const aabPath = resolve(
  process.argv[2] || 'android-twa/app/build/outputs/bundle/release/app-release.aab'
)
const keyFile =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  resolve('nogit/play-certs/play-api-sa.json')

const auth = new google.auth.GoogleAuth({
  keyFile,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
})
const ap = google.androidpublisher({ version: 'v3', auth })

const edit = await ap.edits.insert({ packageName })
const editId = edit.data.id
console.log('edit', editId)

const bundle = await ap.edits.bundles.upload({
  packageName,
  editId,
  media: {
    mimeType: 'application/octet-stream',
    body: createReadStream(aabPath),
  },
})
console.log('bundle versionCode', bundle.data.versionCode)

await ap.edits.tracks.update({
  packageName,
  editId,
  track: 'internal',
  requestBody: {
    track: 'internal',
    releases: [
      {
        name: `FCM native ${bundle.data.versionCode}`,
        status: 'completed',
        versionCodes: [String(bundle.data.versionCode)],
      },
    ],
  },
})

const commit = await ap.edits.commit({ packageName, editId })
console.log('committed', commit.data.id)
