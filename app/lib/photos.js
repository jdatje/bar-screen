// Photo wall: pictures guests send from their phones (already resized on
// the phone), stored on the bar PC.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { load, save } from './store.js';

const DIR = path.join(process.env.DATA_DIR || './data', 'photos');
const MAX_BYTES = 6 * 1024 * 1024;
const MAX_PHOTOS = 500;
fs.mkdirSync(DIR, { recursive: true });

let index = load('photos', { photos: [] }); // [{ id, by, at }]

export const list = () => [...index.photos].reverse();
export const file = (id) => (/^[a-f0-9-]{8,40}$/.test(id) ? path.join(DIR, `${id}.jpg`) : null);

export async function addFromRequest(req, by) {
  const id = crypto.randomUUID();
  const out = path.join(DIR, `${id}.jpg`);
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BYTES) throw new Error('too_big');
    chunks.push(c);
  }
  const buf = Buffer.concat(chunks);
  // JPEG or PNG only
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  if (!isJpeg && !isPng) throw new Error('not_an_image');
  fs.writeFileSync(out, buf);
  index.photos.push({ id, by: String(by || '').slice(0, 24), at: Date.now() });
  // keep the newest MAX_PHOTOS
  while (index.photos.length > MAX_PHOTOS) {
    const old = index.photos.shift();
    fs.rmSync(path.join(DIR, `${old.id}.jpg`), { force: true });
  }
  save('photos', index);
  return { id };
}

export function remove(id) {
  const f = file(id);
  if (!f) return false;
  fs.rmSync(f, { force: true });
  index.photos = index.photos.filter((p) => p.id !== id);
  save('photos', index);
  return true;
}
