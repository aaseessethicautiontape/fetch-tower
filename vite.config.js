import { defineConfig, loadEnv } from 'vite';

// In production, Vercel runs the files in /api as serverless functions.
// For `npm run dev`, this plugin runs the same files locally so the game works end to end.
function apiDevServer() {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        const name = url.pathname.replace(/^\//, '');
        // Answer every /api path here. Never fall through to Vite's file server,
        // which would hand the browser the source of api/_lib/doors.js (the answers).
        const notFound = () => {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ message: 'Not found.' }));
        };
        if (!/^[a-z-]+$/.test(name)) return notFound();

        let handler;
        try {
          handler = (await server.ssrLoadModule(`/api/${name}.js`)).default;
        } catch {
          return notFound();
        }

        // Give req/res the same shape Vercel does: req.query, req.body, res.status().json().
        let raw = '';
        for await (const chunk of req) raw += chunk;
        req.query = Object.fromEntries(url.searchParams);
        try {
          req.body = raw && (req.headers['content-type'] ?? '').includes('application/json') ? JSON.parse(raw) : raw || undefined;
        } catch {
          req.body = undefined;
        }
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        res.json = (data) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
          return res;
        };
        await handler(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make FIREBASE_* from .env.local available to the API handlers (server side only).
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [apiDevServer()] };
});
