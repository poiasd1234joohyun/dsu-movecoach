// 기록 서버(/api) 점검: 브라우저 없이 요청만 보내 본다.
// 실행: node tests/test_api.mjs                          → 파일 저장으로 점검
//       TEST_PG_URL=postgresql://… node tests/test_api.mjs → PostgreSQL 저장도 같은 순서로 점검
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
const root = fileURLToPath(new URL('..', import.meta.url));
let fails = 0; const check = (c, msg) => { console.log((c ? 'ok  : ' : 'FAIL: ') + msg); if (!c) fails++; };

async function startServer(env) {
  const port = 8900 + Math.floor(Math.random() * 900);
  const srv = spawn('node', ['server.js'], { cwd: root, env: Object.assign({}, process.env, { PORT: String(port) }, env), stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
  const base = `http://localhost:${port}/api`;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base + '?ping=1')).ok) break; } catch (e) { /* 아직 */ } await new Promise((r) => setTimeout(r, 100)); }
  return { srv, base, log: () => log, stop: () => new Promise((r) => { srv.on('exit', r); srv.kill('SIGTERM'); }) };
}
const get = async (base, q) => (await fetch(base + '?' + new URLSearchParams(q))).json();
const post = async (base, body) => (await fetch(base, { method: 'POST', body: JSON.stringify(body) })).json();
const rec = (roomId, name, score, extra = {}) => Object.assign({ type: 'record', roomId, mode: 'practice', course: '가상과목', title: '가상과제', name, studentId: '20260001', movement: 'squat', movementName: '스쿼트', kind: 'rep', count: 10, goal: 10, score, grade: 'B', topIssue: '상체 숙임', tiles: [['인정 횟수', '10']], items: [{ cols: ['1', '92°', '30°', '2.1초'], issues: ['상체 숙임'], score: 80 }], head: ['회차', '무릎각', '상체', '시간'], comment: '가상 코멘트', ts: new Date().toISOString(), device: 'test' }, extra);

