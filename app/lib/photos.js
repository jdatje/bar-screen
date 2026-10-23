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

// A plain zip (stored, not compressed: JPEGs don't shrink) of the given photos
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
export function zip(ids) {
  const known = new Map(index.photos.map((p) => [p.id, p]));
  const locals = [];
  const central = [];
  let offset = 0;
  let n = 0;
  for (const id of ids) {
    const meta = known.get(id);
    const f = file(id);
    if (!meta || !f || !fs.existsSync(f)) continue;
    const data = fs.readFileSync(f);
    const d = new Date(meta.at);
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const by = String(meta.by || 'gast').replace(/[^\w-]+/g, '_').slice(0, 20) || 'gast';
    const name = Buffer.from(`wexer-${String(++n).padStart(3, '0')}-${by}.jpg`);
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0, 6); head.writeUInt16LE(0, 8);
    head.writeUInt16LE(time, 10); head.writeUInt16LE(date, 12); head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(data.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(name.length, 26); head.writeUInt16LE(0, 28);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0, 8); cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(time, 12); cen.writeUInt16LE(date, 14); cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);
    locals.push(head, name, data);
    central.push(cen, name);
    offset += head.length + name.length + data.length;
  }
  if (!n) return null;
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(n, 8); end.writeUInt16LE(n, 10);
  end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cenBuf, end]);
}
