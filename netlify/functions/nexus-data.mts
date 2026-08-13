import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Auth: identical pattern to board-data.mts — verify the caller's token
// against Netlify Identity's own REST endpoint (not local JWT verification,
// which is unreliable under `netlify dev`). See board-data.mts for the
// full rationale. Cached briefly so a burst of requests with the same
// token doesn't re-pay the network round trip each time.
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

// NEXUS' data lives in its own Netlify Blobs store, "nexus-crm" —
// deliberately separate from RFLABS VISION's "project-board" store so the
// two tools' keys can never collide. Every request must come from a
// logged-in Netlify Identity user (same shared /apps/ login), or it's
// rejected with 401 before touching any data.
//
// LOCAL DEV NOTE: same as board-data.mts — Netlify Blobs' local emulator
// has proven unreliable under `netlify dev` (writes silently don't
// persist), so local dev reads/writes a plain JSON file on disk instead.
// Production and deploy previews are unaffected and use real Blobs.
const isLocalDev =
  process.env.NETLIFY_DEV === 'true' ||
  process.env.NETLIFY_LOCAL === 'true' ||
  !process.env.SITE_ID;
const LOCAL_DATA_DIR = join(process.cwd(), '.local-data');
const LOCAL_DATA_FILE = join(LOCAL_DATA_DIR, 'nexus-data.json');

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

  const store = isLocalDev ? localStore : getStore('nexus-crm');
  const url = new URL(req.url);

  try {
    if (req.method === 'GET') {
      const prefix = url.searchParams.get('prefix');
      if (prefix !== null) {
        const { blobs } = await store.list({ prefix });
        return Response.json({ keys: blobs.map((b) => b.key) });
      }

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
    console.error('nexus-data function error', err);
    return new Response('Server error', { status: 500 });
  }
};
