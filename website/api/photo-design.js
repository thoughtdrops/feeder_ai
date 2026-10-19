// Photos to a home: Claude reads a set of house photos (real homes or generated renders) into the
// studio's own design choices, and the studio builds a simpler, buildable rendition from them.
//   POST /api/photo-design {photos:[{mediaType,data}], notes?} -> {read, model}
// The site's key (ANTHROPIC_API_KEY) is used unless the visitor sends their own in X-Anthropic-Key;
// a visitor's key is used for that one request only and is never stored or logged. When accounts are
// configured, the site's key is only spent for signed-in visitors.
import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { assertMutationAllowed, handler, HttpError, isPlainObject, json, readJsonBody } from './_lib/http.js';
import { accountsConfigured, requireActiveSession } from './_lib/session.js';

export const MODEL = 'claude-opus-5-5';
export const MAX_PHOTOS = 8;
// Vercel caps request bodies at 4.5 MB; the studio shrinks photos well below this before sending.
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_PHOTO_BYTES = 3_750_000;
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const KEY_RE = /^sk-ant-[A-Za-z0-9_-]{20,300}$/;
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

const OPTIONS = JSON.parse(readFileSync(new URL('./_lib/photo-options.json', import.meta.url), 'utf8'));

export function serverKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  return typeof key === 'string' && key.trim() ? key.trim() : null;
}
/** The site can read photos with its own key: {available, signIn} (signIn: only for signed-in visitors). */
export function photoConfig() {
  return { available: serverKey() !== null, signIn: serverKey() !== null && accountsConfigured() };
}

// Vercel's Hobby plan stops a function at 60 s (vercel.json maxDuration), so one try that ends in time.
const newClient = (apiKey) => new Anthropic({ apiKey, timeout: 55_000, maxRetries: 0 });
let makeClient = newClient;
/** Tests swap in a fake client. */
export function setClientFactory(factory) {
  makeClient = factory || newClient;
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
- Put anything you simplified or could not match (curved walls, towers, unusual materials) in notes, in plain language for a homeowner.`;

function cleanPhotos(raw) {
  if (!Array.isArray(raw) || raw.length < 1) throw new HttpError(400, 'Add at least one photo');
  if (raw.length > MAX_PHOTOS) throw new HttpError(400, `Use at most ${MAX_PHOTOS} photos`);
  return raw.map((p, i) => {
    if (!isPlainObject(p) || !MEDIA_TYPES.includes(p.mediaType)) throw new HttpError(400, `Photo ${i + 1} must be a JPEG, PNG, WebP or GIF image`);
    if (typeof p.data !== 'string' || !p.data || !BASE64_RE.test(p.data)) throw new HttpError(400, `Photo ${i + 1} could not be read`);
    if (Math.floor((p.data.length * 3) / 4) > MAX_PHOTO_BYTES) throw new HttpError(413, `Photo ${i + 1} is too large`);
    return { type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.data } };
  });
}

function cleanNotes(raw) {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw !== 'string') throw new HttpError(400, 'Notes must be text');
  const notes = raw.replace(CONTROL_RE, ' ').trim();
  if ([...notes].length > 500) throw new HttpError(400, 'Notes must be at most 500 characters');
  return notes;
}

/** The key for this request: the visitor's own, else the site's (signed-in visitors only when accounts exist). */
async function apiKey(request) {
  const own = (request.headers.get('x-anthropic-key') || '').trim();
  if (own) {
    if (!KEY_RE.test(own)) throw new HttpError(400, 'That does not look like an Anthropic API key (it starts with sk-ant-)');
    return { key: own, own: true };
  }
  const key = serverKey();
  if (!key) throw new HttpError(503, 'Photo modeling needs an Anthropic API key. Add yours in the dialog, or set ANTHROPIC_API_KEY on the site.', {});
  if (accountsConfigured()) {
    try {
      await requireActiveSession(request);
    } catch {
      throw new HttpError(401, 'Sign in to model homes from photos, or add your own Anthropic API key.');
    }
  }
  return { key, own: false };
}

export const POST = handler(async (request) => {
  assertMutationAllowed(request);
  const { key, own } = await apiKey(request);
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be an object');
  const photos = cleanPhotos(body.photos);
  const notes = cleanNotes(body.notes);
  const text = `Read ${photos.length === 1 ? 'this photo' : `these ${photos.length} photos`} into the studio's design choices.` + (notes ? `\n\nThe visitor added: ${notes}` : '');

  let response;
  try {
    response = await makeClient(key).beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: [...photos, { type: 'text', text }] }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      if (own) throw new HttpError(401, 'Anthropic did not accept that API key. Check it in the Claude Console and try again.');
      console.error('[api] photo-design: the site key was rejected');
      throw new HttpError(503, 'Photo modeling is not set up correctly on this site. Add your own API key to continue.');
    }
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, 'Photo modeling is busy right now. Please try again in a minute.');
    if (err instanceof Anthropic.BadRequestError) throw new HttpError(400, 'These photos could not be read. Try JPEG or PNG photos under 5 MB each.');
    if (err instanceof Anthropic.APIConnectionError) throw new HttpError(504, 'The photo reader took too long. Try again with fewer photos.');
    if (err instanceof Anthropic.APIError) {
      console.error('[api] photo-design: Anthropic error', err.status);
      throw new HttpError(502, 'The photo reader is unavailable right now. Please try again.');
    }
    throw err;
  }
  if (response.stop_reason === 'refusal') throw new HttpError(422, 'These photos could not be read as a home. Try photos of a house exterior or its rooms.');
  if (response.stop_reason === 'max_tokens') throw new HttpError(502, 'The photo reading was cut short. Please try again.');
  const out = response.content.find((b) => b.type === 'text');
  let read;
  try {
    read = JSON.parse(out ? out.text : '');
  } catch {
    throw new HttpError(502, 'The photo reading came back incomplete. Please try again.');
  }
  if (!isPlainObject(read)) throw new HttpError(502, 'The photo reading came back incomplete. Please try again.');
  return json(200, { read, model: response.model });
});
