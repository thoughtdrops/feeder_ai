// Signed session cookie: base64url(JSON payload).base64url(HMAC-SHA256(payloadPart, SESSION_SECRET)).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getCookie, HttpError } from './http.js';
import { storeConfigured } from './store.js';

export const COOKIE_NAME = 'uf_session';
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 2592000

export function sessionSecret() {
  const s = process.env.SESSION_SECRET;
  return typeof s === 'string' && s.length >= 32 ? s : null;
}

export function googleClientId() {
  const id = (process.env.GOOGLE_CLIENT_ID || '').trim();
  return id || null;
}

export function accountsConfigured() {
  return Boolean(googleClientId() && sessionSecret() && storeConfigured());
}

export function assertConfigured() {
  if (!accountsConfigured()) throw new HttpError(503, 'Accounts are not configured');
}

function sign(data, secret) {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function createSessionToken(user, now = Math.floor(Date.now() / 1000)) {
  const secret = sessionSecret();
  if (!secret) throw new HttpError(503, 'Accounts are not configured');
  const payload = {
    sub: user.sub,
    email: user.email,
    name: user.name,
    picture: user.picture,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

export function verifySessionToken(token, now = Math.floor(Date.now() / 1000)) {
  const secret = sessionSecret();
  if (!secret || typeof token !== 'string' || token.length > 4096) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1), 'base64url');
  const expected = Buffer.from(sign(body, secret), 'base64url');
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload.sub !== 'string' || !payload.sub) return null;
  if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
  if (typeof payload.iat !== 'number' || payload.iat > now + 60) return null;
  return payload;
}

/** Returns the session payload or throws 401. */
export function requireSession(request) {
  const payload = verifySessionToken(getCookie(request, COOKIE_NAME));
  if (!payload) throw new HttpError(401, 'Not signed in');
  return payload;
}

const COOKIE_ATTRS = 'HttpOnly; Secure; SameSite=Lax; Path=/';

export function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; ${COOKIE_ATTRS}; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; ${COOKIE_ATTRS}; Max-Age=0`;
}

export function publicUser(p) {
  return { name: p.name || '', email: p.email || '', picture: p.picture || '' };
}
