/* DSU 무브코치 — 작은 웹 서버 + 기록 서버 (Node 18 이상)
 * 하는 일 ① index.html 과 vendor/, media/ 폴더를 내보낸다(그 밖의 파일은 내보내지 않는다).
 *        ② /api : 수업 링크(방)와 제출 기록을 저장·조회한다 → 학생 폰에서 낸 기록이 교수 화면에 모인다.
 * 실행: node server.js   → http://localhost:8000
 * 저장: 환경 변수 DATABASE_URL 이 있고 pg 부품이 설치돼 있으면 PostgreSQL, 아니면 data/ 폴더의 파일.
 *       (파일 저장은 서버를 새로 올리면 지워질 수 있다. 오래 보관하려면 PostgreSQL 을 쓴다.)
 * 외부 AI·외부 서버를 부르는 코드는 없다.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT || '8000', 10);
const HOST = '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const PUBLIC_DIRS = ['vendor', 'media'];          // 이 폴더 아래만 공개
const MAX_BODY = 28 * 1024 * 1024;                // 요청 한 번의 최대 크기(시험 영상 20MB + 여유)
const MAX_VIDEO = 21 * 1024 * 1024;
const MAX_ROOMS = 20000, MAX_RECORDS_PER_ROOM = 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm',
  '.task': 'application/octet-stream', '.tflite': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};
const SQUEEZE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.wasm', '.svg', '.txt']); // 줄여서 보내면 폰에서 빨리 열리는 종류
const squeezed = new Map();                        // 한 번 줄인 결과는 기억해 둔다 (경로 → {mtimeMs, buf})

/* ====================== 저장소 ====================== */
const rid = (n, chars = 'abcdefghjkmnpqrstuvwxyz23456789') => { const b = crypto.randomBytes(n); let s = ''; for (let i = 0; i < n; i++) s += chars[b[i] % chars.length]; return s; };

/** 파일 저장소: 메모리에 두고 data/ 폴더에 주기적으로 적는다. */
class FileStore {
  constructor(dir) { this.kind = 'file'; this.dir = dir; this.rooms = new Map(); this.records = new Map(); this.timer = null; }
  async init() {
    fs.mkdirSync(path.join(this.dir, 'videos'), { recursive: true });
    try { for (const r of JSON.parse(fs.readFileSync(path.join(this.dir, 'rooms.json'), 'utf8'))) this.rooms.set(r.id, r); } catch (e) { /* 처음 실행 */ }
    try { for (const [id, list] of JSON.parse(fs.readFileSync(path.join(this.dir, 'records.json'), 'utf8'))) this.records.set(id, list); } catch (e) { /* 처음 실행 */ }
  }
  save() { if (this.timer) return; this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 400); }
  flush() { for (const [name, data] of [['rooms.json', [...this.rooms.values()]], ['records.json', [...this.records.entries()]]]) { try { const tmp = path.join(this.dir, name + '.tmp'); fs.writeFileSync(tmp, JSON.stringify(data)); fs.renameSync(tmp, path.join(this.dir, name)); } catch (e) { console.error('저장 실패', name, e.message); } } }
  async createRoom(r) { this.rooms.set(r.id, r); this.save(); }
  async getRoom(id) { return this.rooms.get(id) || null; }
  async updateRoomCfg(id, cfg) { const r = this.rooms.get(id); if (r) { r.cfg = cfg; this.save(); } }
  async countRooms() { return this.rooms.size; }
  async countRecords(roomId) { if (roomId) return (this.records.get(roomId) || []).length; let n = 0; for (const l of this.records.values()) n += l.length; return n; }
  async addRecord(rec) { const l = this.records.get(rec.roomId) || []; l.push(rec); this.records.set(rec.roomId, l); this.save(); }
  async listRecords(roomId) { return (this.records.get(roomId) || []).slice().reverse(); }
  async getRecord(roomId, id) { return (this.records.get(roomId) || []).find((r) => r.id === id) || null; }
  async setReply(roomId, id, reply, released) { const r = await this.getRecord(roomId, id); if (!r) return false; r.reply = reply; r.replyAt = new Date().toISOString(); if (released != null) r.released = !!released; this.save(); return true; }
  vfile(roomId, id) { return path.join(this.dir, 'videos', `${roomId}_${id}.bin`); }
  async putVideo(roomId, id, buf) { fs.writeFileSync(this.vfile(roomId, id), buf); }
  async getVideo(roomId, id) { try { return fs.readFileSync(this.vfile(roomId, id)); } catch (e) { return null; } }
}

