// POST /api/door  { id, door, answer }
// Checks the answer here on the server. If it's right, opens the door and raises highestFloor.
// Returns { ok, message?, doorsOpened, highestFloor }.
import { FieldValue } from 'firebase-admin/firestore';
import { CHECKS, REVEALS } from './_lib/doors.js';
import { players } from './_lib/firebase.js';
import { allow, isPlayerId, route } from './_lib/http.js';

export default route(async (req, res) => {
  if (!allow(req, res, 'POST')) return;
  const { id, door, answer, reveal } = req.body ?? {};

  // Looking back at a door you already opened: show its answer and why.
  if (reveal === true) {
    if (!isPlayerId(id) || !REVEALS[door]) {
      res.status(400).json({ ok: false, message: 'Unknown door.' });
      return;
    }
    const snap = await players().doc(id).get();
    if (!snap.exists || !(snap.data().doorsOpened ?? []).includes(door)) {
      res.status(403).json({ ok: false, message: 'Open this door first!' });
      return;
    }
    res.status(200).json({ ok: true, ...REVEALS[door] });
    return;
  }

  if (!isPlayerId(id) || !CHECKS[door] || typeof answer !== 'string' || answer.length > 300) {
    res.status(400).json({ ok: false, message: 'Type an answer for this door.' });
    return;
  }

  const ref = players().doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ ok: false, message: 'I don’t know you yet. Go back to the title screen and press Play.' });
    return;
  }
  const player = snap.data();
  const progress = () => ({ doorsOpened: player.doorsOpened ?? [], highestFloor: player.highestFloor ?? 1 });

  if ((player.doorsOpened ?? []).includes(door)) {
    res.status(200).json({ ok: true, ...progress() });
    return;
  }
  // Door N sits at the top of Floor N, so you have to have reached that floor first.
  if ((player.highestFloor ?? 1) < door) {
    res.status(403).json({ ok: false, message: `You haven't reached Floor ${door} yet.`, ...progress() });
    return;
  }

  const result = await CHECKS[door](answer);
  if (!result.ok) {
    res.status(200).json({ ok: false, message: result.message, ...progress() });
    return;
  }

  // Right answer: open the door. A transaction so two quick submits can't clash.
  const updated = await ref.firestore.runTransaction(async (tx) => {
    const fresh = (await tx.get(ref)).data();
    const doorsOpened = [...new Set([...(fresh.doorsOpened ?? []), door])].sort((a, b) => a - b);
    const highestFloor = Math.max(fresh.highestFloor ?? 1, door + 1);
    tx.update(ref, { doorsOpened, highestFloor, updatedAt: FieldValue.serverTimestamp() });
    return { doorsOpened, highestFloor };
  });
  res.status(200).json({ ok: true, ...updated });
});
