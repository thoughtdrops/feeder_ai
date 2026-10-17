# Turning on Google sign-in

Sign-in, profiles and saved builds are already built into the site (`api/auth/google.js`,
`api/_lib/session.js`, `web/account.ts`). They switch on by themselves once the Vercel project has
three things: a Google OAuth client ID, a session secret and a Redis store. Until then the site keeps
working with no sign-in button and saves builds in the browser.

## 1. Create the Google OAuth client ID (Google Cloud Console)

1. Go to <https://console.cloud.google.com/> and create (or pick) a project.
2. **APIs & Services → OAuth consent screen**: choose **External**, fill in the app name, support
   email and developer contact, add the `email`, `profile` and `openid` scopes, and save. While the
   app is in *Testing*, add your own Google account under **Test users** (or click **Publish app**).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: add every address the site is served from, for example
     `https://your-domain.com`, `https://www.your-domain.com` and your Vercel address
     `https://<project>.vercel.app`. Add `http://localhost:4173` too if you test locally.
     (Google Identity Services only needs origins; no redirect URI is used.)
4. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`). The client secret is not needed.

## 2. Add a Redis store (Vercel)

In the Vercel project: **Storage → Create → Upstash for Redis** (or KV), and connect it to the
project. Vercel then adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) automatically. Profiles and saved builds live
there.

## 3. Add the environment variables (Vercel → Settings → Environment Variables)

| Name | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | the Client ID from step 1 |
| `SESSION_SECRET` | a random string of at least 32 characters, e.g. the output of `openssl rand -base64 48` |

Apply them to **Production** (and **Preview** if you want sign-in on preview links), then
**redeploy** so the functions pick them up.

## 4. Check it

Open `https://<your-site>/api/config/`. It should return `{"accounts":true,"googleClientId":"…"}`.
The **Sign in** button then appears in the header profile menu. If `accounts` is `false`, one of the
three pieces above is missing (the client ID, a secret of 32+ characters, or the Redis variables).

Common problems:

- *"The given origin is not allowed for the given client ID"*: the exact site address (including
  `https://` and any `www.`) is missing from **Authorized JavaScript origins**. Changes can take a few
  minutes to apply.
- Only test users can sign in: publish the OAuth consent screen, or add the person as a test user.