/** PostgreSQL 저장소 */
class PgStore {
  constructor(pool) { this.kind = 'pg'; this.pool = pool; }
  async init() {
    await this.pool.query(`create table if not exists mc_rooms (id text primary key, key text not null, pw text not null default '', cfg jsonb not null, created_at timestamptz not null default now())`);
    await this.pool.query(`create table if not exists mc_records (room_id text not null, id text not null, ts timestamptz not null default now(), data jsonb not null, reply text not null default '', reply_at timestamptz, released boolean not null default false, has_video boolean not null default false, video_mime text, primary key (room_id, id))`);
    await this.pool.query(`create table if not exists mc_videos (room_id text not null, rec_id text not null, bytes bytea not null, primary key (room_id, rec_id))`);
    await this.pool.query(`create index if not exists mc_records_room_ts on mc_records (room_id, ts desc)`);
  }
  async createRoom(r) { await this.pool.query('insert into mc_rooms (id, key, pw, cfg) values ($1,$2,$3,$4)', [r.id, r.key, r.pw, JSON.stringify(r.cfg)]); }
  async getRoom(id) { const q = await this.pool.query('select id, key, pw, cfg, created_at from mc_rooms where id=$1', [id]); const r = q.rows[0]; return r ? { id: r.id, key: r.key, pw: r.pw, cfg: r.cfg, createdAt: r.created_at.toISOString() } : null; }
  async updateRoomCfg(id, cfg) { await this.pool.query('update mc_rooms set cfg=$2 where id=$1', [id, JSON.stringify(cfg)]); }
  async countRooms() { return +(await this.pool.query('select count(*)::int as n from mc_rooms')).rows[0].n; }
  async countRecords(roomId) { const q = roomId ? await this.pool.query('select count(*)::int as n from mc_records where room_id=$1', [roomId]) : await this.pool.query('select count(*)::int as n from mc_records'); return +q.rows[0].n; }
  row(r) { return { roomId: r.room_id, id: r.id, ts: r.ts.toISOString(), data: r.data, reply: r.reply, replyAt: r.reply_at ? r.reply_at.toISOString() : '', released: r.released, hasVideo: r.has_video, videoMime: r.video_mime || '' }; }
  async addRecord(rec) { await this.pool.query('insert into mc_records (room_id, id, ts, data, released, has_video, video_mime) values ($1,$2,$3,$4,$5,$6,$7)', [rec.roomId, rec.id, rec.ts, JSON.stringify(rec.data), !!rec.released, !!rec.hasVideo, rec.videoMime || null]); }
  async listRecords(roomId) { const q = await this.pool.query('select * from mc_records where room_id=$1 order by ts desc limit $2', [roomId, MAX_RECORDS_PER_ROOM]); return q.rows.map((r) => this.row(r)); }
  async getRecord(roomId, id) { const q = await this.pool.query('select * from mc_records where room_id=$1 and id=$2', [roomId, id]); return q.rows[0] ? this.row(q.rows[0]) : null; }
  async setReply(roomId, id, reply, released) { const q = released == null ? await this.pool.query('update mc_records set reply=$3, reply_at=now() where room_id=$1 and id=$2', [roomId, id, reply]) : await this.pool.query('update mc_records set reply=$3, reply_at=now(), released=$4 where room_id=$1 and id=$2', [roomId, id, reply, !!released]); return q.rowCount > 0; }
  async putVideo(roomId, id, buf) { await this.pool.query('insert into mc_videos (room_id, rec_id, bytes) values ($1,$2,$3) on conflict (room_id, rec_id) do update set bytes=excluded.bytes', [roomId, id, buf]); }
  async getVideo(roomId, id) { const q = await this.pool.query('select bytes from mc_videos where room_id=$1 and rec_id=$2', [roomId, id]); return q.rows[0] ? q.rows[0].bytes : null; }
}

