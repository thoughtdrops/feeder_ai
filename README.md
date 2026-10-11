# Universal Frame

A 3D home design studio and factory-build simulator for US residential projects.

- **Design studio** (`website/`): choose a style, size and finishes, edit walls and openings in 3D, inspect every framing piece, and get a live material takeoff and budget. The engine (layout, framing, quantities, pricing, structural screening) is Rust compiled to WebAssembly in `website/rust-app/`; views are three.js in `website/web/`.
- **Process simulator** (`website/public/process/`): builds the studio design from helical piers to a closed-in shell, piece by piece, on a site clock.

The site is fully static: no server, database or sign-up. Designs stay in the visitor's browser.

## Develop

Requirements: Node.js 22.13+, pnpm 11.25.0 (`corepack enable`), and for engine changes Rust 1.90.0 with the `wasm32-unknown-unknown` target and `wasm-bindgen-cli` 0.2.104.

```sh
cd website
pnpm install --frozen-lockfile
pnpm dev            # studio at http://localhost:5173
pnpm test           # type check + studio feature tests
pnpm test:rust      # engine tests
pnpm build:engine   # rebuild the WebAssembly engine after Rust changes, then:
node scripts/rust-release.mjs record   # record its fingerprints (the build verifies them)
pnpm build          # production site in website/dist
```

## Deploy

Vercel builds from `vercel.json` (repository root) or `website/vercel.json` (if the project's root directory is `website`): install with pnpm, `node scripts/build-rust-site.mjs`, publish `dist/`. Security headers and caching are defined there. Set `SITE_URL` (or rely on Vercel's production domain) so canonical, sharing and sitemap URLs are absolute.

CI (`.github/workflows/ci.yml`) runs the engine tests, release-fingerprint check, type check, feature tests and a production build on every pull request.

## Accounts (Sign in with Google, saved builds)

Visitors can sign in with Google and save builds to their profile (serverless functions in `website/api/`, wrapped by `api/` so either Vercel root directory works). Without these settings the site still works: builds are saved in the visitor's browser and no sign-in is offered.

Set these environment variables in Vercel (Project → Settings → Environment Variables), then redeploy:

| Variable | Where it comes from |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application. Add the site address (e.g. `https://yourdomain.com`) under Authorized JavaScript origins. |
| `SESSION_SECRET` | Any random string of 32+ characters (e.g. `openssl rand -base64 48`). |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel → Storage → add the Upstash Redis integration to the project; it sets both automatically. |

`/api/config/` reports whether accounts are active. API tests: `pnpm test:api`.

## Scope

Quantities and checks follow the 2021 IRC/IECC and prices are US dollars. Measurements default to US customary units; visitors can switch the display to metric. Estimates and structural screening are preliminary and must be reviewed by licensed professionals.

