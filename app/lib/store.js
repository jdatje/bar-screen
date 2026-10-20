// Tiny JSON file store in DATA_DIR (a persistent balena volume).
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export function load(name, fallback) {
  try {
    return { ...fallback, ...JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${name}.json`), 'utf8')) };
  } catch {
    return { ...fallback };
  }
}

export function save(name, data) {
  const file = path.join(DATA_DIR, `${name}.json`);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}
