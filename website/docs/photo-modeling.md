# Model a home from photos, floor plans and listing links

**Model from photos** sits under the design buttons in the studio. A visitor can add any mix of:

- **Photos** (up to 8): real houses, rooms, or AI-generated renders.
- **A floor plan** (up to 3 images or PDFs, one per floor): a listing's floor plan, a blueprint or
  a sketch. This is what makes the size and layout exact.
- **A listing link**: Claude opens the page and pulls its photos, floor plan, living area, beds,
  baths and stories (see "Listing links" below for which sites allow this).

Claude reads the photos into the studio's own choices:

- **The house:** style, stories, bedrooms, approximate size and footprint shape.
- **Roof:** pitch, covering and dormers.
- **Exterior:** cladding and colors, trim, porch, columns and railings, garage, windows, shutters,
  front door, and the roof edge and gable details.
- **Interior:** scheme, floor, kitchen finishes and living-room staging.

It traces the floor plan into rooms: a name, a type, and a rectangle in feet measured from the
front-left corner of the house. The photos and the plan are read at the same time.

The engine then builds the home:

- **With a floor plan**, the house takes the plan's width and depth (to the nearest 2 ft) and its
  number of floors. Every room is built at its traced size and position, so the walls match the
  plan.
  - Overlaps go to the smaller room, gaps go to the rooms beside them, and leftover space becomes a
    hall or closet. Every floor is covered exactly once.
  - Baths, bedrooms and kitchens keep a workable minimum size.
  - The stair is the same 8 × 16 ft stair on every floor.
  - Rooms behind the main block become an L, T or U wing; garages, porches and decks are not rooms.
  - Doors follow the studio's usual room rules, and each room is furnished by its type: beds in
    bedrooms, toilets and vanities in baths, sofas in living rooms.
  - Changing the width or depth later scales the traced rooms. Changing the style or generating a
    new home returns to the catalog plans.
- **Without a floor plan**, the listing's living area (or the photos' estimate) sets the footprint
  and a catalog plan of the matching style supplies the rooms. If the bedrooms don't fit, the
  footprint grows (or the bedroom count comes down) so the result always works.

Every value is checked against the studio's menus. The new design is one undoable step, and
everything stays editable.

## Turning it on

The feature needs an Anthropic API key. There are two ways to supply one, and they can be used
together.

### 1. The site's own key (recommended for your team)

1. Create a key in the Claude Console: <https://console.anthropic.com/settings/keys>. Setting a
   monthly spend limit for the workspace is a good idea.
2. In Vercel, go to **Settings → Environment Variables** and add `ANTHROPIC_API_KEY` with the key.
   Apply it to Production, and to Preview if you want it on preview links. Then **redeploy**.
3. Check `https://<your-site>/api/config/`. It should include `"photo":{"available":true,…}`.

By default anyone who visits can use the site's key, with no sign-in, so keep a spend limit on the
key. To limit it to signed-in visitors later, set up Google sign-in (see `google-sign-in.md`), add
`PHOTO_REQUIRE_SIGN_IN` = `1` in the same Environment Variables screen and redeploy. The config then
shows `"signIn":true`, and visitors who are not signed in can still paste their own key.

### 2. A visitor's own key

Anyone can open **Use my own Anthropic API key** in the dialog and paste a key. It is sent with
that one request in the `X-Anthropic-Key` header. It is used for the call to Anthropic and is
never stored or logged by the site. The visitor can choose to remember it in their own browser.
No server setup is needed for this path.

## How it works

- `web/photo-home.ts`: the dialog.
  - Photos are shrunk in the browser to JPEG (at most 1568 px on the long edge, stepping down
    until the whole set fits in one request). Floor plans stay sharper (up to 2400 px), and PDFs are
    sent as they are (up to 3.5 MB).
  - Runs `POST /api/photo-design/` twice at once: `task: "home"` for the photos and `task: "plan"`
    for the floor plan. Then it merges the two readings and hands them to the engine.
  - If either reading fails, the other still builds a home, and the result says what was missing.
- `api/photo-design.js`: the reading function.
  - Model: `claude-opus-5-5`, with adaptive thinking at medium effort.
  - Uses structured output, so every answer is one of the studio's options. The photo schema is
    built from `api/_lib/photo-options.json`; the plan schema lists rooms as rectangles.
  - Listing photos and plans are passed to Claude by their links (public https only).
- `api/listing.js`: the listing reader. Claude opens the link with Anthropic's web fetch tool, so
  this site never downloads the page. It returns the facts and the photo and floor-plan links
  (public https only, at most 10 photos and 3 plans).
- `api/_lib/claude.js`: shared key handling, client and plain-language errors.
  - Server-side refusal fallback (`fallbacks: "default"`).
  - Limits: up to 8 photos, 4 MB per request, 60 s function time (set in `vercel.json`, the most Vercel's Hobby plan allows; a reading usually takes 15–40 s).
- `rust-app/src/photo.rs`: turns the reading into a full design, starting from the visitor's
  current project. Location, prices and project costs carry over.
- `rust-app/src/traced.rs`: fits traced rooms onto the 2-ft grid so each floor is covered exactly
  once. The result is stored in the design as `tracedPlan`, so it saves and reopens with the build.
  - `api/_lib/photo-options.json` is generated from the engine's option lists, and a test keeps it
    in step: `UPDATE_PHOTO_OPTIONS=1 cargo test photo_options`.

## Listing links

Many listing and broker sites can be read this way. Zillow, Redfin and Realtor.com usually block
automated readers. Zillow's terms of use also forbid automated access to its listings. When a site
blocks the reader, the dialog says so. The fastest fallback is to save the listing's photos and
floor-plan image and drop them into the dialog.

For listings at volume, a licensed feed is the reliable route: your MLS's IDX/RESO Web API, or
Zillow's Bridge API for brokers. A listing's photo and floor-plan links can then be passed straight
to `/api/photo-design` as `imageUrls`.

## Cost

Each build makes up to three Claude requests: the photos, the floor plan, and (with a link) the
listing page. At current `claude-opus-5-5` prices ($4 per million input tokens, $20 per million
output tokens), a build usually costs a few US cents to around ten cents.

## Privacy and limits

- Photos go to Anthropic only to be read. The site does not save them.
- The result is a starting design, not a survey of the house.
  - With a floor plan, sizes come from its written dimensions, to the nearest 2 ft.
  - Without one, sizes are estimated from the listing's living area, or from doors, stories and
    garage doors in the photos.
  - Curved walls, angled rooms and front bump-outs are simplified to the rectangles and rear wings
    the studio builds.
- An engineer and the local building department still review every plan.
