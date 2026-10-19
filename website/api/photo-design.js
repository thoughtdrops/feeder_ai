// Photos to a home: Claude reads a set of house photos (real homes or generated renders) into the
// studio's own design choices, and the studio builds a simpler, buildable rendition from them.
//   POST /api/photo-design {task?, photos?:[{mediaType,data}], imageUrls?:[https], notes?, listing?} -> {read, model}
// task "home" (the default) reads style, size, exterior and staging; task "plan" reads a floor-plan picture or
// PDF into rooms with sizes and positions, which the engine builds exactly. The studio runs both at once.
// Keys: see _lib/claude.js (the site's key, or the visitor's own for that one request).
import { readFileSync } from 'node:fs';
import { assertMutationAllowed, handler, HttpError, isPlainObject, json, readJsonBody } from './_lib/http.js';
import { MODEL, claudeError, clientFor, jsonAnswer, publicUrl, serverKey, signInRequired } from './_lib/claude.js';

export { MODEL, setClientFactory } from './_lib/claude.js';
export const MAX_PHOTOS = 8;
export const MAX_URLS = 12;
// Vercel caps request bodies at 4.5 MB; the studio shrinks photos well below this before sending.
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_PHOTO_BYTES = 3_750_000;
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

const OPTIONS = JSON.parse(readFileSync(new URL('./_lib/photo-options.json', import.meta.url), 'utf8'));

/** The site can read photos with its own key: {available, signIn} (signIn: only for signed-in visitors). */
export function photoConfig() {
  return { available: serverKey() !== null, signIn: serverKey() !== null && signInRequired() };
}

