// Diagnostics for remote troubleshooting: speaker events, speaker status and
// the bar PC's logs (via the balena supervisor). Served on /diag.
const SPEAKER = process.env.LIBRESPOT_URL || 'http://127.0.0.1:3678';
const events = []; // last speaker events, newest last

function remember(type, data) {
  events.push({ at: new Date().toISOString(), type, data });
  if (events.length > 200) events.shift();
}

// Follow the speaker's event stream (song changes, pauses, disconnects...)
export function watchSpeaker(onEvent) {
  if (typeof WebSocket === 'undefined') return;
  const connect = () => {
    let ws;
    try {
      ws = new WebSocket(SPEAKER.replace(/^http/, 'ws') + '/events');
    } catch (err) {
      remember('ws-error', err.message);
      return setTimeout(connect, 5000);
    }
    ws.onopen = () => remember('ws-open', null);
    ws.onmessage = (m) => {
      let ev;
      try {
        ev = JSON.parse(m.data);
      } catch {
        ev = { type: 'raw', data: String(m.data).slice(0, 300) };
      }
      remember(ev.type || 'event', ev.data ?? null);
      onEvent?.(ev.type);
      // also into the container log
      console.log('Speaker event:', ev.type, JSON.stringify(ev.data ?? '').slice(0, 200));
    };
    ws.onclose = () => {
      remember('ws-close', null);
      setTimeout(connect, 3000);
    };
    ws.onerror = () => {};
  };
  connect();
}

async function speakerStatus() {
  try {
    const res = await fetch(`${SPEAKER}/status`, { signal: AbortSignal.timeout(4000) });
    if (res.status === 204) return { session: false };
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

async function journal(lines, grep) {
  const addr = process.env.BALENA_SUPERVISOR_ADDRESS;
  const key = process.env.BALENA_SUPERVISOR_API_KEY;
  if (!addr || !key) return 'Not running on balena (no supervisor API).';
  try {
    const res = await fetch(`${addr}/v2/journal-logs?apikey=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ follow: false, all: false, count: grep ? 5000 : lines, format: 'short' }),
      signal: AbortSignal.timeout(15000),
    });
    let text = await res.text();
    if (grep) {
      const re = new RegExp(grep, 'i');
      text = text.split('\n').filter((l) => re.test(l)).slice(-lines).join('\n');
    }
    return text;
  } catch (err) {
    return `journal-logs failed: ${err.message}`;
  }
}

export async function report({ lines = 300, grep = '' } = {}) {
  const status = await speakerStatus();
  if (status?.track) status.track = { ...status.track, album_cover_url: undefined };
  return {
    time: new Date().toISOString(),
    speaker: status,
    events: events.slice(-80),
    logs: await journal(Math.min(Number(lines) || 300, 2000), grep),
  };
}
