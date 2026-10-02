// Door answers and wrong-answer messages (PRD section 7).
// This file only runs on the server. The answers never reach the browser.

const normalise = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function door1(answer) {
  const a = answer.trim();
  if (a === '30') return { ok: true };
  if (a === '35') return { ok: false, message: "That's Pikachu's HP. The guardian is #19." };
  if (a === '72') return { ok: false, message: "Close, but that's its speed. Look for the stat named hp." };
  return { ok: false, message: 'Not quite. Did you fetch #19 and open stats?' };
}

function door2(answer) {
  const a = answer.trim();
  if (/back_default|\/back\//i.test(a)) return { ok: false, message: "That's its back. Find the front picture." };
  if (a.includes('/pokemon/19.png')) return { ok: true };
  if (/\/pokemon\/\d+\.png/i.test(a)) return { ok: false, message: "That's a picture of a different Pokémon. You need #19." };
  return { ok: false, message: "That's not the picture link. It starts with https and ends in .png." };
}

function door3(answer) {
  const match = answer.trim().match(/^v(\d+)(\.\d+){0,2}$/);
  if (!match) return { ok: false, message: "That doesn't look like a version. It should start with v, like v22.11.0." };
  if (Number(match[1]) >= 22) return { ok: true };
  return { ok: false, message: 'Your Node is too old. Install the LTS version from nodejs.org, then close and reopen VS Code.' };
}

function door4(answer) {
  const a = normalise(answer);
  if (a === 'npm install phaser@3' || a === 'npm i phaser@3') return { ok: true };
  if (a === 'npm install phaser' || a === 'npm i phaser') return { ok: false, message: 'That installs Phaser 4. This course uses Phaser 3.' };
  if (a.includes('phaser@')) return { ok: false, message: 'Wrong version. Which Phaser does this course use?' };
  return { ok: false, message: "That's not an install command. It starts with npm." };
}

// Door 5: check the student's real GitHub repo with the public API (no login).
const GITHUB_USER = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

async function github(path) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'fetch-tower' };
  // Optional: a token raises the limit from 60 to 5000 requests an hour.
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (res.status === 404) return false;
  if (res.ok) return true;
  throw new Error(`GitHub ${res.status} for ${path}`);
}

async function door5(answer) {
  const user = answer.trim().replace(/^@/, '');
  if (!GITHUB_USER.test(user)) return { ok: false, message: "I can't find that GitHub user. Check the spelling." };
  try {
    if (!(await github(`/users/${user}`))) return { ok: false, message: "I can't find that GitHub user. Check the spelling." };
    if (!(await github(`/repos/${user}/poke-arena`))) return { ok: false, message: "Found you, but there's no poke-arena repo yet." };
    if (!(await github(`/repos/${user}/poke-arena/contents/PRD.md`))) {
      return { ok: false, message: "Found your repo, but there's no PRD.md in it. Did you commit and push it?" };
    }
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, message: "GitHub didn't answer just now. Wait a minute and try again." };
  }
}

export const CHECKS = { 1: door1, 2: door2, 3: door3, 4: door4, 5: door5 };
