// Account API checks: Google sign-in, session cookie, saved builds, CSRF and limits.
// Run from website/: node scripts/tests/api-check.mjs
import { generateKeyPairSync, createSign } from 'node:crypto';
import { useMemoryStore, useEnvStore } from '../../api/_lib/store.js';
import { resetJwksCache, GOOGLE_JWKS_URL } from '../../api/_lib/google.js';
import * as config from '../../api/config.js';
import * as google from '../../api/auth/google.js';
import * as me from '../../api/auth/me.js';
import * as logout from '../../api/auth/logout.js';
import * as builds from '../../api/builds.js';
import * as photo from '../../api/photo-design.js';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
// Root-level wrappers must resolve to the same handlers.
import * as rootConfig from '../../../api/config.mjs';
import * as rootGoogle from '../../../api/auth/google.mjs';
import * as rootMe from '../../../api/auth/me.mjs';
import * as rootLogout from '../../../api/auth/logout.mjs';
import * as rootBuilds from '../../../api/builds.mjs';
import * as rootPhoto from '../../../api/photo-design.mjs';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const SECRET = 'x'.repeat(40);
const HOST = 'studio.example.com';
const BASE = `https://${HOST}`;

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`PASS ${name}`);
  else {
    failures++;
    console.log(`FAIL ${name}${detail !== undefined ? ` -- ${JSON.stringify(detail)}` : ''}`);
  }
}

// ---- Keys + JWKS stub -------------------------------------------------------
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: otherKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
let jwksFetches = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url) === GOOGLE_JWKS_URL) {
    jwksFetches++;
    return new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k1', alg: 'RS256', use: 'sig' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    });
  }
  throw new Error(`unexpected fetch ${url}`);
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function mintToken(overrides = {}, { key = privateKey, kid = 'k1' } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: '1234567890',
    email: 'pat@example.com',
    email_verified: true,
    name: 'Pat Builder',
    picture: 'https://lh3.googleusercontent.com/a/pic',
    iat: now,
    exp: now + 3600,
    ...overrides,
  };
  const head = b64({ alg: 'RS256', kid, typ: 'JWT' });
  const body = b64(claims);
  const s = createSign('RSA-SHA256');
  s.update(`${head}.${body}`);
  return `${head}.${body}.${s.sign(key).toString('base64url')}`;
}

// ---- Request helpers --------------------------------------------------------
function req(method, path, { body, cookie, csrf = true, origin = BASE, headers = {} } = {}) {
  const h = { host: HOST, ...headers };
  if (csrf && method !== 'GET') h['x-uf-request'] = '1';
  if (origin && method !== 'GET') h.origin = origin;
  if (cookie) h.cookie = cookie;
  if (body !== undefined) {
    h['content-type'] = 'application/json';
    return new Request(BASE + path, { method, headers: h, body: typeof body === 'string' ? body : JSON.stringify(body) });
  }
  return new Request(BASE + path, { method, headers: h });
}
async function call(fn, request) {
  const res = await fn(request);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}
const cookieFrom = (res) => (res.headers.get('set-cookie') || '').split(';')[0];
const stdHeaders = (r) =>
  r.headers.get('cache-control') === 'no-store' &&
  (r.status === 204 || (r.headers.get('content-type') || '').startsWith('application/json'));

function setEnv(env) {
  for (const k of ['GOOGLE_CLIENT_ID', 'SESSION_SECRET', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'ANTHROPIC_API_KEY']) {
    delete process.env[k];
  }
  Object.assign(process.env, env);
}

