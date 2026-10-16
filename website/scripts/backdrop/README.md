# Neighborhood backdrop

The viewer's surroundings are a **modeled street** (`web/neighborhood.ts`): one straight residential street in
front of the lot with curbs, sidewalks, tree lawns, driveways, mailboxes and street lamps; six kinds of
finished homes (colonial, brick, farmhouse, ranch, Cape Cod, craftsman) across the street and beside the lot;
instanced street trees, a big sand dune behind the lot and a hazy wooded horizon. The visitor's own lot gets a
driveway from the garage to the street, a front walk, a mailbox and a cedar backyard fence.
`public/backdrop/backdrop.json` selects it with `"mode":"neighborhood"`; the photograph is used only for the sky
and for reflections.

Everything is cheap to draw and loads after the house:

- Asphalt, concrete, siding, garage-door and shutter textures are drawn on canvases in the browser (0 bytes).
- Each home is merged into one mesh per material; the whole street is roughly 240 draw calls on desktop.
- Trees are instanced; trees away from the house use a lighter leaf set and cast no shadows. Phones get fewer
  homes and trees and no distant tree ring.
- The street is built once per page and reused across scene rebuilds.

Downloads: `public/neighborhood/trees.bin` (720 KB, ~440 KB gzipped), bark and leaf textures (~250 KB) and
`public/backdrop/sky-4k.jpg` (280 KB; `sky-2k.jpg`, 99 KB, on phones).

## Regenerating assets

- **Sky:** `python3 -I scripts/backdrop/make_sky.py <8192×4096 panorama> public/backdrop` keeps the sky above the
  rooftops, eases it into haze at the horizon and evens out the sun streak.
- **Trees:** `node scripts/backdrop/bake_trees.mjs <ez-tree lib> public/neighborhood/trees.bin` bakes the oak, ash,
  aspen and bush presets of [ez-tree](https://github.com/dgreenheck/ez-tree) (MIT, Daniel Greenheck) into one
  quantized binary. See the script header for preparing the library copy.

`mirror_street.py` and `lawn_lot.py` produced the earlier photo-stage backdrop (photo `mode` unset), which
`web/backdrop.ts` still supports.
