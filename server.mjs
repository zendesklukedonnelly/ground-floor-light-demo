import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const token = process.env.COMMAND_TOKEN || '';
const clients = new Set();
const roomState = { livingroom: false, kitchen: false, bathroom: false };
const valid = new Set([
  'livingroomlighton', 'livingroomlightoff',
  'kitchenlighton', 'kitchenlightoff',
  'bathroomlighton', 'bathroomlightoff',
]);

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/') {
    try {
      const page = await readFile(path.join(here, 'index.html'));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(page);
    } catch {
      res.writeHead(500); res.end('Unable to load the floor plan.');
    }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/ground-floor-render.png') {
    try {
      const image = await readFile(path.join(here, 'ground-floor-render.png'));
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' });
      res.end(image);
    } catch {
      res.writeHead(500); res.end('Unable to load the floor-plan render.');
    }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/state') {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    res.end(JSON.stringify(roomState));
    return;
  }
  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive', 'access-control-allow-origin': '*',
    });
    res.write('event: ready\ndata: {}\n\n');
    clients.add(res);
    // Reconcile this page with the latest state if it connected late or reconnected.
    for (const [room, on] of Object.entries(roomState)) {
      const command = `${room}light${on ? 'on' : 'off'}`;
      res.write(`event: command\ndata: ${JSON.stringify({ command })}\n\n`);
    }
    const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 20000);
    req.on('close', () => { clearInterval(heartbeat); clients.delete(res); });
    return;
  }
  if (req.method === 'OPTIONS' && url.pathname === '/command') {
    res.writeHead(204, {
      'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    });
    res.end(); return;
  }
  if (req.method === 'POST' && url.pathname === '/command') {
    if (token && req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
      res.end(JSON.stringify({ error: 'Unauthorized' })); return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 8192) req.destroy(); });
    req.on('end', () => {
      let command;
      try { command = JSON.parse(body).command; } catch {
        res.writeHead(400, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
        res.end(JSON.stringify({ error: 'Expected JSON: {"command":"..."}' })); return;
      }
      if (!valid.has(command)) {
        res.writeHead(400, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
        res.end(JSON.stringify({ error: 'Unknown command', accepted: [...valid] })); return;
      }
      const [, room, state] = command.match(/^(livingroom|kitchen|bathroom)light(on|off)$/);
      roomState[room] = state === 'on';
      const payload = `event: command\ndata: ${JSON.stringify({ command })}\n\n`;
      for (const client of clients) client.write(payload);
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
      res.end(JSON.stringify({ ok: true, command, viewers: clients.size }));
    });
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Ground floor demo listening on http://localhost:${port}`);
  if (!token) console.log('COMMAND_TOKEN is unset; set it before exposing this server to the internet.');
});