const str = (description) => ({ type: 'string', description });
const pick = (key, description) => ({ type: 'string', enum: OPTIONS[key], description });
const FIELDS = {
  summary: str('One or two sentences on the home in the photos, as a designer would describe it to the owner.'),
  homeStyle: pick('homeStyle', 'The closest architectural style.'),
  stories: { type: 'integer', enum: [1, 2, 3], description: 'Full stories above ground (a half story under the roof counts as the top story).' },
  bedrooms: { type: 'integer', enum: [0, 1, 2, 3, 4, 5, 6], description: 'Likely bedrooms for a home of this size and style.' },
  widthFt: { type: 'number', description: 'Main house width across the front in feet, not counting the garage (16-100).' },
  depthFt: { type: 'number', description: 'Main house depth front to back in feet (16-100).' },
  livingAreaSqft: { type: 'number', description: 'Finished living area in square feet when the listing or photos state it, else 0.' },
  shape: pick('shape', 'Footprint: a rectangle, or L/T/U when wings project from the main block.'),
  roofPitch: { type: 'number', description: 'Main roof pitch as rise per 12 in of run (0.25 for flat, 4 shallow, 8 typical, 12 steep).' },
  roofing: pick('roofing', 'Roof covering; Style matched when unclear.'),
  ceiling: pick('ceiling', 'Cathedral only if interior photos show a vaulted top-floor ceiling.'),
  dormerStyle: pick('dormerStyle', 'Window dormers on the roof; None if there are none.'),
  dormerCount: { type: 'integer', enum: [1, 2, 3, 4, 5, 6], description: 'How many dormers (1 when there are none).' },
  siding: pick('siding', 'Main wall cladding.'),
  sidingColor: str('Main wall color as #rrggbb.'),
  roofColor: str('Roof color as #rrggbb.'),
  trimColor: str('Window and corner trim color as #rrggbb.'),
  trimPackage: pick('trimPackage', 'Trim package that best matches the casings and moldings.'),
  frontPorch: pick('frontPorch', 'Front porch form.'),
  columnStyle: pick('columnStyle', 'Porch column style.'),
  railingStyle: pick('railingStyle', 'Porch, deck and balcony railing style.'),
  rearOutdoor: pick('rearOutdoor', 'Rear deck or covered porch, if shown.'),
  balcony: pick('balcony', 'Upper-floor balcony, if shown.'),
  garage: pick('garage', 'Garage, if shown.'),
  garageSize: pick('garageSize', 'Garage bays.'),
  garageSide: pick('garageSide', 'Garage side, viewed from the street.'),
  bumpOuts: pick('bumpOuts', 'Walls that pop out past the main box (bay windows, bump-outs): None for a plain box, Style matched when there are some, or the side they are on.'),
  stairStyle: pick('stairStyle', 'Main stair form if an interior photo shows it (straight, L-shaped, U-shaped switchback or spiral); Style matched when unclear or one story.'),
  windowStyle: pick('windowStyle', 'How most windows open.'),
  windowSize: pick('windowSize', 'Main window size.'),
  windowGrilles: pick('windowGrilles', 'Window grille pattern.'),
  shutters: pick('shutters', 'Window shutters.'),
  entryDoor: pick('entryDoor', 'Front door style.'),
  entrySurround: pick('entrySurround', 'Front door surround.'),
  eaveOverhang: pick('eaveOverhang', 'Roof overhang depth at the eaves.'),
  roofEdgeStyle: pick('roofEdgeStyle', 'Roof edge molding.'),
  gableAccent: pick('gableAccent', 'Decoration in the gable ends.'),
  finials: pick('finials', 'Roof-peak ornaments.'),
  interiorStyle: pick('interiorStyle', 'Interior scheme closest to the staging and colors in the interior photos (or one that suits the exterior).'),
  floor: pick('floor', 'Main floor finish.'),
  wallpaper: pick('wallpaper', 'Living-area wallpaper; None for painted walls.'),
  bedroomWallpaper: pick('bedroomWallpaper', 'Bedroom wallpaper; None for painted walls.'),
  kitchenCabinets: pick('kitchenCabinets', 'Kitchen cabinet doors.'),
  cabinetColor: pick('cabinetColor', 'Kitchen cabinet color.'),
  kitchenCounter: pick('kitchenCounter', 'Countertops.'),
  kitchenBacksplash: pick('kitchenBacksplash', 'Backsplash.'),
  kitchenIsland: pick('kitchenIsland', 'Kitchen island.'),
  kitchenUppers: pick('kitchenUppers', 'Wall cabinets or shelving.'),
  kitchenHardware: pick('kitchenHardware', 'Hardware and faucet finish.'),
  kitchenPendants: pick('kitchenPendants', 'Island lighting.'),
  kitchenRange: pick('kitchenRange', 'Range.'),
  kitchenHood: pick('kitchenHood', 'Range hood.'),
  kitchenSink: pick('kitchenSink', 'Sink.'),
  kitchenFridge: pick('kitchenFridge', 'Refrigerator.'),
  livingSeating: pick('livingSeating', 'Living-room seating.'),
  livingMedia: pick('livingMedia', 'Living-room media wall or fireplace.'),
  livingCoffee: pick('livingCoffee', 'Coffee table.'),
  livingRug: pick('livingRug', 'Area rug.'),
  furnitureFinish: pick('furnitureFinish', 'Bedroom and living cabinetry finish.'),
  bedroomStorage: pick('bedroomStorage', 'Bedroom storage.'),
  notes: { type: 'array', items: { type: 'string' }, description: 'Short notes on what was simplified or could not be matched from the menus.' },
};
export const SCHEMA = { type: 'object', properties: FIELDS, required: Object.keys(FIELDS), additionalProperties: false };

const SYSTEM = `You are an architectural designer working inside Universal Frame, a home design studio that builds factory-framed houses. A visitor has sent photos of a home they like: real houses, interior shots, or AI-generated renders. Read them into the studio's design choices so the studio can build a simpler, buildable rendition with the same character and staging.

How to read the photos:
- Every answer must be one of the listed options. Pick the closest one; when a detail is not visible, choose "Style matched" where it is offered, otherwise the option that best suits the home's style.
- Estimate sizes from familiar references: a front door is about 3 ft wide and 6 ft 8 in tall, a story is about 9-10 ft, a single garage door about 9 ft wide and a double about 16 ft. Width and depth are for the main house only.
- If the photos show several different houses, describe the one that appears most.
- Interior photos set the interior scheme, floor, kitchen and living-room choices. Without interior photos, choose interiors that suit the exterior.
- Colors are hex values sampled from the main surfaces, adjusted for lighting.
- Put anything you simplified or could not match (curved walls, towers, unusual materials) in notes, in plain language for a homeowner.
- Listing facts, when given, are the most reliable source for size, bedrooms and stories.`;

