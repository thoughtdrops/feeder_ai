// Google Identity Services ID token verification (RS256 against Google's JWKS).
import { createPublicKey, verify as cryptoVerify } from 'node:crypto';
import { HttpError } from './http.js';

export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const SKEW_SECONDS = 60;
const DEFAULT_MAX_AGE = 3600;
const MIN_REFETCH_MS = 30 * 1000; // throttle refetches triggered by unknown kids

let cache = { keys: new Map(), expires: 0, fetchedAt: 0 };

export function resetJwksCache() {
  cache = { keys: new Map(), expires: 0, fetchedAt: 0 };
}

async function fetchJwks() {
  let res;
  try {
    res = await fetch(GOOGLE_JWKS_URL, { headers: { Accept: 'application/json' } });
  } catch {
    throw new HttpError(502, 'Could not reach Google to verify sign-in');
  }
  if (!res.ok) throw new HttpError(502, 'Could not reach Google to verify sign-in');
  let data;
  try {
    data = await res.json();
  } catch {
    throw new HttpError(502, 'Could not reach Google to verify sign-in');
  }
  const keys = new Map();
  for (const jwk of Array.isArray(data && data.keys) ? data.keys : []) {
    if (!jwk || jwk.kty !== 'RSA' || typeof jwk.kid !== 'string') continue;
    if (jwk.alg && jwk.alg !== 'RS256') continue;
    try {
      keys.set(jwk.kid, createPublicKey({ key: { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' }));
    } catch {
      /* skip malformed key */
    }
  }
  const cc = res.headers.get('cache-control') || '';
  const m = /max-age=(\d+)/i.exec(cc);
  const maxAge = m ? Number(m[1]) : DEFAULT_MAX_AGE;
  const now = Date.now();
  cache = { keys, expires: now + maxAge * 1000, fetchedAt: now };
}

async function getKey(kid) {
  const now = Date.now();
  if (now >= cache.expires) await fetchJwks();
  let key = cache.keys.get(kid);
  if (!key && Date.now() - cache.fetchedAt >= MIN_REFETCH_MS) {
    await fetchJwks();
    key = cache.keys.get(kid);
  }
  return key || null;
}

function decodePart(part) {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

const invalid = () => new HttpError(401, 'Invalid Google sign-in');

/** Verify a Google ID token and return its claims, or throw 401 (502 if Google is unreachable). */
export async function verifyGoogleIdToken(token, clientId, nowSec = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string' || token.length > 8192) throw invalid();
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) throw invalid();
  const header = decodePart(parts[0]);
  const claims = decodePart(parts[1]);
  if (!header || !claims || typeof claims !== 'object') throw invalid();
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw invalid();

  const key = await getKey(header.kid);
  if (!key) throw invalid();
  const ok = cryptoVerify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    key,
    Buffer.from(parts[2], 'base64url'),
  );
  if (!ok) throw invalid();

  if (claims.aud !== clientId) throw invalid();
  if (!ISSUERS.has(claims.iss)) throw invalid();
  if (typeof claims.exp !== 'number' || claims.exp + SKEW_SECONDS < nowSec) throw invalid();
  if (typeof claims.iat !== 'number' || claims.iat - SKEW_SECONDS > nowSec) throw invalid();
  if (typeof claims.nbf === 'number' && claims.nbf - SKEW_SECONDS > nowSec) throw invalid();
  if (claims.email_verified !== true && claims.email_verified !== 'true') {
    throw new HttpError(401, 'Google account email is not verified');
  }
  if (typeof claims.sub !== 'string' || !claims.sub || typeof claims.email !== 'string') throw invalid();
  return claims;
}