// ---- Not configured -----------------------------------------------------------
setEnv({});
useEnvStore();
{
  const r = await call(config.GET, req('GET', '/api/config'));
  check('config: accounts false when nothing configured', r.status === 200 && r.data.accounts === false && r.data.googleClientId === null, r);
  check('config: no-store + json headers', stdHeaders(r));
  const g = await call(google.POST, req('POST', '/api/auth/google', { body: { credential: mintToken() } }));
  check('not configured: auth/google -> 503', g.status === 503 && g.data.error === 'Accounts are not configured', g);
  const m = await call(me.GET, req('GET', '/api/auth/me'));
  check('not configured: me -> 503', m.status === 503, m);
  const b = await call(builds.GET, req('GET', '/api/builds'));
  check('not configured: builds -> 503', b.status === 503, b);
  const l = await call(logout.POST, req('POST', '/api/auth/logout'));
  check('not configured: logout -> 503', l.status === 503, l);
}
setEnv({ GOOGLE_CLIENT_ID: CLIENT_ID, SESSION_SECRET: 'short' });
useMemoryStore();
{
  const r = await call(config.GET, req('GET', '/api/config'));
  check('config: accounts false with short SESSION_SECRET', r.data.accounts === false, r);
}
setEnv({ GOOGLE_CLIENT_ID: CLIENT_ID, SESSION_SECRET: SECRET });
useEnvStore();
{
  const r = await call(config.GET, req('GET', '/api/config'));
  check('config: accounts false without a store', r.data.accounts === false, r);
}
setEnv({ GOOGLE_CLIENT_ID: CLIENT_ID, SESSION_SECRET: SECRET, KV_REST_API_URL: 'https://kv.example', KV_REST_API_TOKEN: 't' });
{
  const r = await call(config.GET, req('GET', '/api/config'));
  check('config: accounts true with KV_REST_API_* env', r.data.accounts === true && r.data.googleClientId === CLIENT_ID, r);
}

// ---- Configured (memory store) -------------------------------------------------
setEnv({ GOOGLE_CLIENT_ID: CLIENT_ID, SESSION_SECRET: SECRET });
const store = useMemoryStore();
resetJwksCache();
{
  const r = await call(rootConfig.GET, req('GET', '/api/config'));
  check('config (root wrapper): accounts true with memory store', r.data.accounts === true && r.data.googleClientId === CLIENT_ID, r);
  check('config: never echoes secret', !JSON.stringify(r.data).includes(SECRET));
}

// Login failures
const loginFail = async (label, credential, expected = 401) => {
  const r = await call(google.POST, req('POST', '/api/auth/google', { body: { credential } }));
  check(`login rejects ${label} -> ${expected}`, r.status === expected && typeof r.data.error === 'string' && !r.headers.get('set-cookie'), r);
};
const now = Math.floor(Date.now() / 1000);
await loginFail('wrong aud', mintToken({ aud: 'someone-else' }));
await loginFail('expired token', mintToken({ iat: now - 7200, exp: now - 3600 }));
await loginFail('bad signature', mintToken({}, { key: otherKey }));
await loginFail('unverified email', mintToken({ email_verified: false }));
await loginFail('wrong issuer', mintToken({ iss: 'https://evil.example' }));
await loginFail('unknown kid', mintToken({}, { kid: 'nope' }));
await loginFail('garbage token', 'not.a.jwt');
await loginFail('missing credential', '', 400);
check('JWKS cached in module scope (fetched at most twice so far)', jwksFetches >= 1 && jwksFetches <= 2, jwksFetches);

// CSRF on login
{
  const r1 = await call(google.POST, req('POST', '/api/auth/google', { body: { credential: mintToken() }, csrf: false }));
  check('login without X-UF-Request -> 403', r1.status === 403, r1);
  const r2 = await call(google.POST, req('POST', '/api/auth/google', { body: { credential: mintToken() }, origin: 'https://evil.example' }));
  check('login cross-origin -> 403', r2.status === 403, r2);
}

