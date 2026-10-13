// Saved builds for the signed-in user.
//   GET    /api/builds          -> {builds:[{id,name,updated,summary}]} newest first
//   GET    /api/builds?id=X     -> {build:{id,name,updated,summary,design}}
//   POST   /api/builds {id?,name,summary?,design} -> {build:{id,name,updated,summary}}
//   DELETE /api/builds?id=X     -> 204
import { randomUUID } from 'node:crypto';
import { assertMutationAllowed, handler, HttpError, isPlainObject, json, readJsonBody } from './_lib/http.js';
import { assertConfigured, requireActiveSession } from './_lib/session.js';
import { getStore } from './_lib/store.js';

const MAX_DESIGN_BYTES = 150 * 1024;
const MAX_BUILDS = 50;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
// C0, DEL and C1 control characters, plus line/paragraph separators.
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

const meta = (b) => ({ id: b.id, name: b.name, updated: b.updated, summary: b.summary || '' });

function idParam(request) {
  const id = new URL(request.url).searchParams.get('id');
  if (id === null) return null;
  if (!ID_RE.test(id)) throw new HttpError(404, 'Build not found');
  return id;
}

function cleanName(raw) {
  if (typeof raw !== 'string') throw new HttpError(400, 'Name is required');
  const name = raw.replace(CONTROL_RE, '').trim();
  const len = [...name].length;
  if (len < 1) throw new HttpError(400, 'Name is required');
  if (len > 80) throw new HttpError(400, 'Name must be at most 80 characters');
  return name;
}

function cleanSummary(raw) {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') throw new HttpError(400, 'Summary must be a string');
  const summary = raw.replace(CONTROL_RE, ' ').trim();
  if ([...summary].length > 200) throw new HttpError(400, 'Summary must be at most 200 characters');
  return summary;
}

export const GET = handler(async (request) => {
  assertConfigured();
  const { sub } = await requireActiveSession(request);
  const store = getStore();
  const id = idParam(request);
  if (id !== null) {
    const b = await store.getBuild(sub, id);
    if (!b) throw new HttpError(404, 'Build not found');
    return json(200, { build: { ...meta(b), design: b.design } });
  }
  const builds = (await store.listBuilds(sub))
    .map(meta)
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  return json(200, { builds });
});

export const POST = handler(async (request) => {
  assertConfigured();
  assertMutationAllowed(request);
  const { sub } = await requireActiveSession(request);
  const body = await readJsonBody(request, MAX_DESIGN_BYTES + 16 * 1024);
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');

  const name = cleanName(body.name);
  const summary = cleanSummary(body.summary);
  if (!isPlainObject(body.design)) throw new HttpError(400, 'Design must be a JSON object');
  if (Buffer.byteLength(JSON.stringify(body.design), 'utf8') > MAX_DESIGN_BYTES) {
    throw new HttpError(413, 'Design is too large (max 150 KB)');
  }

  const store = getStore();
  let id;
  if (body.id !== undefined && body.id !== null) {
    if (typeof body.id !== 'string' || !ID_RE.test(body.id) || !(await store.hasBuild(sub, body.id))) {
      throw new HttpError(404, 'Build not found');
    }
    id = body.id;
  } else {
    if ((await store.countBuilds(sub)) >= MAX_BUILDS) {
      throw new HttpError(409, `You can save up to ${MAX_BUILDS} builds. Delete one to save another.`);
    }
    id = randomUUID();
  }

  const build = { id, name, updated: new Date().toISOString(), summary, design: body.design };
  await store.putBuild(sub, build);
  return json(200, { build: meta(build) });
});

export const DELETE = handler(async (request) => {
  assertConfigured();
  assertMutationAllowed(request);
  const { sub } = await requireActiveSession(request);
  const id = idParam(request);
  if (id === null) throw new HttpError(400, 'Missing id');
  if (!(await getStore().deleteBuild(sub, id))) throw new HttpError(404, 'Build not found');
  return json(204, null);
});
