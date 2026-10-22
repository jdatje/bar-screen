// Wexer 2.0 — games: a small library of your own game files (ROMs) and a
// player page that runs them with EmulatorJS in the kiosk browser.
// Listens on 127.0.0.1 only: the app container is the way in (it checks the
// admin code for uploads and deletes).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = Number(process.env.GAMES_PORT || 8081);
const DATA = process.env.DATA_DIR || '/data';
const ROMS = path.join(DATA, 'roms');
const LIB = path.join(DATA, 'library.json');
const MAX_BYTES = 512 * 1024 * 1024;
// Emulator scripts and cores come from the EmulatorJS CDN, pinned to a release
const EJS = process.env.EJS_DATA || 'https://cdn.emulatorjs.org/4.2.3/data/';

export const SYSTEMS = [
  { id: 'n64', label: 'Nintendo 64', ext: ['z64', 'n64', 'v64'] },
  { id: 'snes', label: 'Super Nintendo', ext: ['sfc', 'smc'] },
  { id: 'nes', label: 'NES', ext: ['nes'] },
  { id: 'gba', label: 'Game Boy Advance', ext: ['gba'] },
  { id: 'gb', label: 'Game Boy (Color)', ext: ['gb', 'gbc'] },
  { id: 'segaMD', label: 'Sega Mega Drive', ext: ['md', 'gen', 'smd'] },
];

fs.mkdirSync(ROMS, { recursive: true });
let library = [];
try {
  library = JSON.parse(fs.readFileSync(LIB, 'utf8'));
} catch {
  library = [];
}
const saveLib = () => fs.writeFileSync(LIB, JSON.stringify(library, null, 1));

const guessSystem = (file) => {
  const ext = path.extname(file).slice(1).toLowerCase();
  return SYSTEMS.find((s) => s.ext.includes(ext))?.id || null;
};
const cleanName = (s) => String(s || '').replace(/\.[a-z0-9]{1,4}$/i, '').replace(/[_]+/g, ' ').replace(/\s*[([].*?[)\]]\s*/g, ' ').trim().slice(0, 60);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

// Streams a ROM, with Range support
function sendRom(req, res, game) {
  const file = path.join(ROMS, game.file);
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return json(res, 404, { error: 'missing' });
  }
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  const headers = { 'content-type': 'application/octet-stream', 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=86400' };
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${stat.size}`, 'content-length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'content-length': stat.size });
  fs.createReadStream(file).pipe(res);
}

// The page that runs one game. Exit: the button on the touchscreen, or hold
// SELECT + START on a controller for 2 seconds.
function playerPage(game) {
  const romUrl = `/games/rom/${game.id}/${encodeURIComponent(game.original || game.file)}`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(game.name)}</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#game{width:100vw;height:100vh}</style>
</head><body><div id="game"></div>
<script>
  EJS_player = '#game';
  EJS_core = ${JSON.stringify(game.system)};
  EJS_gameUrl = ${JSON.stringify(romUrl)};
  EJS_gameName = ${JSON.stringify(game.name)};
  EJS_gameID = ${JSON.stringify(game.id)};
  EJS_pathtodata = ${JSON.stringify(EJS)};
  EJS_startOnLoaded = true;
  EJS_color = '#F2A900';
  EJS_backgroundColor = '#000';
  EJS_volume = 0.8;
  // tell the touchscreen when the game runs (it pauses the music)
  EJS_onGameStart = () => parent.postMessage({ type: 'wexer:game-started' }, '*');
  // hold SELECT + START (buttons 8 and 9) for 2 seconds to go back
  let held = 0;
  setInterval(() => {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const both = pads.some((p) => p.buttons[8]?.pressed && p.buttons[9]?.pressed);
    held = both ? held + 100 : 0;
    if (held >= 2000) { held = -100000; parent.postMessage({ type: 'wexer:exit-game' }, '*'); }
  }, 100);
</script>
<script src="${EJS}loader.js"></script>
</body></html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/api/systems') return json(res, 200, SYSTEMS.map(({ id, label, ext }) => ({ id, label, ext })));
    if (req.method === 'GET' && url.pathname === '/api/games') {
      return json(res, 200, [...library].sort((a, b) => a.name.localeCompare(b.name)).map(({ id, name, system, size }) => ({ id, name, system, size })));
    }
    // upload: raw body, ?file=<original file name>&name=<display name>&system=<id>
    if (req.method === 'PUT' && url.pathname === '/api/games') {
      const original = path.basename(url.searchParams.get('file') || 'game.bin');
      const system = url.searchParams.get('system') || guessSystem(original);
      if (!SYSTEMS.some((s) => s.id === system)) return json(res, 400, { error: 'unknown_system' });
      const id = crypto.randomUUID().slice(0, 8);
      const ext = path.extname(original).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin';
      const file = `${id}${ext}`;
      const tmp = path.join(ROMS, `${file}.part`);
      let size = 0;
      const out = fs.createWriteStream(tmp);
      await new Promise((resolve, reject) => {
        req.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy();
            reject(new Error('too_big'));
          }
        });
        req.on('error', reject);
        out.on('error', reject);
        out.on('finish', resolve);
        req.pipe(out);
      }).catch((err) => {
        fs.rmSync(tmp, { force: true });
        throw err;
      });
      if (!size) {
        fs.rmSync(tmp, { force: true });
        return json(res, 400, { error: 'empty' });
      }
      fs.renameSync(tmp, path.join(ROMS, file));
      const game = { id, name: cleanName(url.searchParams.get('name') || original) || original, system, file, original, size, added: Date.now() };
      library.push(game);
      saveLib();
      return json(res, 200, { ok: true, game });
    }
    if (req.method === 'DELETE' && parts[0] === 'api' && parts[1] === 'games' && parts[2]) {
      const game = library.find((g) => g.id === parts[2]);
      if (!game) return json(res, 404, { error: 'not_found' });
      fs.rmSync(path.join(ROMS, game.file), { force: true });
      library = library.filter((g) => g !== game);
      saveLib();
      return json(res, 200, { ok: true });
    }
    if (req.method === 'PATCH' && parts[0] === 'api' && parts[1] === 'games' && parts[2]) {
      const game = library.find((g) => g.id === parts[2]);
      if (!game) return json(res, 404, { error: 'not_found' });
      let body = '';
      for await (const c of req) body += c;
      const patch = JSON.parse(body || '{}');
      if (patch.name) game.name = cleanName(patch.name) || game.name;
      if (SYSTEMS.some((s) => s.id === patch.system)) game.system = patch.system;
      saveLib();
      return json(res, 200, { ok: true, game });
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && parts[0] === 'rom' && parts[1]) {
      const game = library.find((g) => g.id === parts[1]);
      return game ? sendRom(req, res, game) : json(res, 404, { error: 'not_found' });
    }
    if (req.method === 'GET' && parts[0] === 'play' && parts[1]) {
      const game = library.find((g) => g.id === parts[1]);
      if (!game) return json(res, 404, { error: 'not_found' });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(playerPage(game));
    }
    json(res, 404, { error: 'not_found' });
  } catch (err) {
    if (!res.headersSent) json(res, err.message === 'too_big' ? 413 : 500, { error: err.message });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`Wexer games on 127.0.0.1:${PORT} (${library.length} games)`));
