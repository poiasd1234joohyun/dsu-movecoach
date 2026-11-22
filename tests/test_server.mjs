// 인터넷 주소에 올린 것과 같은 조건(server.js + http)에서 점검한다. 바깥 인터넷은 모두 막는다.
// 핵심: ① 화면과 자세 인식 파일이 우리 서버만으로 뜨는가 ② 서로 다른 기기(브라우저 창)의 기록이 한곳에 모이는가
// 실행: node tests/test_server.mjs [사람이 찍힌 사진 경로]   (모델 파일이 있고 사진을 주면 실제 인식까지 확인)
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
const root = fileURLToPath(new URL('..', import.meta.url));
const port = 8100 + Math.floor(Math.random() * 700);
const base = `http://localhost:${port}/`;
const srv = spawn('node', ['server.js'], { cwd: root, env: Object.assign({}, process.env, { PORT: String(port), DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'mc-ui-')), DATABASE_URL: process.env.TEST_PG_URL || '' }), stdio: 'ignore' });
let fails = 0; const check = (c, msg) => { console.log((c ? 'ok  : ' : 'FAIL: ') + msg); if (!c) fails++; };
const head = async (p, h = {}) => { const r = await fetch(base + p, { headers: h }); const b = await r.arrayBuffer(); return { status: r.status, type: r.headers.get('content-type') || '', len: b.byteLength }; };
const FAKE = `(()=>{ const t0=performance.now(); const m=window.__movecoach; m.useFakeLandmarker(()=>{ const el=(performance.now()-t0)/1000; const g=window.__fakeGen; return g? [g(el)] : [m.squatScript([],{})(0)]; }); })();`;
const squatLoop = (down, up) => `(()=>{ const m=window.__movecoach; const sc=m.squatScript([{bottom:88,trunk:32,down:${down},hold:.15,up:${up},rest:.25},{bottom:90,trunk:33,down:${down},hold:.15,up:${up},rest:.25}],{lead:0.2,ar:16/9}); window.__fakeGen=(el)=>sc(el%sc.duration); })();`;
const errors = [];
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base + 'healthz')).ok) break; } catch (e) { /* 아직 */ } await new Promise((r) => setTimeout(r, 100)); }
  // ── 1. 서버: 필요한 것만 내보내고, 나머지는 막는가 ──
  const idx = await head(''); check(idx.status === 200 && /text\/html/.test(idx.type), 'index.html 을 내보낸다');
  const wasm = await head('vendor/mediapipe/wasm/vision_wasm_internal.wasm'); check(wasm.status === 200 && wasm.type === 'application/wasm' && wasm.len > 9e6, `wasm 파일 종류·크기 (${(wasm.len / 1048576).toFixed(1)}MB)`);
  for (const p of ['src/engine.mjs', 'server.js', 'tests/test_ui.mjs', 'data/rooms.json', 'vendor/../server.js', 'vendor/%2e%2e/server.js', '.git/config', 'package.json', 'node_modules/pg/package.json']) { const r = await head(p); check(r.status === 404, `공개하지 않는 경로는 404: ${p}`); }
  const hasModel = fs.existsSync(root + 'vendor/mediapipe/pose_landmarker_lite.task'), hasVideo = fs.existsSync(root + 'media/sample_squat.mp4');
  console.log('모델 파일:', hasModel ? '있음' : '없음 → 지금은 구글 주소에서 받아야 한다', '| 샘플 영상:', hasVideo ? '있음' : '없음');
  // ── 2. 브라우저: 바깥 인터넷을 막고 연다 ──
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const outside = [], inside = [];
  const device = async (vp, mobile = false) => { const c = await browser.newContext({ viewport: vp, locale: 'ko-KR', isMobile: mobile, permissions: ['camera'] }); const p = await c.newPage(); p.on('pageerror', (e) => errors.push(e.message)); await p.route('**/*', (route) => { const u = route.request().url(); if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) { if (u.includes('/vendor/')) inside.push(u.replace(base, '')); route.continue(); } else { outside.push(u.split('?')[0]); route.abort(); } }); const g = p.goto.bind(p); p.goto = async (u, o) => { await g('about:blank'); return g(u, o); }; return p; };
  const pc = await device({ width: 1280, height: 900 });
  await pc.goto(base); await pc.waitForTimeout(900);
  check(await pc.isVisible('#view-home') && (await pc.$$eval('#tryCards .trycard', (x) => x.length)) === 3, '바깥 인터넷 없이 첫 화면이 뜬다');
  check(await pc.evaluate(() => typeof window.QRCode === 'function' && window.__movecoach.api.has() && window.__movecoach.S.serverAuto === true), '같은 주소의 기록 서버(/api)를 자동으로 찾아 쓴다');
  const view = (p) => p.evaluate(() => ['home', 'create', 'room', 'stage', 'result', 'admin'].find((v) => !document.querySelector('#view-' + v).hidden));
  const waitView = async (p, name, sec = 40) => { for (let i = 0; i < sec * 2; i++) { if (await view(p) === name) return true; await p.waitForTimeout(500); } return false; };
  const make = async (mode, mv, fill = async () => { }) => { await pc.goto(base + '#home'); await pc.waitForTimeout(400); await pc.click(`#homeModes [data-mode="${mode}"]`); await pc.waitForTimeout(400); await pc.click(`#moveTiles [data-mv="${mv}"]`); await pc.waitForTimeout(300); await fill(); await pc.click('#btnMakeRoom'); await pc.waitForTimeout(700); return pc.evaluate(() => ({ student: document.querySelector('#outStudent').value, admin: document.querySelector('#outAdmin').value, qr: !!document.querySelector('#qr canvas, #qr img'), note: document.querySelector('#outNote').textContent })); };
  // 연습 링크: 짧은 주소 + QR
  const prac = await make('practice', 'squat', async () => { await pc.fill('#fCourse', '가상과목'); await pc.fill('#fGoal', '3'); });
  check(/\?r=[a-z2-9]{7}$/.test(prac.student) && prac.student.length < 60 && prac.qr && /모입니다/.test(prac.note), `참여 링크가 짧고 QR이 바로 보인다: ${prac.student}`);
  // 다른 기기(학생 폰)에서 링크를 열고 연습 → 교수 PC에 기록이 보인다
  const phone = await device({ width: 390, height: 844 }, true);
  await phone.goto(prac.student); await phone.waitForTimeout(900); check((await phone.textContent('#rmTitle')).includes('가상과목'), '다른 기기에서 짧은 링크만으로 참여 화면이 뜬다');
  await phone.fill('#sName', '가상학생'); await phone.fill('#sId', '20260001'); await phone.evaluate(FAKE); await phone.evaluate(squatLoop(0.9, 0.8)); await phone.click('#btnStart');
  check(await waitView(phone, 'result', 40), '학생 폰: 연습을 마치고 결과가 나온다'); await phone.waitForTimeout(900); check(/전송됨/.test(await phone.textContent('#aSent')), '학생 폰: 기록이 전송된다');
  await pc.goto(prac.admin); await pc.waitForTimeout(900); const rows = await pc.$$eval('#adTable tbody tr', (x) => x.map((r) => r.querySelector('td').textContent)); check(rows.length === 1 && rows[0].includes('가상학생') && /기록 서버/.test(await pc.textContent('#adSource')), '교수 PC: 학생 폰에서 낸 기록이 보인다');
  await pc.click('#adTable tbody tr'); await pc.waitForTimeout(300); await pc.click('#fbAuto'); await pc.click('#fbSave'); await pc.waitForTimeout(500);
  const code = (await phone.textContent('#aSent')).match(/접수번호 ([A-Z0-9]+)/)[1]; await phone.goto(prac.student + '&my=' + code); await phone.waitForTimeout(800); check((await phone.textContent('#myBody')).includes('기록을 확인했습니다'), '학생 폰: 접수번호로 교수의 답장을 본다');
  // 시험: 영상 제출 → 교수가 비밀번호로 열람
  const exam = await make('exam', 'squat', async () => { await pc.fill('#fCourse', '가상과목'); await pc.fill('#fPw', '1234'); });
  await phone.goto(exam.student); await phone.waitForTimeout(800); await phone.fill('#sName', '시험학생'); await phone.fill('#sId', '20260002'); await phone.evaluate(FAKE); await phone.evaluate(squatLoop(0.9, 0.8)); await phone.click('#btnStart'); await phone.waitForTimeout(11000); await phone.click('#btnEndSet'); await phone.waitForTimeout(1600);
  const take = await phone.evaluate(() => window.__movecoach.S.takes.map((t) => ({ valid: t.valid, size: t.blob ? t.blob.size : 0, reasons: t.reasons }))); console.log('시험 촬영본:', JSON.stringify(take));
  if (take[0] && take[0].valid) { await phone.click('#takes .take'); await phone.click('#btnSubmitTake'); await phone.waitForTimeout(1800); check((await phone.textContent('#sheetBody')).includes('접수번호'), '학생 폰: 시험 영상을 제출한다');
    await pc.goto(exam.admin); await pc.waitForTimeout(700); await pc.fill('#apw', '1234'); await pc.click('#apwOk'); await pc.waitForTimeout(900); const href = await pc.evaluate(() => { const a = document.querySelector('#adTable tbody a'); return a && a.href; }); check(!!href && /video=/.test(href), '교수 PC: 제출된 시험 영상의 링크가 보인다');
    if (href) { const r = await fetch(href); const b = await r.arrayBuffer(); check(r.status === 200 && /video\//.test(r.headers.get('content-type')) && b.byteLength === take[0].size, `영상이 서버에 그대로 보관된다 (${(b.byteLength / 1024).toFixed(0)}KB)`); const r2 = await fetch(href.replace('pw=1234', 'pw=0000')); check(r2.status === 403, '비밀번호가 틀리면 영상이 열리지 않는다'); await r2.arrayBuffer(); }
  } else check(false, '시험 촬영본이 제출 가능 상태가 아님: ' + JSON.stringify(take));
  // 게임: 세 기기가 각자 시합 → 교수 화면의 실시간 순위판
  const game = await make('game', 'squat', async () => { await pc.fill('#fGoal', '3'); });
  await pc.goto(game.admin); await pc.waitForTimeout(800); check(await pc.isVisible('#adBoard') && (await pc.textContent('#boardTable tbody')).includes('아직 기록이 없습니다'), '교수 PC: 순위판이 비어 있는 상태로 열린다');
  const players = [['빠른학생', 0.5, 0.45], ['보통학생', 0.8, 0.7], ['느린학생', 1.2, 1.0]]; const phones = [phone, await device({ width: 390, height: 844 }, true), await device({ width: 390, height: 844 }, true)];
  await Promise.all(players.map(async ([name, d, u], i) => { const p = phones[i]; await p.goto(game.student); await p.waitForTimeout(800); await p.fill('#sName', name); await p.evaluate(FAKE); await p.evaluate(squatLoop(d, u)); await p.click('#btnStart'); }));
  let done = 0; for (let i = 0; i < 80 && done < 3; i++) { await pc.waitForTimeout(500); done = (await Promise.all(phones.map((p) => p.evaluate(() => { const g = window.__movecoach.getG(); return !g || g.state === 'done'; })))).filter(Boolean).length; }
  check(done === 3, '세 기기 모두 시합을 마친다'); await pc.waitForTimeout(6500); // 저장(2.5초) + 순위판 자동 새로 고침(3초)
  const board = await pc.$$eval('#boardTable tbody tr', (x) => x.map((r) => r.children[1].textContent.trim() + ' ' + r.children[2].textContent.trim())); console.log('실시간 순위판:', board.join(' | '));
  check(board.length === 3 && board[0].includes('빠른학생') && board[2].includes('느린학생'), '교수 PC: 새로 고침을 누르지 않아도 순위판에 1~3등이 차례로 올라온다');
  const rankText = await phones[2].textContent('#sheetBody'); check(/3명 중 3위/.test(rankText), '학생 폰: 자기 순위를 본다(3명 중 3위)'); await pc.click('#boardBig'); await pc.waitForTimeout(300); await pc.screenshot({ path: path.join(root, 'tests/shots/v6-live-board.png') }); await pc.keyboard.press('Escape');
  // 조별 공개: 학생이 만든 링크, 서로의 기록을 본다
  const open = await make('practice', 'squat', async () => { await pc.fill('#fCourse', '3조'); await pc.fill('#fGoal', '2'); await pc.click('#cstep3 details.more summary'); await pc.check('#fOpen', { force: true }); });
  for (const [i, name] of [[0, '조원1'], [1, '조원2']]) { const p = phones[i]; await p.goto(open.student); await p.waitForTimeout(800); await p.fill('#sName', name); await p.evaluate(FAKE); await p.evaluate(squatLoop(0.9, 0.8)); await p.click('#btnStart'); await waitView(p, 'result', 30); await p.waitForTimeout(900); }
  await phones[1].click('#aBack'); await phones[1].waitForTimeout(600); await phones[1].click('#rmBoardRefresh'); await phones[1].waitForTimeout(600); const peers = await phones[1].$$eval('#rmBoard tbody tr', (x) => x.map((r) => r.children[0].textContent)); check(peers.length === 2 && peers.includes('조원1') && peers.includes('조원2'), '조별 공개: 조원끼리 서로의 기록을 본다');
  // 모범 동작 링크: 모범(관절 움직임 숫자)이 기록 서버에 보관되고, 짧은 링크로 열어도 그대로 온다 → 따라 하기 → 교수 화면
  await pc.goto(base + '#create'); await pc.waitForTimeout(400); await pc.click('#modeTiles [data-mode="practice"]'); await pc.waitForTimeout(300);
  const ACT = `const A=16/9; const rest=m.armsPose({ar:A,armL:8,foreL:4,armR:8,foreR:4}), good=m.armsPose({ar:A}), bad=m.armsPose({ar:A,armR:6,foreR:8}); const e=(u)=>0.5-0.5*Math.cos(Math.PI*Math.max(0,Math.min(1,u))); const act=(t,to)=>{ const u= t<0.4?0 : t<1.4? e((t-0.4)/1.0) : t<2.4? 1 : t<3.2? 1-e((t-2.4)/0.8) : 0; return m.lerpPose(rest,to,u); };`;
  await pc.evaluate(`(()=>{ const m=window.__movecoach; ${ACT} const take=()=>{ const fr=[]; for(let t=0;t<=3600;t+=50) fr.push(m.motionFrame(act(t/1000,good),1280,720,t)); return fr; }; const tpl=m.buildMotionTemplate([take(),take(),take()]); m.C.custom={id:'cmsrv',kind:'motion',name:'팔 올렸다 내리기',tpl,count:2,pass:80}; m.C.movement=null; m.C.step=3; m.renderCreate(); })()`);
  await pc.fill('#fGoal', '2'); await pc.click('#btnMakeRoom'); await pc.waitForTimeout(700); const fol = await pc.evaluate(() => ({ student: document.querySelector('#outStudent').value, admin: document.querySelector('#outAdmin').value }));
  check(/\?r=[a-z0-9]{6,8}$/.test(fol.student), '모범 동작 링크도 짧다(모범은 링크가 아니라 서버에 보관): ' + fol.student.replace(base, ''));
  { const p = phones[0]; await p.goto(fol.student); await p.waitForTimeout(900); check(await p.isVisible('#rmModelCard') && /팔 올렸다 내리기/.test(await p.textContent('#rmMeta')), '학생 폰: 짧은 링크로 열어도 모범 동작이 보인다'); await p.fill('#sName', '따라학생'); if (await p.isVisible('#sId')) await p.fill('#sId', '20260001'); await p.evaluate(FAKE);
    await p.evaluate(`(()=>{ const m=window.__movecoach; ${ACT} window.__fakeGen=()=>{ const an=m.S.analyzer; if(m.S.flow==='running'&&an&&an.phase==='play'){ return act((performance.now()-an.playT)/1000-0.15, an.reps.length===1? bad : good); } return rest; }; })()`);
    await p.click('#btnStart'); const ok = await waitView(p, 'result', 50); await p.waitForTimeout(900); const r = await p.evaluate(() => { const r = window.__movecoach.S.result; return r && { type: r.type, count: r.count, hits: r.hits, sent: document.querySelector('#aSent')?.textContent }; }); console.log('모범 따라 하기(서버):', JSON.stringify(r)); check(ok && r && r.type === 'follow' && r.count === 2 && r.hits === 1 && /전송됨/.test(r.sent), '학생 폰: 2번 따라 해 1번 맞음, 결과 전송'); }
  await pc.goto(fol.admin); await pc.waitForTimeout(900); { const t = (await pc.textContent('#adTable tbody')).replace(/\s+/g, ' '); check(/따라학생/.test(t) && /팔 올렸다 내리기/.test(t), '교수 PC: 모범 따라 하기 기록이 보인다'); await pc.click('#adTable tbody tr'); await pc.waitForTimeout(300); check(/1 \/ 2번/.test(await pc.textContent('#sheetBody')), '교수 PC: 상세에 맞은 횟수(1 / 2번)'); await pc.click('#btnSheetClose'); }
  // ── 3. 자세 인식 파일: 우리 폴더의 것으로 뜨는가 ──
  const mp = await device({ width: 1280, height: 900 }); await mp.goto(base + '#try'); await mp.waitForTimeout(500);
  const r = await mp.evaluate(async () => { const m = window.__movecoach; try { await m.ensureLandmarker(1); return { ok: true, base: m.MP.base, model: m.MP.model, delegate: m.MP.delegate, ms: m.MP.ms }; } catch (e) { return { ok: false, base: m.MP.base, model: m.MP.model, err: String(e && e.message).slice(0, 160) }; } });
  console.log('자세 인식 시작 결과:', JSON.stringify(r)); check(r.base === './vendor/mediapipe' && inside.some((u) => u.endsWith('.wasm')), '자세 인식 실행 파일을 우리 서버에서 불러온다');
  const out = [...new Set(outside)].filter((u) => !/fonts\.g|pretendard/.test(u)); // 글꼴(구글 글꼴, 프리텐다드)은 못 받아도 기기 글꼴로 보인다
  if (hasModel) { check(r.ok && r.model.startsWith('./vendor/'), `모델도 우리 폴더에서 불러와 시작된다 (${r.delegate}, ${r.ms}ms)`); check(out.length === 0, '글꼴 말고는 바깥으로 나간 요청이 없다: ' + JSON.stringify(out));
    const img = process.argv[2]; if (r.ok && img && fs.existsSync(img)) { const data = 'data:image/png;base64,' + fs.readFileSync(img).toString('base64'); const d = await mp.evaluate(async (data) => { const m = window.__movecoach; const im = new Image(); im.src = data; await im.decode(); const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; cv.getContext('2d').drawImage(im, 0, 0); let ts = performance.now() + 5, res; for (let i = 0; i < 6; i++) { ts += 33; res = m.S.landmarker.detectForVideo(cv, ts); } const p = res.landmarks && res.landmarks[0]; return { found: !!p, nose: p && +p[0].y.toFixed(2), sho: p && +p[11].y.toFixed(2) }; }, data); console.log('사진 인식 결과:', JSON.stringify(d)); check(d.found && d.nose < d.sho, '실제 사진에서 사람을 찾았고, 코가 어깨보다 위에 있다'); } }
  else check(!r.ok && out.length === 1 && /pose_landmarker_lite\.task/.test(out[0]), '모델 파일이 없어 구글 주소로 가려 했다(막아 두어 실패가 정상). 바깥 요청은 이것 하나뿐: ' + JSON.stringify(out));
  await mp.goto(base + '#try'); await mp.waitForTimeout(400); await mp.click('#tryCards [data-syn="motion"]'); await mp.waitForTimeout(8000); check(await mp.evaluate(() => window.__movecoach.S.flow === 'running' && window.__movecoach.S.source === 'synth'), '가상 인물 시연은 자세 인식 파일 없이도 돌아간다');
  check(errors.length === 0, '화면 오류 없음 ' + JSON.stringify(errors.slice(0, 3)));
  await browser.close();
} finally { srv.kill(); }
console.log(fails ? `\n${fails} FAIL(S)` : '\nALL OK');
process.exit(fails ? 1 : 0);
