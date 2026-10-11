// POST /api/auth/logout -> clears uf_session, 204
import { assertMutationAllowed, handler, HttpError, json } from '../_lib/http.js';
import { assertConfigured, clearSessionCookie, requireSession } from '../_lib/session.js';

export const POST = handler(async (request) => {
  assertConfigured();
  assertMutationAllowed(request);
  try {
    requireSession(request);
  } catch (err) {
    if (err instanceof HttpError) err.headers = { ...err.headers, 'Set-Cookie': clearSessionCookie() };
    throw err;
  }
  return json(204, null, { 'Set-Cookie': clearSessionCookie() });
});
