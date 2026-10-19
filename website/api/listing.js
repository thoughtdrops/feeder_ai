// A listing link: Claude opens the page (with Anthropic's web fetch, so this site never downloads it) and
// returns the facts that size the home plus the links of its most useful photos and floor plans. The studio
// then reads those photos and plans with /api/photo-design.
//   POST /api/listing {url} -> {listing:{found, reason, address, livingAreaSqft, bedrooms, bathrooms, stories,
//                               yearBuilt, description, photoUrls[], floorPlanUrls[]}}
// Some sites (Zillow among them) block automated readers; the answer then says so and the visitor can save
// the photos and floor plan from the listing and add them by hand.
import { assertMutationAllowed, handler, HttpError, isPlainObject, json, readJsonBody } from './_lib/http.js';
import { MODEL, claudeError, clientFor, jsonAnswer, publicUrl } from './_lib/claude.js';

export const MAX_LISTING_PHOTOS = 10;
const MAX_PLANS = 3;
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

const num = (description) => ({ type: 'number', description });
const urls = (description) => ({ type: 'array', items: { type: 'string' }, description });
const FIELDS = {
  found: { type: 'boolean', description: 'True when the page loaded and is a home listing.' },
  reason: { type: 'string', description: 'When found is false, a short plain reason (e.g. "The site blocked automated reading").' },
  address: { type: 'string', description: 'The listed address, or empty.' },
  livingAreaSqft: num('Finished living area in square feet, or 0.'),
  bedrooms: num('Bedrooms, or 0.'),
  bathrooms: num('Bathrooms (half baths as 0.5), or 0.'),
  stories: num('Stories above ground, or 0.'),
  yearBuilt: num('Year built, or 0.'),
  description: { type: 'string', description: 'The listing description, at most about 1,200 characters.' },
  photoUrls: urls(`Up to ${MAX_LISTING_PHOTOS} full-size photo links, most useful first: the front exterior, other exterior sides, kitchen, living and family rooms, dining, primary bedroom, a bathroom.`),
  floorPlanUrls: urls(`Up to ${MAX_PLANS} links to floor-plan images or PDFs, ground floor first. Empty when the listing has none.`),
};
export const LISTING_SCHEMA = { type: 'object', properties: FIELDS, required: Object.keys(FIELDS), additionalProperties: false };

const SYSTEM = `You read real-estate listing pages for Universal Frame, a home design studio. Fetch the page the visitor linked and report the facts that size the home and the links of its best photos and floor plans.
- Copy photo and floor-plan links exactly as they appear in the page (full-size versions when the page offers them). Never invent a link.
- Floor plans are drawings of the rooms; list them separately from photos.
- If the page will not load, is blocked, or is not a single home listing, set found to false and give a short reason.`;

function sanitize(raw) {
  const n = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? v : 0);
  const text = (v, max) => (typeof v === 'string' ? v.replace(CONTROL_RE, ' ').trim().slice(0, max) : '');
  const links = (v, max) => [...new Set((Array.isArray(v) ? v : []).map(publicUrl).filter(Boolean))].slice(0, max);
  return {
    found: raw.found === true,
    reason: text(raw.reason, 200),
    address: text(raw.address, 200),
    livingAreaSqft: n(raw.livingAreaSqft, 50000),
    bedrooms: n(raw.bedrooms, 30),
    bathrooms: n(raw.bathrooms, 30),
    stories: n(raw.stories, 5),
    yearBuilt: n(raw.yearBuilt, 2100),
    description: text(raw.description, 1500),
    photoUrls: links(raw.photoUrls, MAX_LISTING_PHOTOS),
    floorPlanUrls: links(raw.floorPlanUrls, MAX_PLANS),
  };
}

export const POST = handler(async (request) => {
  assertMutationAllowed(request);
  const { client, own } = await clientFor(request);
  const body = await readJsonBody(request, 8 * 1024);
  const url = isPlainObject(body) ? publicUrl(body.url) : null;
  if (!url) throw new HttpError(400, 'Paste the full https:// link to the listing');

  const params = {
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low', format: { type: 'json_schema', schema: LISTING_SCHEMA } },
    tools: [{ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3 }],
    system: SYSTEM,
    messages: [{ role: 'user', content: `Read this home listing: ${url}` }],
  };
  let response;
  try {
    response = await client.beta.messages.create(params);
    // A long server-tool turn can pause; resume it once (the function has 60 s in all).
    if (response.stop_reason === 'pause_turn') {
      response = await client.beta.messages.create({ ...params, messages: [...params.messages, { role: 'assistant', content: response.content }] });
    }
  } catch (err) {
    throw claudeError(err, own, 'listing reader');
  }
  if (response.stop_reason === 'pause_turn') throw new HttpError(504, 'The listing took too long to read. Save its photos and floor plan and add them instead.');
  const listing = sanitize(jsonAnswer(response, 'This listing could not be read. Save its photos and floor plan and add them instead.'));
  if (!listing.found) {
    listing.reason ||= 'The page could not be read as a home listing.';
    listing.photoUrls = [];
    listing.floorPlanUrls = [];
  }
  return json(200, { listing });
});
