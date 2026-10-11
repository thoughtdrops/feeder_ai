// GET /api/config -> {accounts, googleClientId}
import { handler, json } from './_lib/http.js';
import { accountsConfigured, googleClientId } from './_lib/session.js';

export const GET = handler(async () => {
  const accounts = accountsConfigured();
  return json(200, { accounts, googleClientId: accounts ? googleClientId() : null });
});
