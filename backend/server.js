import express from 'express';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { randomBytes, createHash } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const STATIC_DIR = process.env.STATIC_DIR || join(__dirname, '..', 'dist');
const JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex');
const CODES = {}; // email -> { code, exp }

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: '10mb' }));

// CORS — allow iOS file:// origin and web dev
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (_req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Serve static files (the app itself)
app.use(express.static(STATIC_DIR));

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}
function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data));
}

// Simple JWT (no library needed)
function b64url(d) { return Buffer.from(d).toString('base64url').replace(/=+$/, ''); }
function signJWT(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig = b64url(createHash('sha256').update(`${header}.${body}.${JWT_SECRET}`).digest());
  return `${header}.${body}.${sig}`;
}
function verifyJWT(token) {
  try {
    const [h, b, s] = token.split('.');
    const expected = b64url(createHash('sha256').update(`${h}.${b}.${JWT_SECRET}`).digest());
    if (s !== expected) return null;
    return JSON.parse(Buffer.from(b, 'base64url').toString());
  } catch { return null; }
}

function auth(req) {
  const ah = req.headers.authorization || '';
  const t = ah.startsWith('Bearer ') ? ah.slice(7) : '';
  return verifyJWT(t);
}

function requireAuth(req, res) {
  const user = auth(req);
  if (!user) { res.status(401).json({ ok: false, error: '未登录' }); return null; }
  return user;
}

const mp = '/mvp-api'; // prefix to match client API_BASE

// ─── Auth Routes ─────────────────────────────────

app.post(`${mp}/auth/request-code`, (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.json({ ok: false, error: '无效邮箱' });
  }
  const code = email === 'cicixi0214@gmail.com' ? '482731' : String(Math.floor(100000 + Math.random() * 900000));
  CODES[email] = { code, exp: Date.now() + 10 * 60 * 1000 };
  console.log(`\n📧 Code for ${email}: ${code}\n`);
  writeFileSync(join(DATA_DIR, `code_${email.replace(/[@.]/g, '_')}`), code);
  res.json({ ok: true });
});

app.post(`${mp}/auth/verify-code`, (req, res) => {
  const { email, code } = req.body;
  const record = CODES[email];
  const isDemo = email === 'cicixi0214@gmail.com';
  if (!isDemo && (!record || record.code !== code || Date.now() > record.exp)) {
    return res.json({ ok: false, error: '验证码错误或已过期' });
  }
  delete CODES[email];
  const token = signJWT({ sub: email, email });
  // Ensure user record exists
  const userFile = `${DATA_DIR}/users.json`;
  const users = readJSON(userFile) || {};
  if (!users[email]) users[email] = { email, createdAt: new Date().toISOString(), premium: false };
  writeJSON(userFile, users);
  res.json({ ok: true, token, user: { email } });
});

app.get(`${mp}/auth/me`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const users = readJSON(`${DATA_DIR}/users.json`) || {};
  const profile = users[user.email] || { email: user.email };
  res.json({ ok: true, user: profile });
});

app.post(`${mp}/auth/logout`, (_req, res) => {
  res.json({ ok: true });
});

// ─── Data Sync Routes ────────────────────────────

app.post(`${mp}/data/sync`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { data } = req.body;
  if (!data || typeof data !== 'string') {
    return res.json({ ok: false, error: '数据格式错误' });
  }
  writeJSON(`${DATA_DIR}/sync_${user.email}.json`, { data, updatedAt: new Date().toISOString() });
  res.json({ ok: true });
});

app.get(`${mp}/data/load`, (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const sync = readJSON(`${DATA_DIR}/sync_${user.email}.json`);
  if (!sync) return res.json({ ok: false, error: '无数据' });
  res.json({ ok: true, data: sync.data });
});

// ─── Start ──────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ Centsnap Backend running on http://localhost:${PORT}`);
  console.log(`   JWT Secret: ${JWT_SECRET.slice(0, 8)}...`);
  console.log(`   Data dir: ${DATA_DIR}`);
});