// Floor plans: rooms as rectangles in feet, measured from the front-left corner of the main house.
const ROOM_TYPES = ['living', 'family', 'kitchen', 'dining', 'bedroom', 'bath', 'powder', 'hall', 'foyer', 'stairs', 'laundry', 'closet', 'pantry', 'office', 'den', 'mudroom', 'utility', 'bonus', 'other', 'garage', 'porch', 'deck', 'patio', 'balcony'];
const num = (description) => ({ type: 'number', description });
const ROOM = {
  type: 'object',
  properties: {
    name: str('The room name as labeled, e.g. "Primary bedroom".'),
    type: { type: 'string', enum: ROOM_TYPES, description: 'Room type. Garages, porches, decks, patios and balconies are outside the house.' },
    x: num('Left edge in feet from the left exterior wall (viewed from the street).'),
    z: num('Front edge in feet from the front exterior wall.'),
    w: num('Width in feet, across the house (left to right).'),
    d: num('Depth in feet, front to back.'),
  },
  required: ['name', 'type', 'x', 'z', 'w', 'd'],
  additionalProperties: false,
};
const FURNITURE_TYPES = ['bed', 'twin bed', 'crib', 'sofa', 'sectional', 'armchair', 'coffee table', 'dining table', 'desk', 'dresser', 'nightstand', 'wardrobe', 'tv console', 'toilet', 'sink', 'double sink', 'shower', 'bathtub', 'washer dryer', 'kitchen island', 'bookcase'];
const PIECE = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: FURNITURE_TYPES, description: 'What the symbol on the plan is.' },
    x: num('Left edge in feet from the left exterior wall.'),
    z: num('Front edge in feet from the front exterior wall.'),
    w: num('Width in feet, left to right.'),
    d: num('Depth in feet, front to back.'),
    backToward: { type: 'string', enum: ['front', 'back', 'left', 'right'], description: 'Which side of the house the back of the piece faces: the headboard of a bed, the back of a sofa, the tank of a toilet, the wall a sink or tub is set against.' },
  },
  required: ['type', 'x', 'z', 'w', 'd', 'backToward'],
  additionalProperties: false,
};
const PLAN_FIELDS = {
  found: { type: 'boolean', description: 'True when the images include a readable floor plan.' },
  mainWidthFt: num('Width of the main house rectangle across the front, in feet, wall outside to wall outside (not the garage, porches or bump-outs).'),
  mainDepthFt: num('Depth of the main house rectangle front to back, in feet (not the garage, porches, bump-outs or rear wings).'),
  floors: {
    type: 'array',
    description: 'Each above-ground floor, ground floor first. Leave out basements.',
    items: {
      type: 'object',
      properties: {
        level: { type: 'integer', description: '1 for the ground floor, 2 above it.' },
        rooms: { type: 'array', items: ROOM },
        furniture: { type: 'array', items: PIECE, description: 'Furniture and fixtures drawn on this floor, in the same feet as the rooms. Empty when the plan shows none.' },
      },
      required: ['level', 'rooms', 'furniture'],
      additionalProperties: false,
    },
  },
  notes: { type: 'array', items: { type: 'string' }, description: 'Short notes on anything unclear or estimated.' },
};
export const PLAN_SCHEMA = { type: 'object', properties: PLAN_FIELDS, required: Object.keys(PLAN_FIELDS), additionalProperties: false };

const PLAN_SYSTEM = `You are an architect tracing a floor plan for Universal Frame, a home design studio that builds factory-framed houses. The visitor has sent floor-plan images (a listing's floor plan, a blueprint or a sketch). Read every room into rectangles so the studio can rebuild the plan exactly.

How to trace:
- Orient the plan so the front door wall is the front. x runs from the left exterior wall to the right (as seen from the street) and z from the front wall toward the back, in feet.
- Use the written dimensions (e.g. 12'4" x 11'0" is 12.33 by 11 ft; width first is usually across the plan). Where a room has no label, measure it against labeled neighbors. Wall thickness is about half a foot; ignore it.
- Rooms on each floor should cover the whole floor without overlapping. Include halls, closets, the stair and baths. An L-shaped room is two rectangles with the same name.
- The main house is the largest rectangle. A garage, porch, deck or patio is listed with its type but is not part of the main house size. Rooms that project behind the main house belong to a rear wing; keep their real positions (z beyond the main depth).
- Walls that step out past the main rectangle (a bay window, a bump-out, a projecting front room or a side pop-out) are part of their room: trace the room to the outside of the step, so it reaches past the main rectangle (negative x or z, or beyond the main width or depth). Do not count them in the main width or depth.
- Multi-story homes: the stair is in the same place on each floor. List floors ground first.
- Furniture and fixtures drawn on the plan (beds, sofas, tables, toilets, sinks, tubs, showers, washers, islands) go in each floor's furniture list with their rectangles in the same feet, and which side of the house their back faces. Built-in kitchen counters are not furniture.
- If no floor plan is visible, set found to false and leave floors empty.`;

