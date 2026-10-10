# Universal Frame update — 2026-10-09

This version applies the supplied exterior/interior/crawlspace/upper-floor/roof panel assemblies, 16 in I-joists at 16 in O.C., 4 × 16 drywall and enumerated crawlspace framing. It adds twelve tile choices, local repeating image uploads and forty more staging objects, fixes stair-related garage movement and fits 100 × 100 ft houses to desktop/portrait viewports. Earlier architecture, dormer, budget and exterior features remain.

Completed checks:

- 45 native Rust tests passed, including room-grid/layout coverage, wall/opening framing, floor/stair behavior, quantities, purchase rounding, material tax, category budgets, bulk-tier eligibility and insulation defaults.
- Compiled Rust/WASM interface tests passed, including touch event streams, compatibility-click rejection, all view switches, floor changes, wall/item edits, Undo/Redo, the new exterior options, preserved disclosures, budget resets and pricing switches.
- Three.js CPU geometry/ray tests passed for framing, edited walls/openings, stairs, furniture, garages, front/rear porches and upper-story dormer windows/rafters/opening support plies. Mobile-profile checks exercised bounded assets, renderer reuse, touch movement and cleanup.
- PDF, materials CSV and framing CSV exports passed, including separate calculated costs/category budgets/project allowances, retail/discount columns and dormer/rear-addition framing.
- Context-menu bounds, accessibility/focus handling, input escaping, bounded WASM inputs, formula-safe CSV cells, responsive rules and static security policy checks passed.
- Local image processing tests passed for JPEG/PNG/WebP normalization, bounded image/repeat sizes, SVG rejection and temporary URL cleanup.
- Strict TypeScript validation of the maintained web adapters and the production Vite build passed. The shipped WASM release fingerprints match the Rust source.

Browser/GPU visual QA was unavailable because this environment's managed preview supervisor was unavailable. DOM and CPU tests do not verify physical iPhone/WebKit/GPU behavior.

Price rates are editable retail allowances with explicitly identified published reference examples. Unquoted bulk discounts are comparison scenarios, not guaranteed supplier offers. Local product quotes, freight and final selections remain necessary. The application does not certify local code compliance or run ForteWEB structural analysis. Dormer/porch structural members and connections are provisional design/estimating geometry, not engineering approval.

The supplied construction lists are implemented as estimating defaults, not certified assemblies. Published batt nameplate ratings are preserved; the program does not assume compressed R-49 equals R-46 or assert Michigan currently permits R-38. Frame counts represent modeled pieces; procurement includes stated waste and rounding. Header sizes, support/girder layouts, holes, product fit, thermal/vapor paths and site adoption require professional review.

The complete download includes source, assets, prebuilt WASM and the ready-to-host dist directory. See README.md for hosting and rebuilding.
