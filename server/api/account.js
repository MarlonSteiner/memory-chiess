import { accounts } from '../lib/accounts.js';
import { blobStore } from '../lib/blob-store.js';

// The website, and the iPhone app (which serves its files from capacitor://localhost).
const ORIGINS = ['https://marlonsteiner.github.io', 'capacitor://localhost'];
const handle = accounts(blobStore);

export default async function account(req, res) {
  const origin = ORIGINS.includes(req.headers.origin) ? req.headers.origin : ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
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
