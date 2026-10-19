// GET /api/config -> {accounts, googleClientId, photo:{available, signIn}}
import { handler, json } from './_lib/http.js';
import { accountsConfigured, googleClientId } from './_lib/session.js';
import { photoConfig } from './photo-design.js';

export const GET = handler(async () => {
  const accounts = accountsConfigured();
  return json(200, { accounts, googleClientId: accounts ? googleClientId() : null, photo: photoConfig() });
});
