import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PACKAGE_IDS = ['com.onlyus.app', 'com.onlyus.notes'];
const STABLE_VERSION_TAG = /^v?\d+\.\d+\.\d+$/;

function fail(message) {
  throw new Error(message);
}

function validateAsset(releaseInfo, tagName, repositoryName, assetName) {
  const asset = releaseInfo.assets?.find(item => item?.name === assetName);
  if (!asset || !asset.browser_download_url) fail('Published release is missing APK asset: ' + assetName);
  const url = new URL(asset.browser_download_url);
  const expectedPath = '/' + repositoryName + '/releases/download/' + tagName + '/' + encodeURIComponent(assetName);
  if (
    url.protocol !== 'https:' ||
    url.hostname.toLowerCase() !== 'github.com' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== expectedPath ||
    !Number.isSafeInteger(asset.size) ||
    asset.size < 1
  ) fail('APK asset URL/size is invalid for ' + assetName);
  return { asset, downloadUrl: asset.browser_download_url, sizeBytes: asset.size };
}

function validateSha256(value, packageId) {
  const sha256 = String(value || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) fail('Invalid SHA-256 for ' + packageId);
  return sha256;
}

function normalizeNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes.map(section => ({
    title: String(section?.title || '').trim(),
    items: Array.isArray(section?.items)
      ? section.items.map(item => String(item).trim()).filter(Boolean)
      : []
  })).filter(section => section.title && section.items.length > 0);
}

function legacyNotes(changelog) {
  const value = changelog || {};
  return normalizeNotes([
    { title: 'New features', items: value.newFeatures },
    { title: 'Improvements', items: value.improvements },
    { title: 'Bug fixes', items: value.bugFixes },
    { title: 'Other updates', items: value.otherUpdates }
  ]);
}

/**
 * Convert either the current attached schema or the legacy v1.0.x attached
 * schema into the stable latest.json shape used by the older updater clients.
 */
export function buildLatestManifest(metadata, releaseInfo, tagName, repositoryName) {
  if (!STABLE_VERSION_TAG.test(tagName)) fail('Release tag must be a stable semantic version.');
  if (releaseInfo?.tag_name !== tagName || releaseInfo?.draft || releaseInfo?.prerelease) {
    fail('GitHub release details do not match the selected stable tag.');
  }

  if (metadata?.schemaVersion === 1) {
    const versionName = String(metadata.versionName || '');
    const versionCode = Number(metadata.versionCode);
    if (
      metadata.versionTag !== tagName ||
      versionName !== tagName.replace(/^v/, '') ||
      !Number.isSafeInteger(versionCode) ||
      versionCode < 1
    ) fail('Modern metadata tag/version/versionCode is invalid.');

    const releaseNotes = normalizeNotes(metadata.releaseNotes);
    if (releaseNotes.length === 0) fail('Modern metadata has no valid release notes.');

    const editions = {};
    for (const packageId of PACKAGE_IDS) {
      const source = metadata.editions?.[packageId];
      if (source?.packageId !== packageId) fail('Modern metadata is missing package ' + packageId);
      const assetName = String(source.assetName || '');
      if (!assetName || assetName.includes('/') || assetName.includes('\\')) fail('Invalid assetName for ' + packageId);
      const { asset, downloadUrl, sizeBytes } = validateAsset(releaseInfo, tagName, repositoryName, assetName);
      const sourceUrl = String(source.downloadUrl || '');
      const sourceSize = Number(source.sizeBytes);
      if (
        sourceUrl !== downloadUrl ||
        sourceSize !== sizeBytes ||
        validateSha256(source.sha256, packageId) !== String(source.sha256).toLowerCase()
      ) fail('Modern metadata does not match published asset ' + assetName);
      editions[packageId] = {
        packageId,
        assetName,
        downloadUrl,
        sizeBytes,
        sha256: validateSha256(source.sha256, packageId)
      };
    }

    const manifest = {
      schemaVersion: 1,
      appName: String(metadata.appName || 'OnlyUs'),
      versionName,
      versionCode,
      publishedAt: String(metadata.publishedAt || releaseInfo.published_at || ''),
      releaseNotes,
      editions
    };
    if (metadata.sourceCommit) manifest.sourceCommit = String(metadata.sourceCommit);
    return manifest;
  }

  if (String(metadata?.version || '') !== tagName) {
    fail('Legacy metadata version does not match selected release tag.');
  }

  const versionName = tagName.replace(/^v/, '');
  const legacyReleases = Array.isArray(metadata.releases) ? metadata.releases : [];
  const editions = {};
  let sharedVersionCode = null;

  for (const packageId of PACKAGE_IDS) {
    const source = legacyReleases.find(item => item?.appId === packageId && item?.version === tagName);
    if (!source) fail('Legacy metadata is missing package ' + packageId);
    const versionCode = Number(source.versionCode);
    if (!Number.isSafeInteger(versionCode) || versionCode < 1) fail('Legacy versionCode is invalid for ' + packageId);
    if (sharedVersionCode !== null && sharedVersionCode !== versionCode) {
      fail('Legacy edition version codes do not match.');
    }
    sharedVersionCode = versionCode;

    const path = String(source.apkPath || '');
    const match = path.match(/^releases\/download\/(v?\d+\.\d+\.\d+)\/([^/]+)$/);
    if (!match || match[1] !== tagName) fail('Legacy APK path does not match release tag for ' + packageId);
    const assetName = decodeURIComponent(match[2]);
    const { downloadUrl, sizeBytes } = validateAsset(releaseInfo, tagName, repositoryName, assetName);
    editions[packageId] = {
      packageId,
      assetName,
      downloadUrl,
      sizeBytes,
      sha256: validateSha256(source.sha256, packageId)
    };
  }

  const releaseNotes = legacyNotes(metadata.changelog);
  if (releaseNotes.length === 0) fail('Legacy metadata has no valid changelog entries.');

  return {
    schemaVersion: 1,
    appName: 'OnlyUs',
    versionName,
    versionCode: sharedVersionCode,
    publishedAt: String(metadata.releaseDate || releaseInfo.published_at || ''),
    releaseNotes,
    editions
  };
}

async function main() {
  const metadataPath = process.env.METADATA_PATH;
  const releaseInfoPath = process.env.RELEASE_INFO_PATH;
  const selectedTag = process.env.SELECTED_TAG;
  const repositoryName = process.env.REPOSITORY_NAME || process.env.GITHUB_REPOSITORY;
  const outputPath = process.env.OUTPUT_PATH || resolve('latest.json');
  if (!metadataPath || !releaseInfoPath || !selectedTag || !repositoryName) {
    fail('METADATA_PATH, RELEASE_INFO_PATH, SELECTED_TAG and REPOSITORY_NAME are required.');
  }

  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  const releaseInfo = JSON.parse(await readFile(releaseInfoPath, 'utf8'));
  const manifest = buildLatestManifest(metadata, releaseInfo, selectedTag, repositoryName);
  await writeFile(outputPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('Rebuilt latest.json for ' + manifest.versionName + ' (versionCode ' + manifest.versionCode + ').');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
