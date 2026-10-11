# Universal Frame — Home Design Studio

A responsive house-design and preliminary estimating studio. The authoritative layout, edits, quantities, budget, validation and UI run in Rust/WebAssembly. Three.js supplies browser rendering; PDF/CSV adapters use the Rust model. The published application is a static site, with no application server, database, signup or automatic design upload.

## Run the finished version

Use Node.js 22.13 or newer and the pinned pnpm 11.25.0. The source includes the compiled Rust/WASM engine, its release fingerprints, assets and dependency lockfiles.

```sh
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm build
pnpm exec vite preview --config vite.rust.config.mjs --host 127.0.0.1
```

The output in `dist/` can be served by a static HTTPS host. Do not open `index.html` directly with `file://`; the browser must fetch the WASM and models over HTTP(S). Apply `public/_headers` on hosts that support it, or configure equivalent HTTP headers. Serve `.wasm` as `application/wasm`. The HTML also carries a fallback Content Security Policy. Do not publish the development server.

For editing browser styles or rendering adapters, `pnpm dev` runs the working studio. Safari 16+, current iOS Safari, Android Chrome and current desktop browsers are the intended targets; WebGL is required for 3D. A floor-plan view and downloads remain available when the graphics renderer cannot initialize. There is no guarantee that every GPU or browser version will work.

## Edit and rebuild Rust

Use a standard Rust toolchain (the `pnpm test:rust` and `pnpm build:engine` scripts use it automatically when no portable toolchain is present):

```sh
rustup toolchain install 1.90.0
rustup target add wasm32-unknown-unknown --toolchain 1.90.0
cargo install wasm-bindgen-cli --version 0.2.104 --locked
cargo +1.90.0 test --manifest-path rust-app/Cargo.toml --locked
cargo +1.90.0 build --manifest-path rust-app/Cargo.toml --release --target wasm32-unknown-unknown --locked
wasm-bindgen rust-app/target/wasm32-unknown-unknown/release/universal_frames.wasm --target web --out-dir public/pkg
node scripts/rust-release.mjs record
pnpm build
```

`rust-app/src/` owns the model and interaction logic; `rust-app/data/` owns catalogs and reference data. Edit the maintained renderer and report adapters directly in `web/`. `scripts/port-renderer.mjs` verifies the maintained entry points and does not overwrite them. Legacy React/Next source is retained for adapter provenance; it is not the deployed UI or a deployed server.

## Features

