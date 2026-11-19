/* ================= v5 그림: 가상 인물로 그리는 썸네일·전후 비교·사용법 안내 =================
 * 사진이나 영상 파일 없이, 계산으로 만든 가상 인물(synth.mjs)을 캔버스에 그린다.
 * 실제 학생 자료를 쓰지 않으므로 대회 규정(가상 데이터만)에 맞고, 파일이 없어 가볍다.
 */
const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const INK = { bg: '#0f141b', floor: '#161e29', body: '#e9eef5', good: '#3fd68f', bad: '#ff6b86', warn: '#ffbf47', ghost: 'rgba(255,255,255,.38)', dim: '#8b98aa' };
let GFONT = null; const gfont = () => GFONT || (GFONT = getComputedStyle(document.body).fontFamily);
/** 캔버스를 화면 크기와 기기 해상도에 맞춘다 */
function fitCanvas(cv) { const dpr = Math.min(2, window.devicePixelRatio || 1); const w = cv.clientWidth || 300, h = cv.clientHeight || 200; const W = Math.round(w * dpr), H = Math.round(h * dpr); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); return { c, w, h }; }
/** 가상 인물 한 명을 상자(box) 안에 그린다. ar: 그 자세를 만들 때 쓴 가로/세로 비율 */
function drawFigure(c, lm, box, o = {}) {
  const ar = o.ar || 0.75; const sc = Math.min(box.w / ar, box.h), fw = sc * ar, fh = sc, ox = box.x + (box.w - fw) / 2, oy = box.y + (box.h - fh) / 2; const X = (x) => ox + x * fw, Y = (y) => oy + y * fh;
  c.save(); if (o.alpha != null) c.globalAlpha = o.alpha; const col = o.color || INK.body, lw = o.lineW || Math.max(2.5, fh / 46);
  if (o.floor !== false && (lm[27].visibility ?? 1) > 0.4) { const fy = Math.min(oy + fh * 0.985, Y(Math.max(lm[31].y, lm[32].y) + 0.012)); c.fillStyle = o.floorColor || INK.floor; c.fillRect(box.x, fy, box.w, box.y + box.h - fy); }
  if (o.dash) c.setLineDash(o.dash); c.lineCap = 'round'; c.lineJoin = 'round';
  const hl = o.hl || null;
  for (const [a, b] of CONNECTIONS) { const pa = lm[a], pb = lm[b]; if ((pa.visibility ?? 1) < 0.4 || (pb.visibility ?? 1) < 0.4) continue; const k = hl && (hl[`${a}-${b}`] || hl[`${b}-${a}`]); c.strokeStyle = k || col; c.lineWidth = k ? lw * 1.3 : lw; c.beginPath(); c.moveTo(X(pa.x), Y(pa.y)); c.lineTo(X(pb.x), Y(pb.y)); c.stroke(); }
  const n = lm[0], sx = (lm[11].x + lm[12].x) / 2, sy = (lm[11].y + lm[12].y) / 2, hx = (lm[23].x + lm[24].x) / 2, hy = (lm[23].y + lm[24].y) / 2; const hipsSeen = Math.min(lm[23].visibility ?? 1, lm[24].visibility ?? 1) > 0.4;
  const hr = hipsSeen ? Math.hypot((hx - sx) * fw, (hy - sy) * fh) * 0.2 : Math.hypot((lm[11].x - lm[12].x) * fw, (lm[11].y - lm[12].y) * fh) * 0.3;
  if (o.dash) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.arc(X(n.x), Y(n.y), Math.max(3, hr), 0, Math.PI * 2); c.stroke(); }
  else { c.fillStyle = col; c.beginPath(); c.arc(X(n.x), Y(n.y), Math.max(3, hr), 0, Math.PI * 2); c.fill(); if (o.joints !== false) { const r = Math.max(1.6, lw * 0.62); for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) { const p = lm[i]; if ((p.visibility ?? 1) < 0.4) continue; c.fillStyle = '#fff'; c.beginPath(); c.arc(X(p.x), Y(p.y), r, 0, Math.PI * 2); c.fill(); } } }
  c.restore(); return { X, Y, fw, fh };
}
/** 활과 시위(양궁 장면을 알아보기 쉽게). m: drawFigure가 돌려준 좌표 변환 */
function drawBow(c, m, lm) { const bw = lm[15], dw = lm[16], hip = lm[23]; if (bw.y > hip.y - 0.12) return; const x = m.X(bw.x), y = m.Y(bw.y), r = m.fh * 0.19, dx = m.X(dw.x), dy = m.Y(dw.y); c.save(); c.lineCap = 'round'; c.strokeStyle = '#c9a36a'; c.lineWidth = Math.max(2.5, m.fh / 70); c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x + r * 0.55, y, x, y + r); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = Math.max(1, m.fh / 260); c.beginPath(); c.moveTo(x, y - r); c.lineTo(dx, dy); c.lineTo(x, y + r); c.stroke(); c.restore(); }
const segMap = (pairs, color) => { const m = {}; for (const [a, b] of pairs) m[`${a}-${b}`] = color; return m; };
function chip(c, text, x, y, o = {}) { const px = o.size || 13; c.font = `${o.weight || 800} ${px}px ${gfont()}`; const tw = c.measureText(text).width, ph = px + 10, pw = tw + 18; const bx = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2; c.fillStyle = o.bg || 'rgba(0,0,0,.55)'; c.beginPath(); c.roundRect ? c.roundRect(bx, y - ph / 2, pw, ph, o.r ?? ph / 2) : c.rect(bx, y - ph / 2, pw, ph); c.fill(); c.fillStyle = o.color || '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(text, bx + 9, y + 0.5); return pw; }

/* ---------- 장면: 동작마다 "교정 전(틀린 자세)"과 "교정 후(바른 자세)" ---------- */
const cyc = (t, T = 2.6) => { const q = (t % T) / T; return q < 0.4 ? 0.5 - 0.5 * Math.cos(Math.PI * q / 0.4) : q < 0.55 ? 1 : q < 0.9 ? 0.5 + 0.5 * Math.cos(Math.PI * (q - 0.55) / 0.35) : 0; }; // 0→1→0 을 되풀이
const LEGS = [[23, 25], [25, 27], [24, 26], [26, 28]], ARMS = [[11, 13], [13, 15], [12, 14], [14, 16]], TRUNK = [[11, 23], [12, 24]];
const SCENES = {
  match: { name: '모범 자세 따라 하기', short: '모범 따라 하기', ar: 0.75, cue: ['오른팔을 더 올리세요', '똑같아요!'], ghost: () => archeryPose(), bow: true, key: 2.2,
    pose: (bad, t) => { const q = (t % 4.4) / 4.4; const u = q < 0.22 ? 0.5 - 0.5 * Math.cos(Math.PI * q / 0.22) : q < 0.82 ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * (q - 0.82) / 0.18); return lerpPose(standPose(), archeryPose(bad ? { elbowDrop: 30, bowDrop: 12 } : {}), u); }, hl: (bad) => bad ? [[12, 14], [14, 16]] : ARMS },
  squat: { name: '스쿼트', ar: 0.75, cue: ['상체를 세우세요', '좋아요!'], key: 1.2, pose: (bad, t) => { const u = cyc(t); return bad ? squatPose(174 - 60 * u, 10 + 52 * u) : squatPose(174 - 86 * u, 10 + 26 * u); }, hl: (bad) => bad ? TRUNK : LEGS },
  pushup: { name: '푸시업', ar: 4 / 3, cue: ['엉덩이가 처졌어요', '좋아요!'], key: 1.1, pose: (bad, t) => pushupPose(cyc(t, 2.4), { sag: bad ? 0.06 : 0 }), hl: (bad) => bad ? TRUNK.concat([[23, 25], [24, 26]]) : ARMS },
  lunge: { name: '런지', ar: 0.75, cue: ['상체를 세우세요', '좋아요!'], key: 1.2, pose: (bad, t) => lungePose(cyc(t), { trunk: bad ? 32 : 6 }), hl: (bad) => bad ? TRUNK : LEGS },
  press: { name: '앉아서 팔 뻗기', ar: 4 / 3, cue: ['양팔을 똑같이', '좋아요!'], key: 1.0, pose: (bad, t) => { const u = cyc(t, 2.2); return pressPose(u, bad ? u * 0.55 : u, { ar: 4 / 3 }); }, hl: () => ARMS },
  bow: { name: '인사', ar: 0.75, cue: ['허리부터 숙이세요', '좋아요 · 30°'], key: 1.4, pose: (bad, t) => { const u = cyc(t, 3); return bad ? bowPose(3 + 9 * u, { neck: 16 + 36 * u }) : bowPose(3 + 27 * u); }, hl: () => TRUNK },
  run: { name: '달리기 자세', ar: 0.75, cue: ['상체를 세우세요', '좋아요 · 172보/분'], key: 0.1, pose: (bad, t) => runPose((t * 172 / 120) % 1, bad ? { lean: 25, bounce: 0.03 } : {}), hl: (bad) => bad ? TRUNK : LEGS },
  plank: { name: '플랭크', ar: 4 / 3, cue: ['엉덩이가 처졌어요', '좋아요, 유지'], key: 0, pose: (bad, t) => plankPose(bad ? 0.055 + 0.012 * Math.sin(t * 2) : 0.004 * Math.sin(t * 2)), hl: () => TRUNK.concat([[23, 25], [24, 26]]) },
  cpr: { name: '가슴압박', ar: 0.9, cue: ['팔꿈치를 펴세요', '좋아요 · 110/분'], key: 0.27, pose: (bad, t) => cprPose(0.5 - 0.5 * Math.cos(2 * Math.PI * t * 110 / 60), { ar: 0.9, elbowBend: bad ? 44 : 0 }), hl: () => ARMS },
};
SCENES.cpr_compression = SCENES.cpr; SCENES.cpr_sequence = Object.assign({}, SCENES.cpr, { name: '심폐소생술 절차' });
const sceneOf = (id) => SCENES[id] || SCENES.squat;
/** 장면 하나를 그린다. o: {bad, cue:문구 보이기, label:'교정 전'…, still:멈춘 그림} */
function sceneDraw(c, w, h, sc, t, o = {}) {
  const bad = !!o.bad; c.fillStyle = INK.bg; c.fillRect(0, 0, w, h); const tt = o.still ? (sc.key || 0) : t; const cueH = o.cue ? 34 : 0; const box = { x: 0, y: o.label ? 6 : 0, w, h: h - cueH - (o.label ? 6 : 0) };
  if (sc.ghost && o.ghost !== false) drawFigure(c, sc.ghost(), box, { ar: sc.ar, color: INK.ghost, dash: [5, 5], floor: false, lineW: Math.max(2, box.h / 60) });
  const lm = sc.pose(bad, tt);
  const m = drawFigure(c, lm, box, { ar: sc.ar, hl: segMap(sc.hl(bad), bad ? INK.bad : INK.good) }); if (sc.bow) drawBow(c, m, lm);
  if (o.label) chip(c, o.label, 10, 18, { align: 'left', size: 12, bg: bad ? 'rgba(209,59,87,.9)' : 'rgba(26,143,90,.9)' });
  if (o.cue) chip(c, sc.cue[bad ? 0 : 1], w / 2, h - 19, { size: Math.min(15, Math.max(12, w / 16)), bg: bad ? 'rgba(209,59,87,.92)' : 'rgba(26,143,90,.92)' });
}
/** 게임 장면: 세 사람이 스쿼트 시합 */
function raceDraw(c, w, h, t) {
  c.fillStyle = INK.bg; c.fillRect(0, 0, w, h); const sp = [1.5, 1.85, 2.3], av = ['🐰', '🐻', '🦊'], T = 12, tt = t % T; const counts = sp.map((s) => Math.min(6, Math.floor(tt / s))); const order = [0, 1, 2].sort((a, b) => counts[b] - counts[a] || a - b);
  for (let i = 0; i < 3; i++) { const bx = { x: w * i / 3, y: 30, w: w / 3, h: h - 30 }; const done = counts[i] >= 6; const u = done ? 0 : cyc(tt, sp[i]); drawFigure(c, squatPose(174 - 86 * u, 10 + 26 * u), bx, { ar: 0.75, hl: segMap(LEGS, done ? INK.warn : INK.good) });
    const rank = order.indexOf(i); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${Math.min(20, w / 16)}px ${gfont()}`; c.fillStyle = '#fff'; c.fillText(`${av[i]} ${counts[i]}`, bx.x + bx.w / 2, 16); if (done || tt > 3) { c.font = `${Math.min(22, w / 14)}px serif`; c.fillText(['🥇', '🥈', '🥉'][rank], bx.x + bx.w - 16, 44); } }
}

/* ---------- 움직이는 그림 관리: 화면에 보이는 것만 다시 그린다 ---------- */
const Anim = {
  items: new Set(), raf: null, frame: 0,
  add(cv, fn) { const it = { cv, fn, last: -1 }; this.items.add(it); this.kick(); try { fn(0); } catch (e) { /* 아직 크기가 0일 수 있음 */ } return it; },
  kick() { if (this.raf) return; const step = (now) => { this.raf = null; this.frame++; const t = now / 1000; for (const it of [...this.items]) { if (!document.body.contains(it.cv)) { this.items.delete(it); continue; } if (it.cv.offsetParent === null) continue; if (REDUCED) { if (t - it.last < 2.5) continue; } else if (this.frame % 2) continue; it.last = t; try { it.fn(t); } catch (e) { /* 그림 하나의 오류가 화면 전체를 멈추지 않게 */ } } if (this.items.size) this.raf = requestAnimationFrame(step); }; this.raf = requestAnimationFrame(step); },
};
/** 동작 장면을 캔버스에 걸어 둔다 */
function mountScene(cv, id, o = {}) { const sc = sceneOf(id); return Anim.add(cv, (t) => { const { c, w, h } = fitCanvas(cv); if (id === 'race') raceDraw(c, w, h, t); else sceneDraw(c, w, h, sc, t, Object.assign({ still: REDUCED && !o.cue }, o)); }); }
/** 모범(따라 하기) 윤곽을 캔버스에 그린다: 링크 만들기 확인 화면, 학생 화면 */
function templateToPose(tpl) { // 모범에 저장된 윤곽 좌표 → 33점 형식(그리기용)
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 })); const xs = tpl.sk.filter((p) => p[2] >= 4).map((p) => p[0] / 100), ys = tpl.sk.filter((p) => p[2] >= 4).map((p) => p[1] / 100);
  const minY = Math.min(...ys), maxY = Math.max(...ys), minX = Math.min(...xs), maxX = Math.max(...xs); const span = Math.max(maxY - minY, (maxX - minX) / 0.75, 1.6); const k = 0.78 / span; const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  SK_IDX.forEach((idx, j) => { const p = tpl.sk[j]; lm[idx] = { x: 0.5 + (p[0] / 100 - cx) * k / 0.75, y: 0.52 + (p[1] / 100 - cy) * k, z: 0, visibility: p[2] / 10 }; });
  for (const [a, b] of [[29, 27], [31, 27], [30, 28], [32, 28]]) lm[a] = Object.assign({}, lm[b], { visibility: 0 }); return lm;
}
function drawTemplate(cv, tpl, o = {}) { const { c, w, h } = fitCanvas(cv); c.fillStyle = INK.bg; c.fillRect(0, 0, w, h); drawFigure(c, templateToPose(tpl), { x: 0, y: 0, w, h }, { ar: 0.75, floor: false, color: o.color || INK.good }); if (o.label) chip(c, o.label, 10, 18, { align: 'left', size: 12, bg: 'rgba(26,143,90,.9)' }); }

/* ---------- 첫 화면의 사용법 안내(움직이는 그림 4장면) ---------- */
const GUIDE_STEPS = ['모범을 찍는다', '링크를 보낸다', '따라 하며 교정', '한 화면에 모인다'];
function guideDraw(c, w, h, t) {
  const T = 4.4, i = Math.floor((t % (T * 4)) / T), q = ((t % (T * 4)) % T) / T; c.fillStyle = INK.bg; c.fillRect(0, 0, w, h); const F = (px, wt = 800) => { c.font = `${wt} ${px}px ${gfont()}`; }; const U = Math.min(w, h * 1.5) / 100; // 크기 단위
  const rr = (x, y, ww, hh, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, ww, hh, r) : c.rect(x, y, ww, hh); };
  if (i === 0) { // 모범 자세를 세 번 찍는다 → 평균이 점선(모범)으로 남는다
    const box = { x: w * 0.18, y: h * 0.06, w: w * 0.64, h: h * 0.88 }; const u = Math.min(1, q / 0.18); const lm = lerpPose(standPose(), archeryPose(), 0.5 - 0.5 * Math.cos(Math.PI * u));
    if (q > 0.82) drawFigure(c, archeryPose(), box, { ar: 0.75, color: INK.good, dash: [6, 6], floor: false, alpha: Math.min(1, (q - 0.82) / 0.08) });
    const fm = drawFigure(c, lm, box, { ar: 0.75, alpha: q > 0.86 ? 0.35 : 1 }); if (q <= 0.86) drawBow(c, fm, lm);
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3; const m = U * 6, L = U * 7; for (const [cx, cy, sx, sy] of [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]]) { c.beginPath(); c.moveTo(cx + sx * L, cy); c.lineTo(cx, cy); c.lineTo(cx, cy + sy * L); c.stroke(); }
    const shots = [0.32, 0.5, 0.68]; shots.forEach((s, k) => { const on = q >= s; c.fillStyle = on ? INK.good : 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(w - m - U * 3 - k * U * 5, m + U * 4, U * 1.6, 0, Math.PI * 2); c.fill(); if (q >= s && q < s + 0.07) { c.fillStyle = `rgba(255,255,255,${0.75 * (1 - (q - s) / 0.07)})`; c.fillRect(0, 0, w, h); } });
    const n = shots.filter((s) => q >= s).length; chip(c, q > 0.82 ? '모범 저장 ✓' : n ? `찰칵 ${n}/3` : '자세를 잡고…', w / 2, h - m - U * 2, { size: Math.max(13, U * 3.6), bg: q > 0.82 ? 'rgba(26,143,90,.92)' : 'rgba(0,0,0,.6)' });
  } else if (i === 1) { // 링크 하나가 여러 폰으로
    const cx = w / 2, top = h * 0.2; F(Math.max(14, U * 4.2), 900); const label = '🔗 링크 하나'; const tw = c.measureText(label).width + U * 8; c.fillStyle = '#e01838'; rr(cx - tw / 2, top - U * 5, tw, U * 10, U * 5); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, cx, top);
    const n = 6; for (let k = 0; k < n; k++) { const px = w * (0.12 + 0.76 * k / (n - 1)), py = h * (0.68 + 0.06 * Math.sin(k * 1.9)); const start = 0.12 + k * 0.09, u = Math.max(0, Math.min(1, (q - start) / 0.3)); const got = u >= 1;
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.5; c.setLineDash([4, 5]); c.beginPath(); c.moveTo(cx, top + U * 5); c.lineTo(px, py - U * 9); c.stroke(); c.setLineDash([]);
      if (u > 0 && u < 1) { c.fillStyle = '#ff6b86'; c.beginPath(); c.arc(cx + (px - cx) * u, top + U * 5 + (py - U * 9 - top - U * 5) * u, U * 1.3, 0, Math.PI * 2); c.fill(); }
      const pw = U * 9, ph = U * 16; c.fillStyle = got ? '#143326' : '#1f2834'; c.strokeStyle = got ? INK.good : '#3a4756'; c.lineWidth = 2; rr(px - pw / 2, py - ph / 2, pw, ph, U * 1.6); c.fill(); c.stroke();
      if (got) { c.strokeStyle = INK.good; c.lineWidth = 3; c.beginPath(); c.moveTo(px - U * 2, py); c.lineTo(px - U * 0.4, py + U * 1.8); c.lineTo(px + U * 2.4, py - U * 2); c.stroke(); } }
    chip(c, '로그인 없음 · 설치 없음', cx, h - U * 6, { size: Math.max(12, U * 3.2) });
  } else if (i === 2) { // 따라 하면 바로 교정
    const box = { x: w * 0.08, y: h * 0.04, w: w * 0.5, h: h * 0.92 }; const bad = q < 0.5; const qq = bad ? q / 0.5 : (q - 0.5) / 0.5; const u = qq < 0.4 ? 0.5 - 0.5 * Math.cos(Math.PI * qq / 0.4) : qq < 0.6 ? 1 : qq < 0.95 ? 0.5 + 0.5 * Math.cos(Math.PI * (qq - 0.6) / 0.35) : 0;
    drawFigure(c, bad ? squatPose(174 - 60 * u, 10 + 52 * u) : squatPose(174 - 86 * u, 10 + 26 * u), box, { ar: 0.75, hl: segMap(bad ? TRUNK : LEGS, u > 0.5 ? (bad ? INK.bad : INK.good) : INK.body) });
    const count = bad ? (qq > 0.9 ? 1 : 0) : (qq > 0.9 ? 2 : 1); F(Math.max(34, U * 15), 900); c.fillStyle = '#fff'; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(String(count), w - U * 9, U * 6); F(Math.max(12, U * 3.4)); c.fillStyle = INK.dim; c.fillText('회', w - U * 4, U * 13);
    if (u > 0.5) { const text = bad ? '상체를 세우세요' : '좋아요!'; const y = h * 0.52, x = w * 0.74; chip(c, text, x, y, { size: Math.max(14, U * 4), bg: bad ? 'rgba(209,59,87,.95)' : 'rgba(26,143,90,.95)' }); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2; for (let k = 1; k <= 3; k++) { c.beginPath(); c.arc(x, y + U * 9, U * 1.8 * k, Math.PI * 1.2, Math.PI * 1.8); c.stroke(); } F(Math.max(11, U * 2.8), 700); c.fillStyle = INK.dim; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('목소리로 바로', x, y + U * 12); }
  } else { // 결과가 한 화면에 모인다
    const px = w * 0.12, py = h * 0.1, pw = w * 0.76, ph = h * 0.8; c.fillStyle = '#171e28'; c.strokeStyle = '#2a3542'; c.lineWidth = 2; rr(px, py, pw, ph, U * 3); c.fill(); c.stroke(); F(Math.max(12, U * 3.2)); c.fillStyle = INK.dim; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('만든 사람의 화면 · 점수 낮은 순', px + U * 4, py + U * 6);
    const rows = [[62, '상체 숙임'], [74, '깊이 부족'], [85, ''], [91, ''], [96, '']]; const rh = (ph - U * 12) / rows.length; rows.forEach(([score, issue], k) => { const start = 0.08 + k * 0.12, u = Math.max(0, Math.min(1, (q - start) / 0.14)); if (u <= 0) return; const y = py + U * 11 + k * rh, x = px + U * 4 + (1 - u) * U * 10; c.globalAlpha = u;
      c.fillStyle = score < 70 ? 'rgba(209,59,87,.22)' : 'rgba(255,255,255,.05)'; rr(x, y, pw - U * 8, rh - U * 1.6, U * 2); c.fill(); c.fillStyle = score < 70 ? INK.bad : '#3a4756'; c.beginPath(); c.arc(x + U * 4.5, y + (rh - U * 1.6) / 2, U * 2.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.3)'; rr(x + U * 9, y + (rh - U * 1.6) / 2 - U * 1, U * (14 + (k * 7) % 9), U * 2, U); c.fill(); if (issue) chip(c, issue, x + U * 38, y + (rh - U * 1.6) / 2, { align: 'left', size: Math.max(10, U * 2.6), bg: 'rgba(209,59,87,.85)' });
      F(Math.max(15, U * 4.6), 900); c.fillStyle = score < 70 ? INK.bad : '#fff'; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText(String(score), x + pw - U * 11, y + (rh - U * 1.6) / 2); c.globalAlpha = 1; });
  }
  return i;
}
function mountGuide(cv, stepsEl) { stepsEl.innerHTML = GUIDE_STEPS.map((s, k) => `<span data-k="${k}"><b>${k + 1}</b>${s}</span>`).join(''); const spans = [...stepsEl.children]; let cur = -1; return Anim.add(cv, (t) => { const { c, w, h } = fitCanvas(cv); const i = guideDraw(c, w, h, REDUCED ? Math.floor(t / 4) * 4.4 + 3.6 : t); if (i !== cur) { cur = i; spans.forEach((s, k) => s.classList.toggle('cur', k === i)); } }); }
