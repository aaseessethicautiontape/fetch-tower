// POST /api/force-open
// The fake door on Floor 3. The server always refuses (PRD section 7).
export default function handler(_req, res) {
  res.status(403).json({ message: 'That door was never unlocked on the server.' });
}
