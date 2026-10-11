// GET /api/auth/me -> {user} | 401
import { handler, json } from '../_lib/http.js';
import { assertConfigured, publicUser, requireSession } from '../_lib/session.js';

export const GET = handler(async (request) => {
  assertConfigured();
  const session = requireSession(request);
  return json(200, { user: publicUser(session) });
});
