#!/usr/bin/env node
/**
 * Push Mandala store listing (FR) to Google Play via Android Publisher API.
 * Reads fastlane-compatible metadata under android-twa/fastlane/metadata/android.
 *
 * Auth: service-account JSON
 *   - env GOOGLE_APPLICATION_CREDENTIALS = path to JSON
 *   - or env GOOGLE_PLAY_JSON_KEY = path
 *   - or default nogit/play-certs/play-api-sa.json
 *
 * Usage:
 *   node sync.mjs
 *   node sync.mjs --dry-run
 *   node sync.mjs --texts-only
 *   node sync.mjs --images-only
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const PACKAGE_NAME = "art.eludein.mandala";
const LANGUAGE = "fr-FR";
const META_ROOT = path.join(
  REPO_ROOT,
  "android-twa",
  "fastlane",
  "metadata",
  "android",
  LANGUAGE
);

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const textsOnly = args.has("--texts-only");
const imagesOnly = args.has("--images-only");
const doTexts = !imagesOnly;
const doImages = !textsOnly;

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function readText(rel) {
  const p = path.join(META_ROOT, rel);
  if (!fs.existsSync(p)) die(`missing ${p}`);
  return fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n").trimEnd();
}

function listPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.png$/i.test(f))
    .sort()
    .map((f) => path.join(dir, f));
}

function resolveKeyFile() {
  const fromEnv =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_PLAY_JSON_KEY;
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(REPO_ROOT, "nogit", "play-certs", "play-api-sa.json");
}

async function main() {
  const title = readText("title.txt");
  const shortDescription = readText("short_description.txt");
  const fullDescription = readText("full_description.txt");

  if (title.length > 30) die(`title too long: ${title.length}/30`);
  if (shortDescription.length > 80) {
    die(`short_description too long: ${shortDescription.length}/80`);
  }
  if (fullDescription.length > 4000) {
    die(`full_description too long: ${fullDescription.length}/4000`);
  }

  const icon = path.join(META_ROOT, "images", "icon.png");
  const feature = path.join(META_ROOT, "images", "featureGraphic.png");
  const phones = listPngs(path.join(META_ROOT, "images", "phoneScreenshots"));

  console.log(`package: ${PACKAGE_NAME}`);
  console.log(`lang:    ${LANGUAGE}`);
  console.log(`title:   ${title.length} chars — ${title}`);
  console.log(`short:   ${shortDescription.length} chars`);
  console.log(`full:    ${fullDescription.length} chars`);
  console.log(`icon:    ${fs.existsSync(icon) ? icon : "MISSING"}`);
  console.log(`feature: ${fs.existsSync(feature) ? feature : "MISSING"}`);
  console.log(`phones:  ${phones.length} file(s)`);
  if (dryRun) {
    console.log("dry-run: no API calls");
    return;
  }

  const keyFile = resolveKeyFile();
  if (!fs.existsSync(keyFile)) {
    die(
      `service account JSON not found: ${keyFile}\n` +
        `See docs/PLAY-STORE-API.md (create + link SA, save as play-api-sa.json)`
    );
  }

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  const androidpublisher = google.androidpublisher({ version: "v3", auth });

  const editRes = await androidpublisher.edits.insert({
    packageName: PACKAGE_NAME,
  });
  const editId = editRes.data.id;
  if (!editId) die("edits.insert returned no edit id");
  console.log(`edit:    ${editId}`);

  try {
    if (doTexts) {
      await androidpublisher.edits.listings.update({
        packageName: PACKAGE_NAME,
        editId,
        language: LANGUAGE,
        requestBody: {
          language: LANGUAGE,
          title,
          shortDescription,
          fullDescription,
        },
      });
      console.log("listing: updated");
    }

    if (doImages) {
      if (!fs.existsSync(icon)) die(`missing icon: ${icon}`);
      if (!fs.existsSync(feature)) die(`missing feature graphic: ${feature}`);
      if (phones.length < 2) {
        die(`need ≥2 phone screenshots, found ${phones.length}`);
      }

      await uploadReplace(androidpublisher, editId, "icon", [icon]);
      await uploadReplace(androidpublisher, editId, "featureGraphic", [
        feature,
      ]);
      await uploadReplace(
        androidpublisher,
        editId,
        "phoneScreenshots",
        phones
      );
      console.log("images:  uploaded");
    }

    await androidpublisher.edits.commit({
      packageName: PACKAGE_NAME,
      editId,
    });
    console.log("commit:  ok");
  } catch (err) {
    try {
      await androidpublisher.edits.delete({
        packageName: PACKAGE_NAME,
        editId,
      });
    } catch {
      /* ignore */
    }
    throw err;
  }
}

async function uploadReplace(api, editId, imageType, files) {
  try {
    await api.edits.images.deleteall({
      packageName: PACKAGE_NAME,
      editId,
      language: LANGUAGE,
      imageType,
    });
  } catch (err) {
    const code = err?.code || err?.response?.status;
    if (code !== 404) throw err;
  }
  for (const file of files) {
    await api.edits.images.upload({
      packageName: PACKAGE_NAME,
      editId,
      language: LANGUAGE,
      imageType,
      media: {
        mimeType: "image/png",
        body: fs.createReadStream(file),
      },
    });
    console.log(`  + ${imageType}: ${path.basename(file)}`);
  }
}

main().catch((err) => {
  console.error(err?.errors || err?.message || err);
  process.exit(1);
});
