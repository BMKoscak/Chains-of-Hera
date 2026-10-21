// Local static server for Chains of Hera: serves the project folder and opens the game fullscreen.
// Run via "Play Chains of Hera.bat" (or: node scripts/serve.mjs). Close the console window to stop it.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8137;
const PAGE = 'index_7_1.html';
const URL_ = `http://localhost:${PORT}/${PAGE}`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.css': 'text/css' };

// Own browser profile: the fullscreen flag always applies (even if the browser is already open), and saves live here
function openBrowser() {
  if (process.env.HERA_NO_BROWSER) return;
  const local = process.env.LOCALAPPDATA || '';
  const candidates = [
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(local, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe'),
  ];
  const exe = candidates.find(p => fs.existsSync(p));
  if (!exe) {
    console.log(`No Chrome or Edge found. Open ${URL_} yourself and press F11.`);
    spawn('cmd', ['/c', 'start', '', URL_], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  const profile = path.join(local || ROOT, 'ChainsOfHera', 'browser-profile');
  spawn(exe, [`--user-data-dir=${profile}`, '--start-fullscreen', '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required', `--app=${URL_}`], { detached: true, stdio: 'ignore' }).unref();
}

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || PAGE;
  const file = path.resolve(ROOT, rel);
  // stay inside the project folder, and never serve secrets or dependencies
  if (!file.startsWith(ROOT + path.sep) || /(^|[\\/])(\.env|\.git|node_modules)/.test(path.relative(ROOT, file))) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.log('Server already running - opening the game.'); openBrowser(); setTimeout(() => process.exit(0), 500); }
  else { console.error(e); process.exit(1); }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Chains of Hera running at ${URL_}`);
  console.log('Press F11 to leave fullscreen. Close this window to stop the server.');
  openBrowser();
});
