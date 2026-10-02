// Talks to the Vercel functions in /api (PRD section 13).
// The server decides progress; the browser only shows it.
//
// Expected responses:
//   POST /api/player      -> { doorsOpened: number[], highestFloor: number }
//   POST /api/door        -> { ok: boolean, message?: string, doorsOpened?, highestFloor? }
//   POST /api/force-open  -> 403 { message }
//   POST /api/score       -> { ok: boolean }
//   GET  /api/leaderboard -> { players: [{ nickname, highestFloor, catches }] }

import { session, state } from './state.js';

async function request(path, body) {
  try {
    const res = await fetch(path, body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : undefined);
    // Without the API running (e.g. plain `vite`), unknown paths come back as HTML.
    if (!(res.headers.get('content-type') ?? '').includes('application/json')) return { offline: true };
    return { ok: res.ok, status: res.status, data: await res.json() };
  } catch {
    return { offline: true };
  }
}

export const api = {
  player: () => request('/api/player', { id: state.id, nickname: state.nickname, starter: state.starter }),
  door: (door, answer) => request('/api/door', { id: state.id, door, answer }),
  reveal: (door) => request('/api/door', { id: state.id, door, reveal: true }),
  score: (catches, score) => request('/api/score', { id: state.id, catches, score }),
  leaderboard: () => request('/api/leaderboard'),
};

// Pull the player's real progress from the server into the session.
export async function syncProgress() {
  const res = await api.player();
  session.online = !!res.ok;
  if (res.ok) {
    session.doorsOpened = res.data.doorsOpened ?? [];
    session.highestFloor = res.data.highestFloor ?? 1;
  }
  return res;
}

// tower.forceOpen() from the browser Console. The server always refuses it.
export async function forceOpen() {
  const res = await request('/api/force-open', { id: state.id });
  if (res.offline) {
    console.warn("Couldn't reach the server, so nobody answered. (The door is still locked.)");
  } else {
    console.error(`SERVER REFUSED ${res.status}: "${res.data.message ?? res.data.error}"`);
  }
  window.dispatchEvent(new CustomEvent('tower-force-open', { detail: res }));
}
