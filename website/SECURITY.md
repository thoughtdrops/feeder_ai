# Security scope — October 5, 2026

The published studio serves static HTML, JavaScript, WASM and local assets. It has no application authentication, server-side user execution, database, API for storing designs, credentials or privileged actions. Exported files are created locally. The optional ZIP lookup sends a five-digit ZIP to `https://api.zippopotam.us`; it has bounded coordinates, cancellation and a 12-second timeout.

## Defenses implemented

- HTML escaping for user-visible text and bounded project/jurisdiction text.
- Typed Rust configuration parsing before calculation/generation, a 1 MB input limit, finite-number/range checks, safe identifiers, hex colors, capped unit prices, unique custom object IDs and limits on editable collections.
- Validation of UI mutations before recalculation; invalid edits retain the preceding valid design.
- Formula-safe CSV serialization with proper quoting. Dangerous formula-leading text is visibly labeled `Safe text:`; numeric data remains numeric. This reduces spreadsheet interpretation risk without relying solely on a removable quote prefix. A recipient can still alter a file and remove safeguards.
- Same-origin script policy, explicit WebAssembly permission, blocked inline JavaScript and JS eval, restricted network destinations, no plugins, no base-URL replacement or form submissions. Inline **styles** are allowed for canvas dimensions and draggable menus; inline **scripts** are not.
- Static-host configuration for CSP, no embedding, MIME-sniff prevention, referrer minimization and disabled camera/microphone/geolocation/payment/USB permissions. The HTML mirrors the main CSP for hosts that do not consume `_headers`. Header-only controls must be applied by the hosting system; the automated suite verifies configuration, not live response headers.
- Sequential report creation, Safari-compatible attached download anchors and delayed object-URL cleanup; error isolation and bounded graphics context recovery.
- Lockfile-based installs, supply-chain release-age policy and patched dependencies. The engine's source/output fingerprints are verified before production builds. No dependencies, credentials, environment files or git history are included in the download.

## Model from photos (`/api/photo-design`)

- The visitor's photos are sent to Anthropic to be read. They are shrunk in the browser first and are never stored or logged by the site. A request carries at most 8 JPEG/PNG/WebP/GIF images and 4 MB, and the answer is constrained to the studio's own option lists.
- The site's key (`ANTHROPIC_API_KEY`) stays server-side and is never returned by `/api/config`. Anyone may use it by default; with `PHOTO_REQUIRE_SIGN_IN=1` and Google sign-in configured, only signed-in visitors can. Keep a monthly spend limit on the key.
- A visitor's own key travels in the `X-Anthropic-Key` header for that one request. It is format-checked and never stored, logged or echoed back. It is kept in the visitor's browser only if they tick "Remember this key".
- The endpoint uses the same CSRF header and same-origin check as the account API. Errors come back as plain messages, without upstream details.
- The engine re-validates every value it reads before building, so a malformed or unexpected reading can't produce an invalid design.

## Dependency audit results

The final `pnpm audit --prod` reports **zero known advisories** as of this release. A full development audit reports one high-severity advisory: `braces` 3.0.3, GHSA-vfj7-8cjw-p6xm, deeply nested brace-pattern denial of service. The upstream advisory lists no published patched version. It is present only through legacy lint/build tooling (`eslint-config-next` / `vinext`), is not in the deployed browser bundles or a deployed server, and is not fed visitor data. Do not run development tooling on untrusted patterns or expose development servers publicly. Track the upstream fix and re-audit before changing deployment architecture.

Patched advisory-bearing packages include Next.js, React server components, Vite/esbuild, Babel, Browserslist, baseline-browser-mapping, fast-uri, ws, undici, js-yaml, brace-expansion, fflate and image-size. The presence of legacy server packages in source does not mean the static studio has a server endpoint.

## Limits and reporting

Automated checks do not prove immunity from every attack, browser bug or hosting-provider issue. Physical iPhone/Safari and real GPU rendering were not available in this environment. No penetration test or professional legal review has been performed. Keep the lockfile, re-audit regularly, and reassess these boundaries if adding accounts, uploads, a database, payments, external model URLs or a ForteWEB SDK.

Report a suspected issue privately to the project owner through your established contact channel. Include the version, affected action and a minimal reproduction without sharing credentials or private designs. No public reporting email has been invented for this release.

References: https://community.owasp.org/attacks/CSV_Injection ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src ; https://developers.cloudflare.com/workers/static-assets/headers/ ; https://github.com/advisories/GHSA-vfj7-8cjw-p6xm .
