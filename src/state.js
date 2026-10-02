// Player state kept in localStorage (PRD section 11).
// Progress that matters (doors, highest floor) lives on the server, not here.

const KEY = 'fetchTower.player';

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // randomUUID needs a secure context; fall back for plain http on a LAN.
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16),
  );
}

function load() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    saved = {};
  }
  return {
    id: saved.id ?? newId(),
    nickname: saved.nickname ?? '',
    starter: saved.starter ?? null,
    hintTimers: saved.hintTimers ?? {}, // door number -> timestamp (ms) first reached
    hintsEarly: saved.hintsEarly ?? {}, // door number -> hints unlocked early by 3 wrong answers in a row
    pokedex: saved.pokedex ?? [], // caught Pokémon: { id, name, sprite, hp, attack, speed }
  };
}

export const state = load();

// Lives only as long as the page is open (PRD: squad resets when you close the game).
export const session = {
  squad: [], // caught Pokémon following you, oldest first
  lead: 0, // 0 = starter, 1-3 = squad slot
  boostCatches: 0, // catches this session, for the max HP boost
  clearedFloors: new Set(), // floors survived this session (their door can be tried)
  // Mirrors the server's record (PRD section 10). Never decided by the browser.
  online: false,
  doorsOpened: [],
  highestFloor: 1,
};

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the game still works for this session.
  }
}

export function setPlayer(nickname, starter) {
  state.nickname = nickname.trim().slice(0, 16);
  state.starter = starter;
  save();
}

// Starts a door's hint timer the first time it's reached and returns when it started.
export function startHintTimer(door) {
  if (!state.hintTimers[door]) {
    state.hintTimers[door] = Date.now();
    save();
  }
  return state.hintTimers[door];
}

export function addToPokedex(pokemon) {
  if (!state.pokedex.some((p) => p.id === pokemon.id)) {
    state.pokedex.push(pokemon);
    save();
  }
}

save(); // persist the new player id on first visit