let store = null, storeNote = '';
async function openStore() {
  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : undefined });
      const s = new PgStore(pool); await s.init(); return s;
    } catch (e) { storeNote = 'PostgreSQL 연결 실패 → 파일 저장으로 대신함: ' + e.message; console.error(storeNote); }
  }
  const s = new FileStore(DATA_DIR); await s.init(); return s;
}

/* ====================== 기록 서버 (/api) ====================== */
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const MODES = new Set(['practice', 'assignment', 'exam', 'game']);
/** 학생 기기에서 온 기록은 그대로 믿지 않는다: 아는 항목만, 정해진 길이·형식으로 받는다. */
function cleanRecord(d) {
  const tiles = Array.isArray(d.tiles) ? d.tiles.slice(0, 8).map((t) => [str(t && t[0], 40), str(t && t[1], 80)]) : [];
  const items = Array.isArray(d.items) ? d.items.slice(0, 120).map((it) => ({ cols: Array.isArray(it && it.cols) ? it.cols.slice(0, 6).map((c) => str(c, 60)) : [], issues: Array.isArray(it && it.issues) ? it.issues.slice(0, 4).map((x) => str(typeof x === 'string' ? x : (x && x.label), 40)) : [], score: (it && it.score != null) ? num(it.score) : null })) : [];
  let game = null; if (d.game && typeof d.game === 'object') { const g = d.game; game = { kind: str(g.kind, 12), players: num(g.players) || 1, time: g.time == null ? null : num(g.time), result: str(g.result, 60), avatar: str(g.avatar, 8), winner: g.winner == null ? null : num(g.winner), valid: num(g.valid), invalid: num(g.invalid), combo: num(g.combo) }; }
  return { mode: MODES.has(d.mode) ? d.mode : 'practice', course: str(d.course, 60), title: str(d.title, 80), name: str(d.name, 30), studentId: str(d.studentId, 20), movement: str(d.movement, 24), movementName: str(d.movementName, 50), kind: str(d.kind, 12), count: num(d.count), goal: num(d.goal), score: Math.max(0, Math.min(100, Math.round(num(d.score)))), grade: str(d.grade, 16), topIssue: str(d.topIssue, 40), tiles, items, head: Array.isArray(d.head) ? d.head.slice(0, 6).map((h) => str(h, 30)) : null, comment: str(d.comment, 1500), takeNo: num(d.takeNo), takesTotal: num(d.takesTotal), device: str(d.device, 80), clientTs: str(d.ts, 40), game };
}
const rowOut = (rec) => Object.assign({}, rec.data, { roomId: rec.roomId, id: rec.id, ts: rec.ts, reply: rec.reply || '', replyAt: rec.replyAt || '', released: !!rec.released, hasVideo: !!rec.hasVideo });
function parseVideo(dataUrl) { const m = /^data:(video\/[a-z0-9.+-]+)[^,]*;base64,(.+)$/i.exec(String(dataUrl || '')); if (!m) return null; const buf = Buffer.from(m[2], 'base64'); if (!buf.length || buf.length > MAX_VIDEO) return null; return { mime: m[1].toLowerCase(), buf }; }

