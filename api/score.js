// POST /api/score  { id, catches, score }
// Adds one floor's catches and score to the player's totals.
// These come from the browser, so they could be faked (PRD section 10: fine for now).
import { FieldValue } from 'firebase-admin/firestore';
import { players } from './_lib/firebase.js';
import { allow, isPlayerId, route } from './_lib/http.js';

// Generous per-floor limits, just to stop obviously broken numbers.
const MAX_CATCHES = 100;
const MAX_SCORE = 20000;
const isCount = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;

export default route(async (req, res) => {
  if (!allow(req, res, 'POST')) return;
  const { id, catches, score } = req.body ?? {};
  if (!isPlayerId(id) || !isCount(catches, MAX_CATCHES) || !isCount(score, MAX_SCORE)) {
    res.status(400).json({ ok: false, message: 'Bad score.' });
    return;
  }
  const ref = players().doc(id);
  if (!(await ref.get()).exists) {
    res.status(404).json({ ok: false, message: 'Unknown player.' });
    return;
  }
  await ref.update({
    catches: FieldValue.increment(catches),
    score: FieldValue.increment(score),
    updatedAt: FieldValue.serverTimestamp(),
  });
  res.status(200).json({ ok: true });
});