- House dimensions from 8–100 ft on a 2 ft grid; two-story shells start at 24 ft wide. Architecture applies a matching footprint and floor plan, while dimensions remain editable.
- Fifteen architectural presets using documented historical/public-domain references, multiple roof forms, style-specific materials, thirty interior schemes, separate bedroom/general wallpapers, ten trim packages and one hundred documented millwork sections.
- Affordable and Premium generation plus Blank slate; staged furniture and finishes, adjustable colors, normal/oversized trim, 3D exterior/interior/walkthrough, floor plan and framing views.
- Click-based wall/opening/object editing, wall-edge resizing, sideways movement, rotation, snapped placement, keyboard controls and Undo/Redo. Floor changes preserve custom edits. Blank-slate stairs snap to the 2 ft grid and accept click or drag-and-release placement. Inserting them downstairs clears upper-floor wall segments and items around the stairwell and approach, while preserving the original work for move/delete/Undo. Framing, finishes and quantities use the same cleared geometry.
- Attached/detached 24 × 24 ft two-car garages on either side. Proposed bearing walls and user-supplied floor loads feed preliminary floor-joist screening.
- Fixed-pivot orbit without inertia, uncluttered exterior and interior views. Right-drag/two-finger pan, pinch zoom, arrow-key movement and Reset view remain available. Walkthrough uses one-finger look and two-finger drag to move.
- Dormers with gable, hip or shed roofs in 2/4/8/16 ft module envelopes, checked against continuous parent roof planes. Roof openings cut the roof and rafter geometry, with provisional doubled LVL support framing. Six roof-edge moldings, gable-only accent panels and roof finials/spires; selectable window types and medium/large generated sizes. Style-matched or custom rear decks/covered porches join the front reference porch.
- Collapsed itemized categories with editable budget totals, retained calculated quantities and prices, ordering waste and material tax. Materials total and the four project-cost allowances are shown separately. Retail and wholesale/bulk estimate modes use a published ZIP panel example tier plus editable, explicitly unquoted volume scenarios. Rates are not a live local-store feed or guaranteed wholesale quotes. Labor ($10,000), land ($10,000), permits ($8,000) and survey ($4,000) are added once as editable allowances, without material tax or waste.
- Owner-specified factory assemblies: exterior/interior 2×6 walls at 24 in O.C.; default 92-5/8 in precuts plus three plates (97-1/8 in total plate height); nonbearing flat 2×6 door headers and provisional two-ply 2×10/2×12 exterior headers with 2 in foam. ZIP 7/16 wall and 5/8 roof panels, taped openings/seams, horizontal 1×4 rainscreen furring and insect screens, 29-gauge ribbed metal and 4 × 16 pre-painted drywall.
- First-floor crawlspace modules use 16 in I-joists at 16 in O.C., LSL rims, OSB bottom protective board, 1 in polyiso with foil tape, R-30 + R-19 unfaced batts and glue-nailed 23/32 AdvanTech. Upper floors use the same joist depth/grid and subfloor, with optional R-19 unfaced sound batts. Crawlspace girders, stem walls and piers are clearly marked design allowances.
- Roof panels use 16 in I-joists at 16 in O.C., R-49 kraft-faced batts (or R-38 high-density plus R-11, facing on the inner layer only), at least 1-1/2 in vent channels, screened eave/ridge rims, purlins, Ice & Water Shield and door snow-retention allowances. Net roof-batt area clips actual roof planes to the heated footprint, excluding garages, porches and overhangs. R-21 kraft-faced exterior-wall batts and optional R-13 unfaced bedroom/bath partition batts are separate. User assemblies stay selected when climate targets change; unresolved energy paths and installed product performance remain review holds.
- Twelve tile finishes for floors and separate bedroom/general walls, with live tile/underlay/mortar/grout estimates. Local JPEG/PNG/WebP pattern uploads for those wall groups or floors, adjustable repeat size and removal; uploads normalize to a bounded JPEG and remain in downloaded design JSON. A custom floor image changes appearance while retaining the selected floor material estimate.
- Forty additional selectable, scaled staging objects, from seating/storage to nursery, bath, kitchen and office pieces. Five variants reuse existing licensed photographic/PBR models; other additions use detailed modeled geometry and existing local materials. This is interactive real-time 3D, not a promise of photograph-level fidelity for every object.
- Responsive camera fitting handles the full 8–100 ft range in desktop and portrait viewports. Inserting, rotating, deleting or moving blank-slate stairs leaves garage position fixed; crawlspace I-joist webs/flanges are visible in framing mode.
- ZIP lookup or manual state/county selection; insulation/electrical estimates and explicit local-review holds. ZIP sheathing and associated tapes are priced; separate vapor membranes are excluded and flagged for review.
- PDF, itemized-material CSV, framing-piece CSV and design JSON exports. The public Site loads without studio signup. Designs and custom images are not automatically saved: export the design JSON before leaving. Uploaded images are processed in the browser and are not sent to an image server.

## Verification

```sh
node scripts/port-renderer.mjs
pnpm check:web
pnpm test:features
pnpm audit --prod
```

In the managed workspace, `pnpm test:rust` uses the portable toolchain. Elsewhere use the standard `cargo test` command above.

The automated suites cover all architectural presets, dimension bounds and room grids, roof and floor geometry, framing around openings, quantity/cost reconciliation, garage/stair schedules, both floors, wall/object edits and rotations, undo, material controls, exports, iOS-style touch-only and mixed pointer/click events, context menus, scene recovery, security inputs and keyboard-accessible dialogs. The scene suite checks actual Three.js geometry and picking with a CPU adapter; it does not certify WebGL output or physical iPhone/Safari hardware. The current environment has no supported browser-preview control, so a real-device visual/GPU smoke test remains necessary.

## Engineering and legal scope

These are preliminary concepts, model quantities and editable sample prices, **not approved plans or certified code/structural results**. Roof framing uses I-joist rafters and a four-ply LVL ridge allowance; final member sizes, loads, bearings, supports, opening headers, concentrated loads, connections, bracing, footings and foundations require an engineer. Historical designs are not modern approved construction sets. The tool screens some dimensions and uniform floor spans; it cannot establish building safety, accessibility or complete code compliance.

