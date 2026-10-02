// Small helpers shared by the API routes.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPlayerId(id) {
  return typeof id === 'string' && UUID.test(id);
}

export function allow(req, res, method) {
  if (req.method === method) return true;
  res.setHeader('Allow', method);
  res.status(405).json({ message: `Use ${method}.` });
  return false;
}

// Run a handler and turn unexpected errors into a 500 without leaking details.
export function route(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error. Try again in a moment.' });
    }
  };
}
