// POST /api/player  { id, nickname, starter }
// Creates or updates a player. Returns { doorsOpened, highestFloor }.
import { FieldValue } from 'firebase-admin/firestore';
import { players } from './_lib/firebase.js';
import { allow, isPlayerId, route } from './_lib/http.js';

const STARTERS = [1, 4, 7, 25];

export default route(async (req, res) => {
  if (!allow(req, res, 'POST')) return;
  const { id, nickname, starter } = req.body ?? {};
  const name = typeof nickname === 'string' ? nickname.trim().slice(0, 16) : '';
  if (!isPlayerId(id) || !name || !STARTERS.includes(starter)) {
    res.status(400).json({ message: 'Need a player id, a nickname and a starter.' });
    return;
  }

  const ref = players().doc(id);
  const player = await ref.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = FieldValue.serverTimestamp();
    if (!snap.exists) {
      const fresh = { id, nickname: name, starter, doorsOpened: [], highestFloor: 1, catches: 0, score: 0, createdAt: now, updatedAt: now };
      tx.set(ref, fresh);
      return fresh;
    }
    tx.update(ref, { nickname: name, starter, updatedAt: now });
    return snap.data();
  });

  res.status(200).json({ doorsOpened: player.doorsOpened ?? [], highestFloor: player.highestFloor ?? 1 });
});