ForteWEB is **not automatically connected**. Weyerhaeuser SDK access has not been supplied and no third-party agreement has been accepted. The official links and manual review exports remain available; Universal Frame files are not official ForteWEB import files. See https://www.forteweb.com/ and https://www.weyerhaeuser.com/woodproducts/software-learning/forte-software/weyerhaeuser-interoperability-license/.

The footer and Terms & privacy dialog explain estimating limitations, professional review, privacy, warranty exclusions and liability limitations to the extent permitted by applicable law. These terms do not waive non-waivable rights or guarantee immunity from claims. The text is in `rust-app/src/ui/legal.rs`; review it with counsel for your business and jurisdiction before commercial reliance.

Read `SECURITY.md` for the defense model, audit results and one remaining development-only advisory. Preserve all asset notices in `public/materials/`, `public/models/` and the reference catalogs. The original frame icon is retained; the new generated wordmark is documented in `docs/brand-logo.md`.

## Sidebar, reference porches and themes — October 2026

The Layout menu is ordered as dimensions, architectural style, stories, bedrooms, wall height/roof pitch, garage, compass-facing direction, and the collapsed Home history disclosure. History contains the roof/architecture explanation, floor program, original builder/catalog information and reference drawing. Materials contains labor, land, permits, survey, waste and tax controls. The four whole-project allowances also appear as editable rows in the material table, are charged once, and receive neither material waste nor material tax.

A persistent device-local Light/Dark toggle switches darker gray surfaces and the original charcoal palette without changing the house or undo history. It remains usable when browser storage is blocked.

Reference-informed porch footprints include the Sears No. 114 front veranda, Craftsman and farmhouse returns, Colonial side veranda (including its upper deck for two-story houses), cottage side veranda, sheltered Tudor entrance and coastal/ranch porches. Returns are omitted on the side occupied by a garage; blank shells and the smallest footprints receive no automatic porch. These remain adapted visual concepts, not exact historical reconstructions or approved structural plans. Porches have separate live materials, roof planes/I-joists, columns, decking, rails, steps, coatings and connections. Covered footprint and total deck surface are distinct.

Exterior window/door mouldings use deeper sealed-wood stock, textured source contours and style-specific rosettes, keystones, dentils, layered caps or beads. Relief pieces are counted and included in coating allowances. Relief geometry is merged and shared to reduce draw calls. Historic section scaling and coating coverage are estimates; fabrication and engineering details require verification.

Additional checks: `node scripts/tests/theme-check.mjs`; the Rust porch/relief test checks footprint/deck/roof quantities, column clearance, whole-project accounting and one-time porch costs. Existing compiled-WASM interface, scene geometry and report checks continue to exercise the application.

## Finish and exterior editing update

- Finishes includes 43 wallpaper prints and 24 additional vinyl patterns. Select
  **Wallpaper each room individually** for overrides; **House default** restores
  the bedroom/general finish. A room override also replaces that room's group
  tile or custom wall pattern. Blank-slate regions follow full wall dividers,
  including door openings, with stable floor/coordinate identifiers.
- House/garage connection position can be changed in Layout or by selecting
  that door in 3D and editing its Start value. The garage footprint stays fixed.
- Walkthrough alone displays four press-and-hold arrows; use another finger
  to look. Keyboard, touch cancellation, backgrounding and cleanup are handled.
- Up to six dormers form balanced rows on continuous compatible roof slopes.
  A requested count can be reduced when roof geometry or module clearance
  does not fit; the interface explains how many fit. Placement uses no RNG.
- Style-matched upper balconies connect through real upper-floor doors. A rear
  balcony uses exterior-rated joists, posts, flashing and guards in the takeoff.
  A rear porch roof is omitted beneath a balcony. Colonial upper gallery access
  reuses the existing porch material schedule. All elevated structures remain
  preliminary designs for professional structural and local-code review.
- Furniture variants have separate geometry and retain complete colored
  shapes while detailed local GLB assets load. Cached model resources are
  cloned per instance so changing views cannot invalidate other instances.

The additional print assets are original artwork generated by
`python scripts/create-finish-assets.py` (Pillow and NumPy needed only to
regenerate). Vinyl wood grain derives from the credited CC0 oak map. All
finished assets, including bounded mobile copies, are included in source.

Automated checks cover the Rust model, compiled WASM interaction, touch-only
and mixed pointer flows, CPU geometry, local GLB parsing, reports and resource
cleanup. They do not certify physical iPhone/Android GPU rendering.
