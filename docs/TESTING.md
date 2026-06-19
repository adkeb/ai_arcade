# Testing

## Local Verification

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev:all
```

Run infrastructure separately or use Docker Compose:

```bash
docker compose up --build
```

## Automated Checks

```bash
pnpm typecheck
pnpm lint
pnpm --filter @ai-arcade/web build
pnpm test:e2e:install-deps
pnpm test:e2e
```

Run `pnpm typecheck` and Next build commands sequentially. Next rebuilds `.next/types`, so running typecheck and build at the same time can produce transient missing-file errors that do not represent source type failures.

`pnpm test:e2e:install-deps` installs the Chromium browser binary plus Linux runtime libraries. `pnpm test:e2e` expects the app and Docker Compose services to be running. It verifies Home renders database games, search/tag filtering works, Details shows artifact/version metadata, Play fetches a remote MinIO manifest, the iframe loads a remote `index.html`, Create can publish a generated game, and screenshots are saved under `test-results/screenshots/`.

Expected screenshots: `auth-oauth.png`, `home.png`, `details.png`, `play.png`, `create-published.png`, and `social-details.png`.

## Manual Checklist

- Register a new account.
- Log in with `creator@example.com` / `password123`.
- Click GitHub/Google login without provider credentials and confirm a clear OAuth configuration error appears.
- Confirm `/create` redirects to `/login` when logged out.
- Upload a file from Create.
- Create a generation job and watch Agent logs.
- Confirm MinIO has files under `game-assets` and `game-artifacts`.
- Preview the generated draft.
- Confirm Play displays `manifestUrl`, `entryUrl`, and `artifactBaseUrl`.
- Publish the game.
- Confirm Home lists the new published game from the database.
- Search by the new title and open its Details page.
- Like and favorite the published game while logged in.
- Use Remix from Create history to reload a prior prompt and assets.
- Open Play from Home and confirm it loads from object storage.

## Troubleshooting

- If Create stays `pending`, start the worker with `pnpm worker` or use Docker Compose.
- If browser fetch of MinIO fails, verify bucket policy and CORS from `minio-init`.
- If local shell cannot reach `http://minio:9000`, use the Docker host port `S3_ENDPOINT=http://localhost:9002`.
