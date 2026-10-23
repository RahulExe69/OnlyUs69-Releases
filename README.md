# OnlyUs — Android Releases

Official release repository for the OnlyUs Android application.

This repository hosts signed APKs and version metadata used by the app's update system. It is a distribution endpoint, not the application's source-code repository.

## Downloads

Visit the [Releases](https://github.com/RahulExe69/OnlyUs69-Releases/releases) page to view available versions and download assets.

| File | Description |
| --- | --- |
| `OnlyUs.apk` | Standard Android edition |
| `Notes.apk` | Notes edition |

Choose the edition that matches the app you intend to install. Installing an APK from outside Google Play requires Android's permission for that installation source.

## Update metadata

- **Current updater:** Newer app builds discover the latest published release through the GitHub Releases API and verify the release-attached `onlyus-update-metadata.json` asset.
- **Legacy updater compatibility:** Older installed builds may still read [latest.json](https://raw.githubusercontent.com/RahulExe69/OnlyUs69-Releases/main/latest.json). Keep this file synchronized with the newest published release so those installations do not remain stuck on an older version.
- The metadata includes version information, edition-specific APK URLs, release notes, file sizes, and SHA-256 hashes. The APK hashes must match the published assets exactly.

## Verification and safety

- Download APKs only from this repository's official [Releases](https://github.com/RahulExe69/OnlyUs69-Releases/releases) page.
- Review the release notes before updating.
- Android may ask you to approve installation from your browser or file manager.
- Do not install a file if its source or integrity cannot be verified.

## Privacy

This repository is intended to distribute application releases and update metadata. Please do not use release notes or repository metadata to publish private personal information.

---

Maintained as the official OnlyUs release channel.
