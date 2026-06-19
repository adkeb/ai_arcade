# Artifact Protocol

## Buckets

- `game-assets`: user uploads.
- `game-artifacts`: generated runtime bundles.
- `game-covers`: reserved for future cover-only objects.

## Object Keys

- `uploads/{userId}/{assetId}/{safeFileName}`
- `games/{gameId}/v{version}/manifest.json`
- `games/{gameId}/v{version}/index.html`
- `games/{gameId}/v{version}/game.js`
- `games/{gameId}/v{version}/style.css`
- `games/{gameId}/v{version}/cover.svg`

## Manifest

```json
{
  "schemaVersion": "1.0",
  "gameId": "string",
  "version": 1,
  "title": "string",
  "description": "string",
  "runtime": "iframe-html5-canvas",
  "entry": "index.html",
  "createdByJobId": "string",
  "files": [
    { "path": "index.html", "url": "http://localhost:9000/game-artifacts/...", "sha256": "...", "contentType": "text/html" }
  ],
  "assets": [],
  "permissions": {
    "network": false,
    "storage": false,
    "parentMessaging": true
  }
}
```

## Play Loading

1. Call `GET /api/games/{gameId}/manifest`.
2. Fetch `manifestUrl` from MinIO.
3. Find `manifest.entry` in `manifest.files`.
4. Set iframe `src` to the remote entry URL.
5. Display `manifestUrl`, `entryUrl`, and `artifactBaseUrl` for verification.

## Migration to S3/OSS

The storage package uses AWS S3-compatible APIs. To migrate, change endpoint, credentials, region, and bucket names. Object key and manifest semantics remain unchanged.