const buckets = new Map(); // 같은 곳에서 너무 많이 부르면 잠깐 막는다(분당 300번, 방 만들기는 시간당 60번)
function limited(ip, kind, max, perMs) { const k = kind + ip, now = Date.now(); let b = buckets.get(k); if (!b || now - b.t > perMs) { b = { t: now, n: 0 }; buckets.set(k, b); } b.n++; if (buckets.size > 50000) buckets.clear(); return b.n > max; }

async function apiGet(q, ip) {
  if (q.get('ping')) return { ok: true, app: 'movecoach', store: store.kind, note: storeNote || undefined, rooms: await store.countRooms(), records: await store.countRecords() };
  const roomId = str(q.get('room'), 16); const room = roomId ? await store.getRoom(roomId) : null;
  if (!room) return { ok: false, error: '수업 링크를 찾을 수 없습니다' };
  const isAdmin = () => room.key === String(q.get('k') || '');
  const pwOk = () => !(room.cfg.mode === 'exam' && room.pw) || String(q.get('pw') || '') === room.pw;
  if (q.get('list')) { if (!isAdmin()) return { ok: false, error: '권한 없음' }; if (!pwOk()) return { ok: false, error: '비밀번호가 다릅니다' }; return { ok: true, rows: (await store.listRecords(roomId)).map(rowOut) }; }
  if (q.get('mine')) { const rec = await store.getRecord(roomId, str(q.get('code'), 12).toUpperCase()); if (!rec) return { ok: false, error: '접수번호 없음' }; const o = rowOut(rec); if (o.mode === 'exam' && !o.released) { o.score = null; o.tiles = []; o.items = []; o.comment = ''; o.topIssue = ''; } return { ok: true, row: o }; }
  if (q.get('board')) { // 게임 순위·조별 공개 기록: 링크를 가진 사람은 누구나 본다(이름·점수·주요 문제만)
    if (!(room.cfg.mode === 'game' || room.cfg.open)) return { ok: false, error: '공개하지 않는 수업입니다' };
    return { ok: true, rows: (await store.listRecords(roomId)).map((r) => ({ id: r.id, ts: r.ts, name: r.data.name, score: r.data.score, count: r.data.count, kind: r.data.kind, movementName: r.data.movementName, topIssue: r.data.topIssue, mode: r.data.mode, game: r.data.game })) }; }
  const cfg = Object.assign({}, room.cfg, { id: room.id, hasPw: !!room.pw }); return { ok: true, config: cfg };
}
async function apiVideo(q, res) { // 제출 영상: 교수 링크(+시험 비밀번호)가 있어야 열린다. 시범 영상(__demo)은 학생도 본다.
  const roomId = str(q.get('room'), 16), id = str(q.get('video'), 12); const room = await store.getRoom(roomId); if (!room) return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain' });
  let mime = 'video/webm';
  if (id === '__demo') mime = room.cfg.demoMime || mime;
  else { if (room.key !== String(q.get('k') || '') || ((room.cfg.mode === 'exam' && room.pw) && String(q.get('pw') || '') !== room.pw)) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' }); const rec = await store.getRecord(roomId, id); if (!rec || !rec.hasVideo) return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain' }); mime = rec.videoMime || mime; }
  const buf = await store.getVideo(roomId, id); if (!buf) return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain' });
  send(res, 200, buf, { 'Content-Type': mime, 'Content-Length': buf.length, 'Cache-Control': 'private, max-age=600', 'Access-Control-Allow-Origin': '*' });
}
async function apiPost(d, ip) {
  const t = d.type;
  if (t === 'room_create') {
    if (limited(ip, 'mk', 60, 3600000)) return { ok: false, error: '잠시 뒤에 다시 만들어 주세요' };
    const cfg = d.config; if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return { ok: false, error: '설정이 없습니다' };
    if (!MODES.has(cfg.mode)) return { ok: false, error: '방식이 올바르지 않습니다' };
    const pw = str(cfg.pw, 40); delete cfg.pw; delete cfg.id; if (JSON.stringify(cfg).length > 40000) return { ok: false, error: '설정이 너무 큽니다' };
    if (await store.countRooms() >= MAX_ROOMS) return { ok: false, error: '수업 링크가 너무 많습니다' };
    const id = rid(7), key = rid(10); await store.createRoom({ id, key, pw, cfg, createdAt: new Date().toISOString() }); return { ok: true, roomId: id, adminKey: key };
  }
  const room = await store.getRoom(str(d.roomId, 16)); if (!room) return { ok: false, error: '수업 링크를 찾을 수 없습니다' };
  const admin = room.key === String(d.adminKey || '');
  if (t === 'room_update') { if (!admin) return { ok: false, error: '권한 없음' }; const cfg = d.config; if (!cfg || typeof cfg !== 'object' || JSON.stringify(cfg).length > 40000) return { ok: false, error: '설정이 올바르지 않습니다' }; delete cfg.pw; delete cfg.id; cfg.mode = room.cfg.mode; await store.updateRoomCfg(room.id, cfg); return { ok: true }; }
  if (t === 'demo') { if (!admin) return { ok: false, error: '권한 없음' }; const v = parseVideo(d.video); if (!v) return { ok: false, error: '영상을 읽을 수 없습니다' }; await store.putVideo(room.id, '__demo', v.buf); await store.updateRoomCfg(room.id, Object.assign({}, room.cfg, { demoMime: v.mime })); return { ok: true, url: `?room=${room.id}&video=__demo` }; }
  if (t === 'record') {
    if (await store.countRecords(room.id) >= MAX_RECORDS_PER_ROOM) return { ok: false, error: '이 수업의 기록이 가득 찼습니다' };
    const data = cleanRecord(d); if (!data.name) return { ok: false, error: '이름이 없습니다' };
    const v = d.video ? parseVideo(d.video) : null; if (d.video && !v) return { ok: false, error: '영상이 너무 크거나 형식이 맞지 않습니다(20MB 이하)' };
    const id = rid(6, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789');
    if (v) await store.putVideo(room.id, id, v.buf);
    await store.addRecord({ roomId: room.id, id, ts: new Date().toISOString(), data, reply: '', replyAt: '', released: !!room.cfg.release, hasVideo: !!v, videoMime: v ? v.mime : '' });
    return { ok: true, id, hasVideo: !!v };
  }
  if (t === 'reply') { if (!admin) return { ok: false, error: '권한 없음' }; const ok = await store.setReply(room.id, str(d.recordId, 12), str(d.reply, 2000), d.released == null ? null : !!d.released); return ok ? { ok: true } : { ok: false, error: '기록 없음' }; }
  return { ok: false, error: '알 수 없는 요청' };
}
function readBody(req) { return new Promise((resolve, reject) => { const chunks = []; let size = 0; req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); return; } chunks.push(c); }); req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8'))); req.on('error', reject); }); }
const API_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff' };
async function handleApi(req, res, url) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const json = (o, code = 200) => { res.writeHead(code, API_HEADERS); res.end(JSON.stringify(o)); };
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' }); return res.end(); }
    if (limited(ip, 'all', 300, 60000)) return json({ ok: false, error: '요청이 너무 많습니다. 잠시 뒤에 다시 해 주세요' }, 429);
    if (req.method === 'GET') { if (url.searchParams.get('video')) return await apiVideo(url.searchParams, res); return json(await apiGet(url.searchParams, ip)); }
    if (req.method === 'POST') { let d; try { d = JSON.parse(await readBody(req)); } catch (e) { return json({ ok: false, error: e.message === 'too large' ? '보내는 내용이 너무 큽니다' : '형식이 올바르지 않습니다' }, 400); } if (!d || typeof d !== 'object') return json({ ok: false, error: '형식이 올바르지 않습니다' }, 400); return json(await apiPost(d, ip)); }
    return json({ ok: false, error: 'Method Not Allowed' }, 405);
  } catch (e) { console.error('api 오류', e); if (!res.headersSent) json({ ok: false, error: '서버 오류' }, 500); else res.end(); }
}