// Login success
let cookie;
{
  const r = await call(rootGoogle.POST, req('POST', '/api/auth/google', { body: { credential: mintToken() } }));
  const sc = r.headers.get('set-cookie') || '';
  check('login success -> 200 {user}', r.status === 200 && r.data.user.email === 'pat@example.com' && r.data.user.name === 'Pat Builder' && r.data.user.picture.startsWith('https://'), r);
  check('login sets uf_session cookie with flags', /^uf_session=[^;]+\.[^;]+;/.test(sc) && /HttpOnly/.test(sc) && /Secure/.test(sc) && /SameSite=Lax/.test(sc) && /Path=\//.test(sc) && /Max-Age=2592000/.test(sc), sc);
  check('login response has no-store', stdHeaders(r));
  cookie = cookieFrom(r);
  const profile = await store.getUser('1234567890');
  check('profile upserted', profile && profile.email === 'pat@example.com' && profile.created && profile.lastLogin, profile);
  const created = profile.created;
  await new Promise((res) => setTimeout(res, 5));
  await call(google.POST, req('POST', '/api/auth/google', { body: { credential: mintToken() } }));
  const p2 = await store.getUser('1234567890');
  check('second login keeps created, bumps lastLogin', p2.created === created && p2.lastLogin >= profile.lastLogin, p2);
  // Origin absent is allowed (header still required)
  const r3 = await call(google.POST, req('POST', '/api/auth/google', { body: { credential: mintToken() }, origin: null }));
  check('login without Origin header but with X-UF-Request -> 200', r3.status === 200, r3);
  // x-forwarded-host match
  const r4 = await call(google.POST, req('POST', '/api/auth/google', { body: { credential: mintToken() }, origin: 'https://www.example.org', headers: { 'x-forwarded-host': 'www.example.org' } }));
  check('login with Origin matching x-forwarded-host -> 200', r4.status === 200, r4);
}

// me
{
  const r = await call(rootMe.GET, req('GET', '/api/auth/me', { cookie }));
  check('me with cookie -> user', r.status === 200 && r.data.user.email === 'pat@example.com', r);
  const r2 = await call(me.GET, req('GET', '/api/auth/me'));
  check('me without cookie -> 401', r2.status === 401 && typeof r2.data.error === 'string', r2);
  const [body, sig] = cookie.slice('uf_session='.length).split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url')), sub: 'attacker' })).toString('base64url');
  const r3 = await call(me.GET, req('GET', '/api/auth/me', { cookie: `uf_session=${forged}.${sig}` }));
  check('me with tampered cookie -> 401', r3.status === 401, r3);
  const r4 = await call(me.GET, req('GET', '/api/auth/me', { cookie: `uf_session=${body}.${sig.slice(0, -2)}AA` }));
  check('me with tampered signature -> 401', r4.status === 401, r4);
  const prev = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'y'.repeat(40);
  const r5 = await call(me.GET, req('GET', '/api/auth/me', { cookie }));
  check('me with cookie signed by another secret -> 401', r5.status === 401, r5);
  process.env.SESSION_SECRET = prev;
  // expired session
  const realNow = Date.now;
  Date.now = () => realNow() + 31 * 24 * 3600 * 1000;
  const r6 = await call(me.GET, req('GET', '/api/auth/me', { cookie }));
  Date.now = realNow;
  check('me with expired session -> 401', r6.status === 401, r6);
}

// builds
const design = { version: 1, width: 24, length: 36, walls: [{ x: 0, y: 0 }] };
let firstId;
{
  const empty = await call(rootBuilds.GET, req('GET', '/api/builds', { cookie }));
  check('builds list initially empty', empty.status === 200 && Array.isArray(empty.data.builds) && empty.data.builds.length === 0, empty);

  const noAuth = await call(builds.GET, req('GET', '/api/builds'));
  check('builds without session -> 401', noAuth.status === 401, noAuth);
  const noAuthPost = await call(builds.POST, req('POST', '/api/builds', { body: { name: 'x', design } }));
  check('save without session -> 401', noAuthPost.status === 401, noAuthPost);

  const s1 = await call(builds.POST, req('POST', '/api/builds', { cookie, body: { name: '  My\u0007 barn\n ', summary: '24x36 barn', design } }));
  check('save new build', s1.status === 200 && s1.data.build.name === 'My barn' && s1.data.build.summary === '24x36 barn' && /^[0-9a-f-]{36}$/.test(s1.data.build.id) && s1.data.build.updated && !('design' in s1.data.build), s1);
  firstId = s1.data.build.id;
  await new Promise((res) => setTimeout(res, 5));
  const s2 = await call(builds.POST, req('POST', '/api/builds', { cookie, body: { name: 'Second', design: { a: 1 } } }));
  check('save second build (summary optional)', s2.status === 200 && s2.data.build.summary === '', s2);

  const list = await call(builds.GET, req('GET', '/api/builds', { cookie }));
  check('list newest first', list.data.builds.length === 2 && list.data.builds[0].name === 'Second' && list.data.builds[1].id === firstId && !('design' in list.data.builds[0]), list.data);

  const got = await call(builds.GET, req('GET', `/api/builds?id=${firstId}`, { cookie }));
  check('get build returns design', got.status === 200 && JSON.stringify(got.data.build.design) === JSON.stringify(design) && got.data.build.name === 'My barn', got);
  const missing = await call(builds.GET, req('GET', '/api/builds?id=does-not-exist', { cookie }));
  check('get unknown build -> 404', missing.status === 404, missing);

  await new Promise((res) => setTimeout(res, 5));
  const upd = await call(builds.POST, req('POST', '/api/builds', { cookie, body: { id: firstId, name: 'Renamed', design: { ...design, width: 30 } } }));
  check('update existing build keeps id', upd.status === 200 && upd.data.build.id === firstId && upd.data.build.name === 'Renamed', upd);
  const got2 = await call(builds.GET, req('GET', `/api/builds?id=${firstId}`, { cookie }));
  check('update persisted design', got2.data.build.design.width === 30, got2.data);
  const list2 = await call(builds.GET, req('GET', '/api/builds', { cookie }));
  check('updated build moves to top', list2.data.builds[0].id === firstId && list2.data.builds.length === 2, list2.data);

  const updMissing = await call(builds.POST, req('POST', '/api/builds', { cookie, body: { id: 'nope', name: 'X', design } }));
  check('update unknown id -> 404', updMissing.status === 404, updMissing);

  // Another user cannot see or touch these builds
  const other = await call(google.POST, req('POST', '/api/auth/google', { body: { credential: mintToken({ sub: '999', email: 'other@example.com' }) } }));
  const otherCookie = cookieFrom(other);
  const oList = await call(builds.GET, req('GET', '/api/builds', { cookie: otherCookie }));
  check('other user sees no builds', oList.data.builds.length === 0, oList.data);
  const oGet = await call(builds.GET, req('GET', `/api/builds?id=${firstId}`, { cookie: otherCookie }));
  check('other user cannot read build -> 404', oGet.status === 404, oGet);
  const oUpd = await call(builds.POST, req('POST', '/api/builds', { cookie: otherCookie, body: { id: firstId, name: 'Hijack', design } }));
  check('other user cannot update build -> 404', oUpd.status === 404, oUpd);
  const oDel = await call(builds.DELETE, req('DELETE', `/api/builds?id=${firstId}`, { cookie: otherCookie }));
  check('other user cannot delete build -> 404', oDel.status === 404, oDel);

  // Validation
  const v = async (label, body, expected = 400) => {
    const r = await call(builds.POST, req('POST', '/api/builds', { cookie, body }));
    check(`save rejects ${label} -> ${expected}`, r.status === expected && typeof r.data.error === 'string', r);
  };
  await v('empty name', { name: '   ', design });
  await v('name > 80 chars', { name: 'n'.repeat(81), design });
  await v('summary > 200 chars', { name: 'ok', summary: 's'.repeat(201), design });
  await v('non-object design', { name: 'ok', design: [1, 2] });
  await v('missing design', { name: 'ok' });
  await v('invalid JSON', '{nope');
  const okLong = await call(builds.POST, req('POST', '/api/builds', { cookie, body: { id: firstId, name: 'n'.repeat(80), summary: 's'.repeat(200), design } }));
  check('save accepts 80-char name / 200-char summary', okLong.status === 200, okLong);

  const big = { blob: 'z'.repeat(150 * 1024) };
  await v('design > 150 KB', { name: 'big', design: big }, 413);
  const justUnder = { blob: 'z'.repeat(150 * 1024 - 20) };
  const under = await call(builds.POST, req('POST', '/api/builds', { cookie, body: { name: 'under', design: justUnder } }));
  check('design just under 150 KB accepted', under.status === 200, under);
  await v('huge body', { name: 'big', design: { blob: 'z'.repeat(400 * 1024) } }, 413);

  // CSRF on builds
  const c1 = await call(builds.POST, req('POST', '/api/builds', { cookie, body: { name: 'x', design }, csrf: false }));
  check('save without X-UF-Request -> 403', c1.status === 403, c1);
  const c2 = await call(builds.POST, req('POST', '/api/builds', { cookie, body: { name: 'x', design }, origin: 'https://evil.example' }));
  check('save cross-origin -> 403', c2.status === 403, c2);
  const c3 = await call(builds.DELETE, req('DELETE', `/api/builds?id=${firstId}`, { cookie, csrf: false }));
  check('delete without X-UF-Request -> 403', c3.status === 403, c3);
  const c4 = await call(builds.DELETE, req('DELETE', `/api/builds?id=${firstId}`, { cookie, origin: 'null' }));
  check('delete with Origin: null -> 403', c4.status === 403, c4);

  // Delete
  const d = await call(rootBuilds.DELETE, req('DELETE', `/api/builds?id=${firstId}`, { cookie }));
  check('delete build -> 204', d.status === 204 && d.data === null && d.headers.get('cache-control') === 'no-store', d);
  const d2 = await call(builds.DELETE, req('DELETE', `/api/builds?id=${firstId}`, { cookie }));
  check('delete again -> 404', d2.status === 404, d2);
  const g3 = await call(builds.GET, req('GET', `/api/builds?id=${firstId}`, { cookie }));
  check('deleted build is gone', g3.status === 404, g3);

  // 50-build limit
  let count = (await call(builds.GET, req('GET', '/api/builds', { cookie }))).data.builds.length;
  let lastOk = true;
  while (count < 50) {
    const r = await call(builds.POST, req('POST', '/api/builds', { cookie, body: { name: `B${count}`, design: { n: count } } }));
    lastOk = lastOk && r.status === 200;
    count++;
  }
  check('can fill up to 50 builds', lastOk && (await store.countBuilds('1234567890')) === 50);
  const over = await call(builds.POST, req('POST', '/api/builds', { cookie, body: { name: 'B51', design } }));
  check('51st build -> 409', over.status === 409 && typeof over.data.error === 'string', over);
  const anyId = (await call(builds.GET, req('GET', '/api/builds', { cookie }))).data.builds[0].id;
  const updAtLimit = await call(builds.POST, req('POST', '/api/builds', { cookie, body: { id: anyId, name: 'Still ok', design } }));
  check('update still allowed at 50 builds', updAtLimit.status === 200, updAtLimit);
}

// logout
{
  const no = await call(logout.POST, req('POST', '/api/auth/logout', { cookie, csrf: false }));
  check('logout without X-UF-Request -> 403', no.status === 403, no);
  const r = await call(rootLogout.POST, req('POST', '/api/auth/logout', { cookie }));
  const sc = r.headers.get('set-cookie') || '';
  check('logout -> 204 and clears cookie', r.status === 204 && /^uf_session=;/.test(sc) && /Max-Age=0/.test(sc) && /HttpOnly/.test(sc) && /Path=\//.test(sc), { status: r.status, sc });
  const r2 = await call(logout.POST, req('POST', '/api/auth/logout'));
  check('logout without session -> 401', r2.status === 401, r2);
  const stale = await call(me.GET, req('GET', '/api/auth/me', { cookie }));
  check('signed-out cookie no longer works -> 401', stale.status === 401, stale);
  const staleBuilds = await call(builds.GET, req('GET', '/api/builds', { cookie }));
  check('signed-out cookie cannot read builds -> 401', staleBuilds.status === 401, staleBuilds);
}

// ---- Photos to a home (/api/photo-design) -------------------------------------
{
  const VISITOR_KEY = 'sk-ant-api03-' + 'v'.repeat(40);
  const SITE_KEY = 'sk-ant-api03-' + 's'.repeat(40);
  const JPEG = Buffer.from('fake jpeg bytes').toString('base64');
  const READ = { summary: 'A white Colonial.', homeStyle: 'Colonial', stories: 2, bedrooms: 4 };
  let sent = [];
  let reply = () => ({ stop_reason: 'end_turn', model: photo.MODEL, content: [{ type: 'text', text: JSON.stringify(READ) }] });
  photo.setClientFactory((apiKey) => ({ beta: { messages: { create: async (params) => { sent.push({ apiKey, params }); return reply(); } } } }));
  const post = (body, { key, cookie, csrf } = {}) => call(photo.POST, req('POST', '/api/photo-design', { body, cookie, csrf, headers: key ? { 'x-anthropic-key': key } : {} }));
  const one = { photos: [{ mediaType: 'image/jpeg', data: JPEG }] };

  setEnv({});
  useMemoryStore();
  let r = await call(config.GET, req('GET', '/api/config'));
  check('photo config: unavailable without a site key', r.data.photo && r.data.photo.available === false && r.data.photo.signIn === false, r.data);
  r = await post(one);
  check('photo: 503 asks for a key when none is set', r.status === 503 && /API key/.test(r.data.error), r);
  r = await post(one, { key: 'not-a-key' });
  check('photo: malformed visitor key rejected', r.status === 400, r);
  r = await post(one, { key: VISITOR_KEY, csrf: false });
  check('photo: CSRF header required', r.status === 403 && sent.length === 0, r);

  sent = [];
  r = await post({ ...one, notes: 'Keep four bedrooms\u0000 please' }, { key: VISITOR_KEY });
  const p = sent[0]?.params;
  check('photo: visitor key reads photos', r.status === 200 && r.data.read.homeStyle === 'Colonial' && r.data.model === photo.MODEL, r);
  check('photo: uses the visitor key for that request', sent.length === 1 && sent[0].apiKey === VISITOR_KEY);
  check('photo: request shape (model, fallback, adaptive thinking, JSON schema)', p && p.model === 'claude-opus-5-5' && p.fallbacks === 'default' && p.betas.includes('server-side-fallback-2026-07-01') && p.thinking.type === 'adaptive' && p.output_config.format.type === 'json_schema' && p.output_config.format.schema === photo.SCHEMA, p && { model: p.model, fallbacks: p.fallbacks });
  check('photo: image then text, notes cleaned', p && p.messages[0].content[0].type === 'image' && p.messages[0].content[0].source.media_type === 'image/jpeg' && /Keep four bedrooms  please/.test(p.messages[0].content.at(-1).text));
  check('photo: response never echoes the key', !JSON.stringify(r.data).includes(VISITOR_KEY));

  const options = JSON.parse(readFileSync(new URL('../../api/_lib/photo-options.json', import.meta.url), 'utf8'));
  const schema = photo.SCHEMA;
  check('photo schema: every option field uses the engine list', Object.entries(schema.properties).filter(([, v]) => v.type === 'string' && v.enum).every(([k, v]) => JSON.stringify(v.enum) === JSON.stringify(options[k])));
  check('photo schema: strict object, all fields required, no numeric constraints', schema.additionalProperties === false && schema.required.length === Object.keys(schema.properties).length && !JSON.stringify(schema).match(/"(minimum|maximum|minLength|maxLength)"/));

  sent = [];
  for (const [name, body, status] of [
    ['no photos', { photos: [] }, 400],
    ['too many photos', { photos: Array(photo.MAX_PHOTOS + 1).fill(one.photos[0]) }, 400],
    ['bad media type', { photos: [{ mediaType: 'image/svg+xml', data: JPEG }] }, 400],
    ['bad base64', { photos: [{ mediaType: 'image/png', data: 'not base64!' }] }, 400],
    ['oversized photo', { photos: [{ mediaType: 'image/png', data: 'A'.repeat(5_100_000) }] }, 413],
    ['long notes', { ...one, notes: 'x'.repeat(501) }, 400],
  ]) {
    r = await post(body, { key: VISITOR_KEY });
    check(`photo: ${name} -> ${status}`, r.status === status, r.status);
  }
  check('photo: invalid requests never reach Claude', sent.length === 0);

  reply = () => ({ stop_reason: 'refusal', model: photo.MODEL, content: [] });
  r = await post(one, { key: VISITOR_KEY });
  check('photo: refusal -> 422', r.status === 422, r);
  reply = () => ({ stop_reason: 'end_turn', model: photo.MODEL, content: [{ type: 'text', text: '{"homeStyle":' }] });
  r = await post(one, { key: VISITOR_KEY });
  check('photo: truncated JSON -> 502', r.status === 502, r);
  reply = () => { throw new Anthropic.AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 'invalid x-api-key', new Headers()); };
  r = await post(one, { key: VISITOR_KEY });
  check('photo: rejected visitor key -> 401 with a plain message', r.status === 401 && /did not accept/.test(r.data.error) && !JSON.stringify(r.data).includes(VISITOR_KEY), r);
  reply = () => { throw new Anthropic.RateLimitError(429, { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }, 'slow down', new Headers()); };
  r = await post(one, { key: VISITOR_KEY });
  check('photo: rate limit -> 429', r.status === 429, r);
  reply = () => ({ stop_reason: 'end_turn', model: photo.MODEL, content: [{ type: 'text', text: JSON.stringify(READ) }] });

  // The site's own key: open when the site has no accounts, signed-in visitors only when it does.
  setEnv({ ANTHROPIC_API_KEY: SITE_KEY });
  sent = [];
  r = await call(config.GET, req('GET', '/api/config'));
  check('photo config: available with a site key, no sign-in without accounts', r.data.photo.available === true && r.data.photo.signIn === false && !JSON.stringify(r.data).includes(SITE_KEY), r.data);
  r = await post(one);
  check('photo: site key used when the visitor has none', r.status === 200 && sent[0]?.apiKey === SITE_KEY, r);
  setEnv({ ANTHROPIC_API_KEY: SITE_KEY, GOOGLE_CLIENT_ID: CLIENT_ID, SESSION_SECRET: SECRET });
  useMemoryStore();
  sent = [];
  r = await call(config.GET, req('GET', '/api/config'));
  check('photo config: sign-in required when accounts exist', r.data.photo.available === true && r.data.photo.signIn === true, r.data);
  r = await post(one);
  check('photo: site key needs sign-in when accounts exist', r.status === 401 && sent.length === 0, r);
  const login = await call(google.POST, req('POST', '/api/auth/google', { body: { credential: mintToken() } }));
  r = await post(one, { cookie: cookieFrom(login) });
  check('photo: signed-in visitor uses the site key', r.status === 200 && sent[0]?.apiKey === SITE_KEY, r);
  r = await post(one, { key: VISITOR_KEY });
  check('photo: own key works without signing in', r.status === 200 && sent[1]?.apiKey === VISITOR_KEY, r);
  r = await call(rootPhoto.POST, req('POST', '/api/photo-design', { body: one, headers: { 'x-anthropic-key': VISITOR_KEY } }));
  check('photo (root wrapper): same handler', r.status === 200, r);
  photo.setClientFactory(null);
}

// Redis REST client shape (stubbed fetch)
{
  setEnv({ GOOGLE_CLIENT_ID: CLIENT_ID, SESSION_SECRET: SECRET, UPSTASH_REDIS_REST_URL: 'https://redis.example/', UPSTASH_REDIS_REST_TOKEN: 'tok' });
  useEnvStore();
  const calls = [];
  const kv = new Map();
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url) === GOOGLE_JWKS_URL) return prevFetch(url, init);
    const args = JSON.parse(init.body);
    calls.push({ url: String(url), auth: init.headers.Authorization, args });
    const [c, key, ...rest] = args;
    let result = null;
    if (c === 'GET') result = kv.get(key) ?? null;
    else if (c === 'SET') { kv.set(key, rest[0]); result = 'OK'; }
    return new Response(JSON.stringify({ result }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const r = await call(google.POST, req('POST', '/api/auth/google', { body: { credential: mintToken() } }));
  globalThis.fetch = prevFetch;
  check('redis store: login works via REST', r.status === 200, r);
  check('redis store: POSTs JSON command arrays with bearer token', calls.length === 2 && calls.every((c) => c.url === 'https://redis.example' && c.auth === 'Bearer tok') && calls[0].args[0] === 'GET' && calls[1].args[0] === 'SET' && calls[1].args[1] === 'uf:user:1234567890', calls);
}

globalThis.fetch = realFetch;
if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll account API checks passed');
