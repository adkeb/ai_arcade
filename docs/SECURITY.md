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
- `navigator.credentials`
- `window.top`
- geolocation and media capture

## Runtime Isolation

Play uses:

```html
<iframe sandbox="allow-scripts">
```

It intentionally does not set `allow-same-origin`, so the game cannot read parent-origin storage or cookies. Parent/iframe communication uses `postMessage`, and the parent validates message shape with a schema.

## CSP

Generated HTML includes a restrictive CSP:

```html
default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src data: blob:; connect-src 'none'
```

`'unsafe-inline'` is an MVP tradeoff because generated files are simple static bundles. Production should use hash-based CSP, no inline script, strict asset hashing, and a dedicated sandbox domain.

## Secrets

Secrets are read only on the server. `SESSION_SECRET`, S3 credentials, and model keys are never exposed to client components.

## Resource Limits

The MVP limits upload size and Worker lock duration. Production should add per-user quotas, CPU timeouts, artifact size limits, malware scanning, and abuse monitoring.
