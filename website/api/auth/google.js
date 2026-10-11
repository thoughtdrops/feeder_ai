// POST /api/auth/google {credential} -> verifies a Google ID token, upserts the profile, sets uf_session.
import { assertMutationAllowed, handler, HttpError, isPlainObject, json, readJsonBody } from '../_lib/http.js';
import { verifyGoogleIdToken } from '../_lib/google.js';
import {
  assertConfigured,
  createSessionToken,
  googleClientId,
  publicUser,
  sessionCookie,
} from '../_lib/session.js';
import { getStore } from '../_lib/store.js';

const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

export const POST = handler(async (request) => {
  assertConfigured();
  assertMutationAllowed(request);
  const body = await readJsonBody(request, 16 * 1024);
  if (!isPlainObject(body) || typeof body.credential !== 'string' || !body.credential) {
    throw new HttpError(400, 'Missing credential');
  }
  const claims = await verifyGoogleIdToken(body.credential, googleClientId());

  const user = {
    sub: claims.sub,
    email: clip(claims.email, 320),
    name: clip(claims.name, 200),
    picture: /^https:\/\//.test(claims.picture || '') ? clip(claims.picture, 1000) : '',
  };
  const store = getStore();
  const now = new Date().toISOString();
  const existing = await store.getUser(user.sub);
  await store.putUser(user.sub, {
    ...user,
    created: (existing && existing.created) || now,
    lastLogin: now,
  });

  return json(200, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(createSessionToken(user)) });
});
