# Model a home from photos

**Model from photos** sits under the design buttons in the studio. A visitor adds up to 8 photos of
a home they like: real houses, rooms, or AI-generated renders. Claude reads them into the studio's
own choices:

- **The house:** style, stories, bedrooms, approximate size and footprint shape.
- **Roof:** pitch, covering and dormers.
- **Exterior:** cladding and colors, trim, porch, columns and railings, garage, windows, shutters,
  front door, and the roof edge and gable details.
- **Interior:** scheme, floor, kitchen finishes and living-room staging.

The engine then builds a simpler, buildable rendition with the same character. Every value is
checked against the studio's menus, and sizes snap to the 2-ft grid. If the bedrooms don't fit,
the footprint grows (or the bedroom count comes down) so the result always works. The new design
is one undoable step, and everything stays editable.

## Turning it on

The feature needs an Anthropic API key. There are two ways to supply one, and they can be used
together.

### 1. The site's own key (recommended for your team)

1. Create a key in the Claude Console: <https://console.anthropic.com/settings/keys>. Setting a
   monthly spend limit for the workspace is a good idea.
2. In Vercel, go to **Settings → Environment Variables** and add `ANTHROPIC_API_KEY` with the key.
   Apply it to Production, and to Preview if you want it on preview links. Then **redeploy**.
3. Check `https://<your-site>/api/config/`. It should include `"photo":{"available":true,…}`.

When Google sign-in is also configured (see `google-sign-in.md`), the site's key is only spent for
signed-in visitors, and `"signIn":true` shows in the config. Without accounts, anyone who visits
can use it, so keep a spend limit on the key.

### 2. A visitor's own key

Anyone can open **Use my own Anthropic API key** in the dialog and paste a key. It is sent with
that one request in the `X-Anthropic-Key` header. It is used for the call to Anthropic and is
never stored or logged by the site. The visitor can choose to remember it in their own browser.
No server setup is needed for this path.

## How it works

- `web/photo-home.ts`: the dialog.
  - Photos are shrunk in the browser to JPEG (at most 1568 px on the long edge, stepping down
    until the whole set fits in one request).
  - Calls `POST /api/photo-design/`, then hands the reading to the engine.
- `api/photo-design.js`: the server function.
  - Model: `claude-opus-5-5`, with adaptive thinking at medium effort.
  - Uses structured output, so every answer is one of the studio's options. The schema is built
    from `api/_lib/photo-options.json`.
  - Server-side refusal fallback (`fallbacks: "default"`).
  - Limits: up to 8 photos, 4 MB per request, 60 s function time (set in `vercel.json`, the most Vercel's Hobby plan allows; a reading usually takes 15–40 s).
- `rust-app/src/photo.rs`: turns the reading into a full design, starting from the visitor's
  current project. Location, prices and project costs carry over.
  - `api/_lib/photo-options.json` is generated from the engine's option lists, and a test keeps it
    in step: `UPDATE_PHOTO_OPTIONS=1 cargo test photo_options`.

## Cost

Each reading is one Claude request with the photos and roughly 1-3K tokens of output. At current
`claude-opus-5-5` prices ($4 per million input tokens, $20 per million output tokens), a set of
4-8 photos usually costs a few US cents.

## Privacy and limits

- Photos go to Anthropic only to be read. The site does not save them.
- The result is a starting design, not a survey of the photographed house. Sizes are estimated
  from doors, stories and garage doors in the photos.
- An engineer and the local building department still review every plan.
