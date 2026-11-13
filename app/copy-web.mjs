// Copies the website's files into www/, which is what the app ships.
// The website itself stays where it is; edit those files, then run `npm run sync`.
import { cpSync, rmSync, mkdirSync } from 'fs';
const root = new URL('../', import.meta.url).pathname;
const out = new URL('www/', import.meta.url).pathname;
const files = ['index.html', 'style.css', 'art.js', 'net.js', 'account.js', 'game.js', 'manifest.webmanifest', 'icons', 'vendor'];
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of files) cpSync(root + f, out + f, { recursive: true });
console.log('Copied', files.length, 'items to www/');
