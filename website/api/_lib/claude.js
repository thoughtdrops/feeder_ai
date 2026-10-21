// Shared Claude access for the photo and listing readers: which key a request uses, the client, and
// plain-language errors. The site's key (ANTHROPIC_API_KEY) is used unless the visitor sends their own in
// X-Anthropic-Key; a visitor's key is used for that one request only and is never stored or logged.
import Anthropic from '@anthropic-ai/sdk';
import { HttpError } from './http.js';
import { accountsConfigured, requireActiveSession } from './session.js';
import { createMemoryStore, getStore, storeConfigured } from './store.js';

export const MODEL = 'claude-opus-5-5';
const KEY_RE = /^sk-ant-[A-Za-z0-9_-]{20,300}$/;

export function serverKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  return typeof key === 'string' && key.trim() ? key.trim() : null;
}
/** Sign-in to use the site's key is opt-in: PHOTO_REQUIRE_SIGN_IN=1 (only when accounts are configured). */
export function signInRequired() {
  return /^(1|true|yes)$/i.test((process.env.PHOTO_REQUIRE_SIGN_IN || '').trim()) && accountsConfigured();
}

// Vercel's Hobby plan stops a function at 60 s (vercel.json maxDuration), so one try that ends in time.
const newClient = (apiKey) => new Anthropic({ apiKey, timeout: 55_000, maxRetries: 0 });
let makeClient = newClient;
/** Tests swap in a fake client. */
export function setClientFactory(factory) {
  makeClient = factory || newClient;
}

// Reads on the site's key are capped per visitor IP (and per signed-in account) each hour, so the key can't be
// run up without limit. The count lives in Redis when it is configured, otherwise in this instance's memory.
// A visitor's own key is never limited.
const HOUR = 3600;
const fallbackStore = createMemoryStore();
export function hourlyLimit() {
  const n = Number(process.env.PHOTO_HOURLY_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}
function clientIp(request) {
  const raw = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || '';
  return raw.split(',')[0].trim().slice(0, 64) || 'unknown';
}
async function limitSiteKey(request, sub) {
  const store = storeConfigured() ? getStore() : fallbackStore;
  const bucket = Math.floor(Date.now() / 1000 / HOUR);
  const keys = [`ip:${clientIp(request)}:${bucket}`];
  if (sub) keys.push(`sub:${sub}:${bucket}`);
  for (const key of keys) {
    if ((await store.hit(key, HOUR)) > hourlyLimit()) {
      throw new HttpError(429, 'The photo reader has reached its hourly limit for you. Try again later, or add your own Anthropic API key.');
    }
  }
}

/** A client for this request: the visitor's own key, else the site's (signed-in visitors only when required). */
export async function clientFor(request) {
  const own = (request.headers.get('x-anthropic-key') || '').trim();
  if (own) {
    if (!KEY_RE.test(own)) throw new HttpError(400, 'That does not look like an Anthropic API key (it starts with sk-ant-)');
    return { client: makeClient(own), own: true };
  }
  const key = serverKey();
  if (!key) throw new HttpError(503, 'Photo modeling needs an Anthropic API key. Add yours in the dialog, or set ANTHROPIC_API_KEY on the site.');
  let sub = null;
  if (signInRequired()) {
    try {
      sub = (await requireActiveSession(request)).sub;
    } catch {
      throw new HttpError(401, 'Sign in to model homes from photos, or add your own Anthropic API key.');
    }
  }
  await limitSiteKey(request, sub);
  return { client: makeClient(key), own: false };
}

/** Anthropic errors as plain messages; nothing upstream (or the key) is echoed back. */
export function claudeError(err, own, what = 'photo reader') {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    if (own) return new HttpError(401, 'Anthropic did not accept that API key. Check it in the Claude Console and try again.');
    console.error(`[api] ${what}: the site key was rejected`);
    return new HttpError(503, 'Photo modeling is not set up correctly on this site. Add your own API key to continue.');
  }
  if (err instanceof Anthropic.RateLimitError) return new HttpError(429, `The ${what} is busy right now. Please try again in a minute.`);
  if (err instanceof Anthropic.BadRequestError) return new HttpError(400, 'These photos could not be read. Try JPEG or PNG photos under 5 MB each, or photos saved from the listing.');
  if (err instanceof Anthropic.APIConnectionError) return new HttpError(504, `The ${what} took too long. Try again with fewer photos.`);
  if (err instanceof Anthropic.APIError) {
    console.error(`[api] ${what}: Anthropic error`, err.status);
    return new HttpError(502, `The ${what} is unavailable right now. Please try again.`);
  }
  return err;
}

/** The JSON answer of a structured-output response, or a plain error. */
export function jsonAnswer(response, refusal) {
  if (response.stop_reason === 'refusal') throw new HttpError(422, refusal);
  if (response.stop_reason === 'max_tokens') throw new HttpError(502, 'The reading was cut short. Please try again.');
  const out = [...response.content].reverse().find((b) => b.type === 'text');
  try {
    const value = JSON.parse(out ? out.text : '');
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {
    // fall through
  }
  throw new HttpError(502, 'The reading came back incomplete. Please try again.');
}

const HTTPS_RE = /^https:\/\/[^\s"'<>]{4,990}$/;
/** A public https URL (no credentials, IP literals or local hosts), or null. */
export function publicUrl(raw) {
  if (typeof raw !== 'string' || !HTTPS_RE.test(raw.trim())) return null;
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /(^|\.)(localhost|local|internal|lan)$/.test(host)) return null;
  return u.toString();
}