/* ====================== 파일 내보내기 ====================== */
function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({ 'X-Content-Type-Options': 'nosniff' }, headers || {}));
  res.end(body);
}
function resolvePublic(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0]); } catch (e) { return null; }
  if (p === '/' || p === '/index.html') return path.join(ROOT, 'index.html');
  const parts = p.split('/').filter(Boolean);
  if (!parts.length || !PUBLIC_DIRS.includes(parts[0])) return null;
  if (parts.some((s) => s === '..' || s.startsWith('.'))) return null;
  const full = path.join(ROOT, ...parts);
  return full.startsWith(path.join(ROOT, parts[0]) + path.sep) ? full : null;
}
function gzipOf(file, st, cb) {
  const hit = squeezed.get(file);
  if (hit && hit.mtimeMs === st.mtimeMs) return cb(null, hit.buf);
  fs.readFile(file, (err, raw) => {
    if (err) return cb(err);
    zlib.gzip(raw, { level: 6 }, (e2, buf) => { if (e2) return cb(e2); squeezed.set(file, { mtimeMs: st.mtimeMs, buf }); cb(null, buf); });
  });
}
function serveFile(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', { 'Content-Type': 'text/plain' });
  const file = resolvePublic(req.url);
  if (!file) return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain' });
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain' });
    const ext = path.extname(file).toLowerCase();
    const headers = {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      // 화면 파일은 항상 새로 확인, 큰 부품 파일은 하루 동안 기기에 보관
      'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=86400',
      'Last-Modified': st.mtime.toUTCString(),
      'Vary': 'Accept-Encoding',
      'X-Content-Type-Options': 'nosniff',
    };
    const since = req.headers['if-modified-since'];
    if (since && new Date(since).getTime() >= Math.floor(st.mtimeMs / 1000) * 1000) { res.writeHead(304, headers); return res.end(); }
    const wantsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '') && SQUEEZE.has(ext) && st.size > 1024 && !req.headers.range;
    if (wantsGzip) {
      return gzipOf(file, st, (e, buf) => {
        if (e) return send(res, 500, 'Server Error', { 'Content-Type': 'text/plain' });
        res.writeHead(200, Object.assign(headers, { 'Content-Encoding': 'gzip', 'Content-Length': buf.length }));
        res.end(req.method === 'HEAD' ? undefined : buf);
      });
    }
    // 영상(mp4)은 아이폰이 "일부분만" 달라고 요청한다 → Range 요청을 지원
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      const start = m[1] ? parseInt(m[1], 10) : Math.max(0, st.size - parseInt(m[2], 10));
      const end = m[1] && m[2] ? Math.min(parseInt(m[2], 10), st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) return send(res, 416, '', { 'Content-Range': `bytes */${st.size}` });
      res.writeHead(206, Object.assign(headers, { 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 }));
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
    }
    res.writeHead(200, Object.assign(headers, { 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  if (p === '/healthz') return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });
  if (p === '/api') return handleApi(req, res, new URL(req.url, 'http://x'));
  serveFile(req, res);
});
openStore().then((s) => {
  store = s;
  server.listen(PORT, HOST, () => console.log(`DSU 무브코치: http://localhost:${PORT} (기록 저장: ${store.kind === 'pg' ? 'PostgreSQL' : '파일 ' + DATA_DIR})`));
}).catch((e) => { console.error('시작 실패', e); process.exit(1); });
process.on('SIGTERM', () => { try { if (store && store.flush) store.flush(); } catch (e) { /* 끝내는 중 */ } process.exit(0); });
process.on('SIGINT', () => { try { if (store && store.flush) store.flush(); } catch (e) { /* 끝내는 중 */ } process.exit(0); });
