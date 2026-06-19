# Security

## Uploads

- Upload API requires login.
- File size is capped by `MAX_UPLOAD_MB`.
- Accepted types are images, videos, PDF, JSON, markdown, text, and octet-stream.
- Object keys use generated asset IDs and sanitized file names.

## Prompt Injection

Uploaded assets and prompts are treated as untrusted. The local generator does not execute prompt content. A real model integration should separate instructions from user content, validate JSON schemas, and restrict tool access.

## Generated Code Review

`SafetyReviewAgent` blocks:

- `eval`
- `new Function`
- `document.cookie`
- `localStorage` / `sessionStorage`
- external script URLs
- external `fetch`
- `WebSocket`
- dynamic imports, workers, service workers, Cache API, IndexedDB, clipboard, opener, and top/parent navigation
- inline `<script>`, `<style>`, event handler attributes, and `style=` attributes
- forms, frames, embedded objects, `<base>`, and meta refresh
- `navigator.credentials`
- `window.top`
- geolocation and media capture

## Runtime Isolation

Play uses:

```html
<iframe
  sandbox="allow-scripts"
  referrerpolicy="no-referrer"
  allow="... 'none'"
></iframe>
```

It intentionally does not set `allow-same-origin`, so the game cannot read parent-origin storage or cookies. It also denies browser feature policy capabilities such as camera, microphone, geolocation, clipboard, payment, fullscreen, and USB. Parent/iframe communication uses `postMessage`, and the parent validates message shape with a schema.

## CSP

Generated HTML includes a restrictive CSP:

```html
default-src 'none'; script-src 'self'; style-src 'self'; img-src data: blob:;
font-src 'none'; media-src 'none'; connect-src 'none'; worker-src 'none';
frame-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'
```

Generated games are split into `index.html`, `style.css`, and `game.js`, so inline script/style is not needed. Production should still serve generated artifacts from a dedicated sandbox origin with HTTP-level CSP headers, per-user quotas, CPU timeouts, artifact size limits, and abuse monitoring.

## Secrets

Secrets are read only on the server. `SESSION_SECRET`, S3 credentials, model keys, and OAuth provider tokens are never exposed to client components. OAuth access/refresh tokens are encrypted at rest with AES-256-GCM using a key derived from `SESSION_SECRET`.

## Resource Limits

The MVP limits upload size and Worker lock duration. Production should add per-user quotas, CPU timeouts, artifact size limits, malware scanning, and abuse monitoring.
