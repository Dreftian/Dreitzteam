/**
 * Tiny local SSE server on 127.0.0.1:9090 that streams Dreitz events.
 * Useful for OBS browser-source overlays during streams: "Carlos compró Elden Ring" etc.
 *
 * Endpoints:
 *   GET /         → status JSON
 *   GET /events   → text/event-stream (live feed)
 *
 * Bound to localhost only — no external access.
 */
import http from 'node:http';
import { BrowserWindow } from 'electron';
import { getDb } from './db';
import log from './logger';

const PORT = 9090;
let server: http.Server | null = null;
const clients = new Set<http.ServerResponse>();

export function startLocalApi() {
  if (server) return;
  server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url?.startsWith('/events')) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });
      res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, server: 'dreitz' })}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (req.url === '/' || req.url === '/status') {
      const db = getDb();
      const summary = {
        server: 'dreitz',
        version: '1.0.0',
        users: (db.prepare('SELECT COUNT(*) as c FROM users WHERE role="user"').get() as any).c,
        games: (db.prepare('SELECT COUNT(*) as c FROM games WHERE is_active=1').get() as any).c,
        clients: clients.size
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(summary, null, 2));
      return;
    }
    if (req.url === '/recent') {
      const recent = getDb().prepare(`
        SELECT a.kind, a.target_label, a.created_at, u.username FROM activity_feed a
        JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC LIMIT 20
      `).all();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(recent));
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });
  server.listen(PORT, '127.0.0.1', () => {
    log.info(`Local API listening at http://127.0.0.1:${PORT}`);
    relayActivityToBrowser();
  });
  server.on('error', (err: any) => {
    log.warn('Local API failed to start (port maybe in use):', err.message);
    server = null;
  });
}

export function stopLocalApi() {
  if (!server) return;
  for (const c of clients) try { c.end(); } catch {}
  clients.clear();
  server.close();
  server = null;
}

export function broadcast(eventName: string, payload: any) {
  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const c of clients) {
    try { c.write(data); } catch { clients.delete(c); }
  }
}

let lastSeenId = 0;
function relayActivityToBrowser() {
  setInterval(() => {
    try {
      const rows = getDb().prepare(`
        SELECT a.id, a.kind, a.target_label, a.created_at, u.username FROM activity_feed a
        JOIN users u ON u.id = a.user_id
        WHERE a.id > ? ORDER BY a.id ASC LIMIT 20
      `).all(lastSeenId) as any[];
      for (const r of rows) {
        broadcast('activity', r);
        lastSeenId = Math.max(lastSeenId, r.id);
        // Also forward to main window
        for (const w of BrowserWindow.getAllWindows()) {
          if (!w.isDestroyed()) w.webContents.send('activity:new', r);
        }
      }
    } catch {}
  }, 5000);
}
