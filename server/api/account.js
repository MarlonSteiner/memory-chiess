import { accounts } from '../lib/accounts.js';
import { blobStore } from '../lib/blob-store.js';

const SITE = 'https://marlonsteiner.github.io';
const handle = accounts(blobStore);

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
