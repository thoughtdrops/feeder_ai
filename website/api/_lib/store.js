// Persistence behind a tiny interface: Upstash Redis REST (production) or in-memory (tests).
//   uf:user:{sub}    -> JSON string (SET/GET)
//   uf:builds:{sub}  -> HASH id -> JSON {id,name,updated,summary,design}
import { HttpError } from './http.js';

const userKey = (sub) => `uf:user:${sub}`;
const buildsKey = (sub) => `uf:builds:${sub}`;

function redisEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

function parseJson(s) {
  if (typeof s !== 'string') return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function createRedisStore({ url, token }) {
  async function cmd(...args) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args.map(String)),
      });
    } catch {
      throw new HttpError(502, 'Storage unavailable');
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* fallthrough */
    }
    if (!res.ok || !data || data.error) throw new HttpError(502, 'Storage unavailable');
    return data.result;
  }
  return {
    async getUser(sub) {
      return parseJson(await cmd('GET', userKey(sub)));
    },
    async putUser(sub, user) {
      await cmd('SET', userKey(sub), JSON.stringify(user));
    },
    async listBuilds(sub) {
      const flat = (await cmd('HGETALL', buildsKey(sub))) || [];
      const out = [];
      if (Array.isArray(flat)) {
        for (let i = 1; i < flat.length; i += 2) {
          const b = parseJson(flat[i]);
          if (b) out.push(b);
        }
      } else if (flat && typeof flat === 'object') {
        for (const v of Object.values(flat)) {
          const b = parseJson(v);
          if (b) out.push(b);
        }
      }
      return out;
    },
    async getBuild(sub, id) {
      return parseJson(await cmd('HGET', buildsKey(sub), id));
    },
    async hasBuild(sub, id) {
      return Number(await cmd('HEXISTS', buildsKey(sub), id)) === 1;
    },
    async countBuilds(sub) {
      return Number(await cmd('HLEN', buildsKey(sub))) || 0;
    },
    async putBuild(sub, build) {
      await cmd('HSET', buildsKey(sub), build.id, JSON.stringify(build));
    },
    async deleteBuild(sub, id) {
      return Number(await cmd('HDEL', buildsKey(sub), id)) > 0;
    },
  };
}

export function createMemoryStore() {
  const strings = new Map();
  const hashes = new Map();
  const hash = (k) => {
    if (!hashes.has(k)) hashes.set(k, new Map());
    return hashes.get(k);
  };
  return {
    _strings: strings,
    _hashes: hashes,
    async getUser(sub) {
      return parseJson(strings.get(userKey(sub)) ?? null);
    },
    async putUser(sub, user) {
      strings.set(userKey(sub), JSON.stringify(user));
    },
    async listBuilds(sub) {
      return [...hash(buildsKey(sub)).values()].map(parseJson).filter(Boolean);
    },
    async getBuild(sub, id) {
      return parseJson(hash(buildsKey(sub)).get(id) ?? null);
    },
    async hasBuild(sub, id) {
      return hash(buildsKey(sub)).has(id);
    },
    async countBuilds(sub) {
      return hash(buildsKey(sub)).size;
    },
    async putBuild(sub, build) {
      hash(buildsKey(sub)).set(build.id, JSON.stringify(build));
    },
    async deleteBuild(sub, id) {
      return hash(buildsKey(sub)).delete(id);
    },
  };
}

let override = null;

/** Tests: switch to a fresh in-memory store. Returns it. */
export function useMemoryStore() {
  override = createMemoryStore();
  return override;
}

/** Tests: go back to environment-configured storage. */
export function useEnvStore() {
  override = null;
}

export function storeConfigured() {
  return Boolean(override || redisEnv());
}

export function getStore() {
  if (override) return override;
  const env = redisEnv();
  if (!env) throw new HttpError(503, 'Accounts are not configured');
  return createRedisStore(env);
}
