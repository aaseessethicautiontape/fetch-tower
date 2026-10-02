// GET /api/leaderboard
// Top 20 players by highest floor (from the server's record), then catches.
import { players } from './_lib/firebase.js';
import { allow, route } from './_lib/http.js';

export default route(async (req, res) => {
  if (!allow(req, res, 'GET')) return;
  // Sorting by one field avoids needing a composite index; ties are broken here.
  const snap = await players().orderBy('highestFloor', 'desc').limit(200).get();
  const list = snap.docs
    .map((d) => d.data())
    .map((p) => ({ nickname: p.nickname, highestFloor: p.highestFloor ?? 1, catches: p.catches ?? 0 }))
    .sort((a, b) => b.highestFloor - a.highestFloor || b.catches - a.catches)
    .slice(0, 20);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ players: list });
});