async function suite(label, env) {
  console.log(`\n=== ${label} ===`);
  let S = await startServer(env); const { base } = S;
  const ping = await get(base, { ping: 1 }); check(ping.ok && ping.app === 'movecoach' && ping.store === (env.DATABASE_URL ? 'pg' : 'file'), `ping: 저장 방식 ${ping.store}${ping.note ? ' (' + ping.note + ')' : ''}`);
  // 방 만들기와 설정 읽기
  const mk = await post(base, { type: 'room_create', config: { mode: 'practice', course: '가상과목', title: '스쿼트', movement: 'squat', goal: 10, autoSend: true, pw: '비밀' } });
  check(mk.ok && /^[a-z2-9]{7}$/.test(mk.roomId) && mk.adminKey.length === 10 && !mk.roomId.startsWith('L'), `방 만들기: ${mk.roomId}`);
  const room = await get(base, { room: mk.roomId }); check(room.ok && room.config.course === '가상과목' && room.config.id === mk.roomId && room.config.pw === undefined, '방 설정을 읽는다(비밀번호는 돌려주지 않는다)');
  check((await get(base, { room: 'nope123' })).ok === false, '없는 방은 오류');
  check((await post(base, { type: 'room_create', config: { mode: 'hack' } })).ok === false, '방식이 이상한 방은 만들지 않는다');
  check((await post(base, { type: 'room_create', config: { mode: 'practice', notes: 'x'.repeat(50000) } })).ok === false, '너무 큰 설정은 받지 않는다');
  // 기록: 학생 세 명
  const r1 = await post(base, rec(mk.roomId, '가상학생1', 62)); const r2 = await post(base, rec(mk.roomId, '가상학생2', 91)); const r3 = await post(base, rec(mk.roomId, '<img src=x onerror=alert(1)>'.repeat(3), 500, { topIssue: 'x'.repeat(200), items: [{ cols: [{ a: 1 }, 'b'], issues: [{ label: '라벨' }], score: 'abc' }], count: '<b>', takeNo: '<i>', game: { avatar: '<script>alert(1)</script>', time: '1e3' } }));
  check(r1.ok && r2.ok && r3.ok && /^[A-Z2-9]{6}$/.test(r1.id), `기록 저장: 접수번호 ${r1.id}`);
  check((await post(base, rec(mk.roomId, '', 50))).ok === false, '이름 없는 기록은 받지 않는다');
  check((await post(base, rec('nope123', '가', 50))).ok === false, '없는 방에는 기록하지 않는다');
  check((await get(base, { list: 1, room: mk.roomId, k: 'wrong' })).ok === false, '교수 링크의 열쇠가 없으면 목록을 주지 않는다');
  const list = await get(base, { list: 1, room: mk.roomId, k: mk.adminKey }); check(list.ok && list.rows.length === 3 && list.rows[0].id === r3.id && list.rows[2].name === '가상학생1', '목록: 3건, 최근 것이 먼저');
  const bad = list.rows[0]; check(bad.score === 100 && bad.name.length === 30 && bad.topIssue.length === 40 && bad.count === 0 && bad.takeNo === 0 && bad.items[0].score === 0 && bad.items[0].issues[0] === '라벨' && bad.game.avatar.length === 8 && bad.game.time === 1000, '이상한 값은 길이·형식을 맞춰서만 저장한다');
  check(Array.isArray(list.rows[2].tiles) && list.rows[2].head.length === 4 && list.rows[2].items[0].cols[1] === '92°', '상세 항목이 그대로 돌아온다');
  // 답장
  check((await post(base, { type: 'reply', roomId: mk.roomId, adminKey: 'wrong', recordId: r1.id, reply: 'x' })).ok === false, '열쇠 없이 답장할 수 없다');
  check((await post(base, { type: 'reply', roomId: mk.roomId, adminKey: mk.adminKey, recordId: r1.id, reply: '무릎을 더 벌려 보세요' })).ok, '답장 저장');
  const mine = await get(base, { mine: 1, room: mk.roomId, code: r1.id.toLowerCase() }); check(mine.ok && mine.row.reply === '무릎을 더 벌려 보세요' && mine.row.score === 62 && mine.row.replyAt, '학생이 접수번호로 답장을 본다');
  check((await get(base, { board: 1, room: mk.roomId })).ok === false, '공개하지 않는 수업은 다른 학생 기록을 보여 주지 않는다');
  // 시험: 비밀번호와 점수 비공개
  const ex = await post(base, { type: 'room_create', config: { mode: 'exam', course: '가상과목', title: '중간 실기', movement: 'squat', pw: '1234', release: false } });
  const video = 'data:video/webm;codecs=vp8;base64,' + Buffer.from('가짜 영상 내용입니다 1234567890').toString('base64');
  const e1 = await post(base, rec(ex.roomId, '시험학생', 77, { mode: 'exam', video, takeNo: 2, takesTotal: 3 })); check(e1.ok && e1.hasVideo, '시험 기록과 영상 저장');
  check((await get(base, { list: 1, room: ex.roomId, k: ex.adminKey })).ok === false && (await get(base, { list: 1, room: ex.roomId, k: ex.adminKey, pw: '0000' })).ok === false, '시험 목록은 비밀번호가 맞아야 한다');
  const el = await get(base, { list: 1, room: ex.roomId, k: ex.adminKey, pw: '1234' }); check(el.ok && el.rows.length === 1 && el.rows[0].hasVideo && el.rows[0].takeNo === 2 && el.rows[0].takesTotal === 3 && el.rows[0].released === false, '시험 목록');
  let em = await get(base, { mine: 1, room: ex.roomId, code: e1.id }); check(em.ok && em.row.score === null && em.row.items.length === 0, '공개 전에는 학생에게 점수를 주지 않는다');
  await post(base, { type: 'reply', roomId: ex.roomId, adminKey: ex.adminKey, recordId: e1.id, reply: '잘했어요', released: true }); em = await get(base, { mine: 1, room: ex.roomId, code: e1.id }); check(em.row.score === 77 && em.row.reply === '잘했어요', '교수가 공개하면 점수가 보인다');
  let v = await fetch(base + '?' + new URLSearchParams({ room: ex.roomId, video: e1.id })); check(v.status === 403, '영상은 열쇠 없이 열리지 않는다'); await v.arrayBuffer();
  v = await fetch(base + '?' + new URLSearchParams({ room: ex.roomId, video: e1.id, k: ex.adminKey, pw: '0000' })); check(v.status === 403, '영상은 시험 비밀번호가 틀리면 열리지 않는다'); await v.arrayBuffer();
  v = await fetch(base + '?' + new URLSearchParams({ room: ex.roomId, video: e1.id, k: ex.adminKey, pw: '1234' })); const vb = Buffer.from(await v.arrayBuffer()); check(v.status === 200 && v.headers.get('content-type') === 'video/webm' && vb.toString() === '가짜 영상 내용입니다 1234567890', '영상이 그대로 돌아온다');
  check((await post(base, rec(ex.roomId, '가', 50, { video: 'data:text/html;base64,PGI+' }))).ok === false, '영상이 아닌 파일은 받지 않는다');
  // 게임·조별 공개: 순위판은 링크만 있으면 본다
  const gm = await post(base, { type: 'room_create', config: { mode: 'game', course: '가상과목', title: '스쿼트 시합', movement: 'squat', goal: 30, game: { kind: 'race', players: 1 } } });
  await post(base, rec(gm.roomId, '가상A', 100, { mode: 'game', kind: 'game', game: { kind: 'race', time: 41.2, result: '완주', avatar: '🐰' } })); await post(base, rec(gm.roomId, '가상B', 100, { mode: 'game', kind: 'game', game: { kind: 'race', time: 38.5, result: '완주', avatar: '🐻' } }));
  const bd = await get(base, { board: 1, room: gm.roomId }); check(bd.ok && bd.rows.length === 2 && bd.rows.some((r) => r.name === '가상B' && r.game.time === 38.5) && bd.rows[0].comment === undefined && bd.rows[0].studentId === undefined, '게임 순위판: 이름·기록만 공개(학번·코멘트 제외)');
  const op = await post(base, { type: 'room_create', config: { mode: 'practice', course: '3조', title: '조별 연습', movement: 'squat', open: true } }); await post(base, rec(op.roomId, '조원1', 88)); check((await get(base, { board: 1, room: op.roomId })).rows.length === 1, '조별 공개 수업은 서로의 기록을 본다');
  // 설정 고치기·시범 영상
  check((await post(base, { type: 'room_update', roomId: mk.roomId, adminKey: 'wrong', config: { mode: 'practice' } })).ok === false, '열쇠 없이 설정을 고칠 수 없다');
  await post(base, { type: 'room_update', roomId: mk.roomId, adminKey: mk.adminKey, config: { mode: 'exam', course: '바뀐과목', title: '스쿼트', movement: 'squat' } }); const up = await get(base, { room: mk.roomId }); check(up.config.course === '바뀐과목' && up.config.mode === 'practice', '설정을 고친다(방식은 바꿀 수 없다)');
  const dm = await post(base, { type: 'demo', roomId: mk.roomId, adminKey: mk.adminKey, video }); v = await fetch(base + dm.url); check(dm.ok && v.status === 200, '시범 영상은 학생도 본다'); await v.arrayBuffer();
  // 다시 켜도 남아 있는가
  await S.stop(); S = await startServer(env);
  const again = await get(S.base, { list: 1, room: mk.roomId, k: mk.adminKey }); check(again.ok && again.rows.length === 3 && again.rows[2].reply === '무릎을 더 벌려 보세요', '서버를 다시 켜도 방과 기록이 남아 있다');
  const p2 = await get(S.base, { ping: 1 }); check(p2.rooms >= 4 && p2.records >= 7, `전체 수: 방 ${p2.rooms}, 기록 ${p2.records}`);
  // 형식이 깨진 요청
  const br = await fetch(S.base, { method: 'POST', body: '{깨진' }); check(br.status === 400, '깨진 요청은 400'); await br.text();
  const pre = await fetch(S.base, { method: 'OPTIONS' }); check(pre.status === 204 && pre.headers.get('access-control-allow-origin') === '*', '다른 주소(예: GitHub Pages)의 화면에서도 부를 수 있다'); await pre.text();
  await S.stop();
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-data-'));
await suite('파일 저장', { DATA_DIR: tmp, DATABASE_URL: '' });
check(fs.existsSync(path.join(tmp, 'rooms.json')) && fs.readdirSync(path.join(tmp, 'videos')).length >= 1, '파일 저장: data 폴더에 파일이 생긴다');
if (process.env.TEST_PG_URL) await suite('PostgreSQL 저장', { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'mc-data-')), DATABASE_URL: process.env.TEST_PG_URL });
else console.log('\n(PostgreSQL 점검은 건너뜀: TEST_PG_URL 이 없음)');
{ // 데이터베이스 주소가 틀려도 서비스는 켜져야 한다
  const S = await startServer({ DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'mc-data-')), DATABASE_URL: 'postgresql://nobody@127.0.0.1:1/none' }); const p = await get(S.base, { ping: 1 }); check(p.ok && p.store === 'file' && /연결 실패/.test(p.note || ''), '데이터베이스에 못 붙으면 파일 저장으로 대신 켜진다'); await S.stop();
}
console.log(fails ? `\n${fails} FAIL(S)` : '\nALL OK');
process.exit(fails ? 1 : 0);
