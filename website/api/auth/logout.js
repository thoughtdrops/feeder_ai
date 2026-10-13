// POST /api/auth/logout -> revokes the session server-side, clears uf_session, 204
import { assertMutationAllowed, handler, HttpError, json } from '../_lib/http.js';
import { assertConfigured, clearSessionCookie, requireSession, revokeSession } from '../_lib/session.js';

export const POST = handler(async (request) => {
  assertConfigured();
  assertMutationAllowed(request);
  let session;
  try {
    session = requireSession(request);
  } catch (err) {
    if (err instanceof HttpError) err.headers = { ...err.headers, 'Set-Cookie': clearSessionCookie() };
    throw err;
  }
  await revokeSession(session);
  return json(204, null, { 'Set-Cookie': clearSessionCookie() });
});