/** Uploaded images (and, for floor plans, PDFs) as content blocks. */
function cleanPhotos(raw, task) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new HttpError(400, 'Photos must be a list');
  if (raw.length > MAX_PHOTOS) throw new HttpError(400, `Use at most ${MAX_PHOTOS} photos`);
  return raw.map((p, i) => {
    const pdf = task === 'plan' && isPlainObject(p) && p.mediaType === 'application/pdf';
    if (!isPlainObject(p) || (!pdf && !MEDIA_TYPES.includes(p.mediaType))) throw new HttpError(400, `Photo ${i + 1} must be a JPEG, PNG, WebP or GIF image${task === 'plan' ? ' or a PDF' : ''}`);
    if (typeof p.data !== 'string' || !p.data || !BASE64_RE.test(p.data)) throw new HttpError(400, `Photo ${i + 1} could not be read`);
    if (Math.floor((p.data.length * 3) / 4) > MAX_PHOTO_BYTES) throw new HttpError(413, `Photo ${i + 1} is too large`);
    return pdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.data } }
      : { type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.data } };
  });
}

/** Photos found on a listing page, passed to Claude by address. */
function cleanUrls(raw) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_URLS) throw new HttpError(400, `Use at most ${MAX_URLS} photo links`);
  return raw.map((u, i) => {
    const url = publicUrl(u);
    if (!url) throw new HttpError(400, `Photo link ${i + 1} must be a public https address`);
    return { type: 'image', source: { type: 'url', url } };
  });
}

function cleanText(raw, max, label) {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw !== 'string') throw new HttpError(400, `${label} must be text`);
  const text = raw.replace(CONTROL_RE, ' ').trim();
  if ([...text].length > max) throw new HttpError(400, `${label} must be at most ${max} characters`);
  return text;
}

/** Listing facts as one line of context (numbers only, plus a short description). */
function listingText(raw) {
  if (!isPlainObject(raw)) return '';
  const n = (k) => (typeof raw[k] === 'number' && Number.isFinite(raw[k]) && raw[k] > 0 ? raw[k] : null);
  const facts = [
    n('livingAreaSqft') && `${Math.round(n('livingAreaSqft'))} sq ft living area`,
    n('bedrooms') && `${n('bedrooms')} bedrooms`,
    n('bathrooms') && `${n('bathrooms')} bathrooms`,
    n('stories') && `${n('stories')} stories`,
    n('yearBuilt') && `built ${Math.round(n('yearBuilt'))}`,
  ].filter(Boolean);
  const description = typeof raw.description === 'string' ? raw.description.replace(CONTROL_RE, ' ').trim().slice(0, 1500) : '';
  return facts.length || description ? `Listing facts: ${facts.join(', ') || 'none'}.${description ? `\nListing description: ${description}` : ''}` : '';
}

export const POST = handler(async (request) => {
  assertMutationAllowed(request);
  const { client, own } = await clientFor(request);
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be an object');
  const task = body.task === 'plan' ? 'plan' : 'home';
  const images = [...cleanPhotos(body.photos, task), ...cleanUrls(body.imageUrls)];
  if (!images.length) throw new HttpError(400, task === 'plan' ? 'Add a floor plan picture' : 'Add at least one photo');
  const notes = cleanText(body.notes, 500, 'Notes');
  const listing = listingText(body.listing);
  const count = images.length === 1 ? 'this image' : `these ${images.length} images`;
  const ask = task === 'plan' ? `Trace the floor plan in ${count}.` : `Read ${count} into the studio's design choices.`;
  const text = [ask, listing, notes && `The visitor added: ${notes}`].filter(Boolean).join('\n\n');

  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: task === 'plan' ? PLAN_SCHEMA : SCHEMA } },
      system: task === 'plan' ? PLAN_SYSTEM : SYSTEM,
      messages: [{ role: 'user', content: [...images, { type: 'text', text }] }],
    });
  } catch (err) {
    throw claudeError(err, own, task === 'plan' ? 'floor plan reader' : 'photo reader');
  }
  const read = jsonAnswer(response, task === 'plan' ? 'This floor plan could not be read. Try a clearer picture of the plan.' : 'These photos could not be read as a home. Try photos of a house exterior or its rooms.');
  return json(200, { read, model: response.model });
});
