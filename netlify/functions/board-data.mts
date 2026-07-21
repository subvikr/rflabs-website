import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Auth: verify the caller's token by asking Netlify Identity's own REST
// endpoint whether it's valid — the same check public/apps/index.html
// already does successfully after login. We deliberately do NOT use
// @netlify/identity's getUser(), which verifies the JWT locally rather
// than against the live Identity service: that local verification is
// unreliable under `netlify dev` (a long-standing Netlify Identity/local
// dev limitation), even though the token itself is perfectly valid.
// Verifying a token against the live Identity service is a real network
// call (through the local proxy to Netlify's actual Identity backend), and
// it's by far the slowest part of each request — every board-data call was
// paying that cost even though the same token is reused across a burst of
// requests (e.g. loading the index, then every project; or a save
// immediately followed by another). Cache a verified token for a short
// window so repeat calls with the same token skip the network hop.
const verifiedTokenCache = new Map<string, { user: { email?: string }; expiresAt: number }>();
const TOKEN_CACHE_TTL_MS = 60_000;

async function verifyUser(req: Request): Promise<{ email?: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const cached = verifiedTokenCache.get(authHeader);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  const origin = new URL(req.url).origin;
  try {
    const res = await fetch(`${origin}/.netlify/identity/user`, {
      headers: { Authorization: authHeader }
    });
    if (!res.ok) return null;
    const user = await res.json();
    verifiedTokenCache.set(authHeader, { user, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
    return user;
  } catch {
    return null;
  }
}

// All board data normally lives in one Netlify Blobs store named
// "project-board". Every request must come from a logged-in Netlify
// Identity user, or it's rejected with 401 before touching any data.
//
// LOCAL DEV NOTE: Netlify Blobs' local emulator has proven unreliable in
// this project under `netlify dev` — writes appear to succeed (an
// immediate read-after-write matches) but never actually persist to disk,
// so data vanishes on the next request (e.g. a browser refresh). Rather
// than depend on that emulator, local dev instead reads/writes a plain
// JSON file on disk. Production (and any deployed preview) is completely
// unaffected and keeps using real Netlify Blobs as before.
const isLocalDev =
  process.env.NETLIFY_DEV === 'true' ||
  process.env.NETLIFY_LOCAL === 'true' ||
  !process.env.SITE_ID;
const LOCAL_DATA_DIR = join(process.cwd(), '.local-data');
const LOCAL_DATA_FILE = join(LOCAL_DATA_DIR, 'board-data.json');

console.log('[board-data] --- request ---');
console.log('[board-data] NETLIFY_DEV env =', process.env.NETLIFY_DEV);
console.log('[board-data] SITE_ID env =', process.env.SITE_ID);
console.log('[board-data] isLocalDev resolved to =', isLocalDev);
console.log('[board-data] process.cwd() =', process.cwd());
console.log('[board-data] LOCAL_DATA_FILE =', LOCAL_DATA_FILE);
console.log('[board-data] LOCAL_DATA_FILE exists? =', existsSync(LOCAL_DATA_FILE));

function readLocalStore(): Record<string, string> {
  if (!existsSync(LOCAL_DATA_FILE)) return {};
  try {
    return JSON.parse(readFileSync(LOCAL_DATA_FILE, 'utf-8'));
  } catch {
    return {};
  }
}
function writeLocalStore(data: Record<string, string>) {
  mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  writeFileSync(LOCAL_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

const localStore = {
  async get(key: string) {
    const data = readLocalStore();
    return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
  },
  async set(key: string, value: string) {
    const data = readLocalStore();
    data[key] = value;
    writeLocalStore(data);
  },
  async delete(key: string) {
    const data = readLocalStore();
    delete data[key];
    writeLocalStore(data);
  },
  async list({ prefix }: { prefix: string }) {
    const data = readLocalStore();
    const blobs = Object.keys(data)
      .filter((k) => k.startsWith(prefix))
      .map((key) => ({ key }));
    return { blobs };
  },
};

export default async (req: Request, context: Context) => {
  const user = await verifyUser(req);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const store = isLocalDev ? localStore : getStore('project-board');
  const url = new URL(req.url);

  try {
    if (req.method === 'GET') {
      // List keys: /.netlify/functions/board-data?prefix=project:
      const prefix = url.searchParams.get('prefix');
      if (prefix !== null) {
        const { blobs } = await store.list({ prefix });
        return Response.json({ keys: blobs.map((b) => b.key) });
      }

      // Batch get: /.netlify/functions/board-data?keys=project:a,project:b
      // Reads happen concurrently within this single request/round-trip,
      // instead of the client making one HTTP request per key.
      const keysParam = url.searchParams.get('keys');
      if (keysParam !== null) {
        const keys = keysParam.split(',').map((k) => k.trim()).filter(Boolean);
        const values: Record<string, string> = {};
        await Promise.all(
          keys.map(async (k) => {
            const v = await store.get(k);
            if (v !== null) values[k] = v;
          })
        );
        return Response.json({ values });
      }

      // Get one key: /.netlify/functions/board-data?key=project-ids
      const key = url.searchParams.get('key');
      if (!key) return new Response('Missing "key" query param', { status: 400 });

      const value = await store.get(key);
      if (value === null) return new Response('Not found', { status: 404 });
      return Response.json({ key, value });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { key, value } = body;
      if (!key || value === undefined) {
        return new Response('Body must include "key" and "value"', { status: 400 });
      }
      await store.set(key, value);
      console.log('[board-data] wrote key =', key, '| file exists after write? =', existsSync(LOCAL_DATA_FILE));
      return Response.json({ key, value });
    }

    if (req.method === 'DELETE') {
      const key = url.searchParams.get('key');
      if (!key) return new Response('Missing "key" query param', { status: 400 });
      await store.delete(key);
      return Response.json({ key, deleted: true });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (err) {
    console.error('board-data function error', err);
    return new Response('Server error', { status: 500 });
  }
};
