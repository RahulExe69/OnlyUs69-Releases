import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLatestManifest } from './build-latest-manifest.mjs';

const common = {
  published_at: '2026-10-23T19:48:55Z',
  tag_name: 'v1.0.8',
  draft: false,
  prerelease: false,
  assets: [
    {
      name: 'OnlyUs-v1.0.8.apk',
      browser_download_url: 'https://github.com/RahulExe69/OnlyUs69-Releases/releases/download/v1.0.8/OnlyUs-v1.0.8.apk',
      size: 4984553
    },
    {
      name: 'Notes-v1.0.8.apk',
      browser_download_url: 'https://github.com/RahulExe69/OnlyUs69-Releases/releases/download/v1.0.8/Notes-v1.0.8.apk',
      size: 4980424
    }
  ]
};

const legacyMetadata = {
  version: 'v1.0.8',
  releaseDate: '2026-10-23T19:48:55Z',
  releases: [
    {
      appId: 'com.onlyus.app',
      version: 'v1.0.8',
      versionCode: 1008,
      apkPath: 'releases/download/v1.0.8/OnlyUs-v1.0.8.apk',
      sizeMB: 4.75,
      sha256: '93ba47ec389974b59af569de2cce535f9d60d4ba27d7d50abbe884943cf2bfc1'
    },
    {
      appId: 'com.onlyus.notes',
      version: 'v1.0.8',
      versionCode: 1008,
      apkPath: 'releases/download/v1.0.8/Notes-v1.0.8.apk',
      sizeMB: 4.75,
      sha256: 'a696e85014c3a0a4a41751213142dde09b402d13f592762e4776b863607ce69d'
    }
  ],
  changelog: {
    newFeatures: ['Support pasting clipboard images and GIFs in chat'],
    improvements: ['Improve avatar cropping and profile syncing'],
    bugFixes: ['Fix Notes media picker lifecycle and camera media options'],
    otherUpdates: ['Compact APK update screen']
  }
};

test('converts actual legacy v1.0.8 metadata to compatible latest.json schema', () => {
  const manifest = buildLatestManifest(legacyMetadata, common, 'v1.0.8', 'RahulExe69/OnlyUs69-Releases');
  assert.equal(manifest.versionName, '1.0.8');
  assert.equal(manifest.versionCode, 1008);
  assert.equal(manifest.editions['com.onlyus.app'].sizeBytes, 4984553);
  assert.equal(manifest.editions['com.onlyus.app'].assetName, 'OnlyUs-v1.0.8.apk');
  assert.equal(manifest.editions['com.onlyus.notes'].sizeBytes, 4980424);
  assert.equal(manifest.editions['com.onlyus.notes'].assetName, 'Notes-v1.0.8.apk');
  assert.equal(manifest.editions['com.onlyus.app'].sha256, legacyMetadata.releases[0].sha256);
  assert.equal(manifest.releaseNotes.length, 4);
});

test('rejects a legacy release tag mismatch rather than publishing stale APK links', () => {
  const releaseForOlderTag = { ...common, tag_name: 'v1.0.7' };
  assert.throws(
    () => buildLatestManifest(legacyMetadata, releaseForOlderTag, 'v1.0.7', 'RahulExe69/OnlyUs69-Releases'),
    /Legacy metadata version does not match selected release tag/
  );
});

test('rejects missing exact APK assets and malformed asset hashes', () => {
  const withoutNotes = { ...common, assets: common.assets.slice(0, 1) };
  assert.throws(
    () => buildLatestManifest(legacyMetadata, withoutNotes, 'v1.0.8', 'RahulExe69/OnlyUs69-Releases'),
    /missing APK asset/
  );

  const badMetadata = structuredClone(legacyMetadata);
  badMetadata.releases[0].sha256 = 'not-a-hash';
  assert.throws(
    () => buildLatestManifest(badMetadata, common, 'v1.0.8', 'RahulExe69/OnlyUs69-Releases'),
    /Invalid SHA-256/
  );
});

test('converts modern metadata without changing the verified APK asset identity', () => {
  const releaseInfo = {
    ...common,
    tag_name: 'v1.0.9',
    assets: [
      {
        name: 'OnlyUs.apk',
        browser_download_url: 'https://github.com/RahulExe69/OnlyUs69-Releases/releases/download/v1.0.9/OnlyUs.apk',
        size: 5000000
      },
      {
        name: 'Notes.apk',
        browser_download_url: 'https://github.com/RahulExe69/OnlyUs69-Releases/releases/download/v1.0.9/Notes.apk',
        size: 4990000
      }
    ]
  };
  const metadata = {
    schemaVersion: 1,
    appName: 'OnlyUs',
    versionName: '1.0.9',
    versionTag: 'v1.0.9',
    versionCode: 1000009,
    publishedAt: releaseInfo.published_at,
    sourceCommit: 'a'.repeat(40),
    releaseNotes: [{ title: 'Fixes', items: ['Test fix'] }],
    editions: {
      'com.onlyus.app': {
        packageId: 'com.onlyus.app',
        assetName: 'OnlyUs.apk',
        downloadUrl: releaseInfo.assets[0].browser_download_url,
        sizeBytes: 5000000,
        sha256: '93ba47ec389974b59af569de2cce535f9d60d4ba27d7d50abbe884943cf2bfc1'
      },
      'com.onlyus.notes': {
        packageId: 'com.onlyus.notes',
        assetName: 'Notes.apk',
        downloadUrl: releaseInfo.assets[1].browser_download_url,
        sizeBytes: 4990000,
        sha256: 'a696e85014c3a0a4a41751213142dde09b402d13f592762e4776b863607ce69d'
      }
    }
  };
  const manifest = buildLatestManifest(metadata, releaseInfo, 'v1.0.9', 'RahulExe69/OnlyUs69-Releases');
  assert.equal(manifest.versionName, '1.0.9');
  assert.equal(manifest.versionCode, 1000009);
  assert.equal(manifest.sourceCommit, 'a'.repeat(40));
  assert.equal(manifest.editions['com.onlyus.app'].sizeBytes, 5000000);
});

test('rejects a URL outside the official release path', () => {
  const altered = structuredClone(common);
  altered.assets[0].browser_download_url = 'https://evil.example/RahulExe69/OnlyUs69-Releases/releases/download/v1.0.8/OnlyUs-v1.0.8.apk';
  assert.throws(
    () => buildLatestManifest(legacyMetadata, altered, 'v1.0.8', 'RahulExe69/OnlyUs69-Releases'),
    /APK asset URL.*invalid/
  );
});
