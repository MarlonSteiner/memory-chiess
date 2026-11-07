import { BlobPreconditionFailedError, get, put } from '@vercel/blob';
import { accounts } from '../lib/accounts.js';

const SITE = 'https://marlonsteiner.github.io';
const save = (path, data, options) => put(path, JSON.stringify(data), { access: 'private', contentType: 'application/json', ...options });

async function read(path) {
  const found = await get(path, { access: 'private', useCache: false });
  if (found?.statusCode !== 200) return null;
  return { data: await new Response(found.stream).json(), etag: found.blob.etag };
}

const handle = accounts({
  read,
  async create(path, data) {
    try {
      await save(path, data);
      return true;
    } catch (e) {
      if (await read(path)) return false; // writing over an existing file is refused
      throw e;
    }
  },
  async update(path, data, etag) {
    try {
      await save(path, data, { allowOverwrite: true, ifMatch: etag });
      return true;
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError) return false;
      throw e;
    }
  },
});

export default async function account(req, res) {
  res.setHeader('Access-Control-Allow-Origin', SITE);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Unknown request.' });
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const { status, json } = await handle(req.body, token);
  return res.status(status).json(json);
}
