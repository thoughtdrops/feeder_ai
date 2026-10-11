// Shared HTTP helpers for the account API (Vercel Node.js runtime, Web-standard handlers).

export const MAX_BODY_BYTES = 256 * 1024;

export class HttpError extends Error {
  constructor(status, message, headers) {
    super(message);
    this.status = status;
    this.headers = headers || {};
  }
}

export function json(status, body, headers = {}) {
  const h = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  for (const [k, v] of Object.entries(headers)) {
    if (Array.isArray(v)) v.forEach((x) => h.append(k, x));
    else h.set(k, v);
  }
  if (status === 204) {
    h.delete('Content-Type');
    return new Response(null, { status, headers: h });
  }
  return new Response(JSON.stringify(body), { status, headers: h });
}

export function errorResponse(err) {
  if (err instanceof HttpError) return json(err.status, { error: err.message }, err.headers);
  // Never leak internals.
  console.error('[api] unexpected error:', err && err.message ? err.message : err);
  return json(500, { error: 'Internal error' });
}

/** Wrap a handler so every thrown error becomes a JSON error response. */
export function handler(fn) {
  return async function wrapped(request) {
    try {
      return await fn(request);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** CSRF defence for POST/DELETE: custom header + same-origin Origin (when present). */
export function assertMutationAllowed(request) {
  if (request.headers.get('x-uf-request') !== '1') {
    throw new HttpError(403, 'Missing request header');
  }
  const origin = request.headers.get('origin');
  if (origin !== null) {
    let originHost;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      throw new HttpError(403, 'Cross-origin request rejected');
    }
    const hosts = [request.headers.get('host'), request.headers.get('x-forwarded-host')]
      .filter(Boolean)
      .flatMap((h) => h.split(','))
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    if (!hosts.includes(originHost)) {
      throw new HttpError(403, 'Cross-origin request rejected');
    }
  }
}

export async function readJsonBody(request, maxBytes = MAX_BODY_BYTES) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(413, 'Request body too large');
  }
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new HttpError(413, 'Request body too large');
  }
  if (!text) throw new HttpError(400, 'Request body must be JSON');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Request body must be JSON');
  }
}

export function getCookie(request, name) {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
