/* ================= 그림: 가상 인물로 그리는 썸네일·전후 비교·사용법 안내·아이콘 =================
 * 사진이나 영상 파일 없이, 계산으로 만든 가상 인물(synth.mjs)을 캔버스에 그린다.
 * 실제 학생 자료를 쓰지 않으므로 대회 규정(가상 데이터만)에 맞고, 파일이 없어 가볍다.
 */
const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const INK = { bg: '#0d1424', bg2: '#141d33', floor: '#18223a', body: '#eaf0f8', good: '#2fd08a', bad: '#ff5c7a', warn: '#ffb84d', ghost: 'rgba(255,255,255,.42)', dim: '#8d9ab0', red: '#e01838' };
let GFONT = null; const gfont = () => GFONT || (GFONT = getComputedStyle(document.body).fontFamily);

/* ---------- 아이콘(직접 그린 선 그림). 글자 크기에 맞춰진다 ---------- */
const svgIcon = (d) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  practice: svgIcon('<circle cx="9" cy="5" r="2.2"/><path d="M9 8.2v6M9 14.2l-3 5.8M9 14.2l3 5.8M4.5 11.4L9 9.6l3.6 1.8"/><path d="M15.4 7.2l2 2 3.6-4.2"/>'),
  assignment: svgIcon('<path d="M12 15V4M12 4L8 8M12 4l4 4"/><path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4"/>'),
  exam: svgIcon('<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/><circle cx="12" cy="15.2" r="1.1"/>'),
  game: svgIcon('<path d="M5 21V4"/><path d="M5 4.5h12l-2.2 3.5L17 11.5H5"/>'),
  video: svgIcon('<rect x="3" y="6.5" width="12.5" height="11" rx="2.2"/><path d="M15.5 10.6l5.5-3.1v9l-5.5-3.1"/>'),
  camera: svgIcon('<path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3a1.5 1.5 0 011.5 1.5v8a1.5 1.5 0 01-1.5 1.5H4A1.5 1.5 0 012.5 18v-8A1.5 1.5 0 014 8.5z"/><circle cx="12" cy="13.5" r="3.3"/>'),
  upload: svgIcon('<path d="M12 15V4M12 4L8 8M12 4l4 4"/><path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4"/>'),
  link: svgIcon('<path d="M10.2 13.8a4 4 0 005.6 0l3-3a4 4 0 00-5.6-5.6l-1.2 1.2"/><path d="M13.8 10.2a4 4 0 00-5.6 0l-3 3a4 4 0 005.6 5.6l1.2-1.2"/>'),
  play: svgIcon('<path d="M8 5.5v13l11-6.5z"/>'),
  sound: svgIcon('<path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z"/><path d="M15.5 9a4.2 4.2 0 010 6M18.2 6.5a7.8 7.8 0 010 11"/>'),
  mute: svgIcon('<path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  hand: svgIcon('<path d="M8 13V6.5a1.5 1.5 0 013 0V12M11 6V5a1.5 1.5 0 013 0v7M14 6.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-.8a5 5 0 01-4-2L3 14.6a1.6 1.6 0 012.5-2L8 15"/>'),
  eye: svgIcon('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  users: svgIcon('<circle cx="9" cy="8" r="3"/><path d="M3 19.5c.6-3.4 3-5 6-5s5.4 1.6 6 5"/><path d="M16 5.4a3 3 0 010 5.2M18 14.8c1.7.6 2.7 2 3 4.7"/>'),
  chart: svgIcon('<path d="M4 20V5M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>'),
  ear: svgIcon('<path d="M4.5 14v-2a7.5 7.5 0 0115 0v2"/><rect x="3" y="13.5" width="4.5" height="6.5" rx="1.8"/><rect x="16.5" y="13.5" width="4.5" height="6.5" rx="1.8"/>'),
  arrow: svgIcon('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  check: svgIcon('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  qr: svgIcon('<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2.5v2.5M20 14v6h-3M14 20h.01"/>'),
  share: svgIcon('<path d="M12 15V4M12 4L8.5 7.5M12 4l3.5 3.5"/><path d="M6 11H5a1.5 1.5 0 00-1.5 1.5v6A1.5 1.5 0 005 20h14a1.5 1.5 0 001.5-1.5v-6A1.5 1.5 0 0019 11h-1"/>'),
};
const MODE_SVG = { practice: ICON.practice, assignment: ICON.assignment, exam: ICON.exam, game: ICON.game };

/** 캔버스를 화면 크기와 기기 해상도에 맞춘다 */
function fitCanvas(cv) { const dpr = Math.min(2, window.devicePixelRatio || 1); const w = cv.clientWidth || 300, h = cv.clientHeight || 200; const W = Math.round(w * dpr), H = Math.round(h * dpr); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); return { c, w, h }; }
const rrect = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); else c.rect(x, y, w, h); };
/** 무대 바탕: 짙은 남색에 위쪽이 살짝 밝다 */
function paintBg(c, w, h) { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, INK.bg2); g.addColorStop(1, INK.bg); c.fillStyle = g; c.fillRect(0, 0, w, h); }
const FIG_LIMBS = [[11, 13, 0.17], [13, 15, 0.14], [12, 14, 0.17], [14, 16, 0.14], [23, 25, 0.23], [25, 27, 0.18], [24, 26, 0.23], [26, 28, 0.18], [27, 31, 0.12], [28, 32, 0.12]];
/** 가상 인물 한 명을 상자(box) 안에 그린다. ar: 그 자세를 만들 때 쓴 가로/세로 비율.
 *  몸통은 면으로, 팔다리는 굵기가 다른 둥근 막대로 그려 "관절 인형"처럼 보이게 한다. dash를 주면 점선 윤곽(모범)만 그린다. */
function drawFigure(c, lm, box, o = {}) {
  const ar = o.ar || 0.75; const sc = Math.min(box.w / ar, box.h), fw = sc * ar, fh = sc, ox = box.x + (box.w - fw) / 2, oy = box.y + (box.h - fh) / 2; const X = (x) => ox + x * fw, Y = (y) => oy + y * fh;
  const P = (i) => ({ x: X(lm[i].x), y: Y(lm[i].y) }), vis = (i) => (lm[i].visibility ?? 1) >= 0.4; const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const sL = P(11), sR = P(12), hL = P(23), hR = P(24), sM = { x: (sL.x + sR.x) / 2, y: (sL.y + sR.y) / 2 }, hM = { x: (hL.x + hR.x) / 2, y: (hL.y + hR.y) / 2 }; const hips = vis(23) && vis(24); const shoW = D(sL, sR), torso = hips ? D(sM, hM) : shoW * 1.5; const unit = Math.max(8, torso, shoW * 0.9);
  c.save(); if (o.alpha != null) c.globalAlpha = o.alpha; c.lineCap = 'round'; c.lineJoin = 'round'; const col = o.color || INK.body; const hl = o.hl || null; const colOf = (a, b) => (hl && (hl[`${a}-${b}`] || hl[`${b}-${a}`])) || null;
  if (o.floor !== false && vis(27)) { const fy = Math.min(oy + fh * 0.985, Y(Math.max(lm[31].y, lm[32].y) + 0.012)); c.fillStyle = o.floorColor || INK.floor; c.fillRect(box.x, fy, box.w, box.y + box.h - fy); c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(box.x, fy, box.w, 1); const aL = P(27), aR = P(28); c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse((aL.x + aR.x) / 2, fy + unit * 0.05, Math.max(unit * 0.5, Math.abs(aL.x - aR.x) * 0.7 + unit * 0.3), unit * 0.07, 0, 0, Math.PI * 2); c.fill(); }
  const n = P(0), hr = Math.max(3, unit * 0.235);
  if (o.dash) { // 모범 윤곽: 가는 점선
    c.setLineDash(o.dash); c.strokeStyle = col; c.lineWidth = o.lineW || Math.max(2, unit * 0.045);
    for (const [a, b] of CONNECTIONS) { if (!vis(a) || !vis(b)) continue; const pa = P(a), pb = P(b); c.beginPath(); c.moveTo(pa.x, pa.y); c.lineTo(pb.x, pb.y); c.stroke(); }
    c.beginPath(); c.arc(n.x, n.y, hr, 0, Math.PI * 2); c.stroke(); c.restore(); return { X, Y, fw, fh };
  }
  const k = o.lineW ? o.lineW / (unit * 0.17) : 1; // lineW를 주면 그 굵기를 위팔 굵기로 삼아 전체를 맞춘다
  const side = hips && shoW < torso * 0.4; const far = (i) => side && [12, 14, 16, 24, 26, 28, 32].includes(i);
  const limb = (a, b, wd) => { if (!vis(a) || !vis(b)) return; const pa = P(a), pb = P(b); const hc = colOf(a, b); c.strokeStyle = hc || col; c.globalAlpha = (o.alpha ?? 1) * (far(a) && !hc ? 0.62 : 1); c.lineWidth = Math.max(1.5, unit * wd * k); c.beginPath(); c.moveTo(pa.x, pa.y); c.lineTo(pb.x, pb.y); c.stroke(); c.globalAlpha = o.alpha ?? 1; };
  const order = side ? [2, 3, 6, 7, 9] : [4, 5, 6, 7, 8, 9]; for (const i of order) limb(...FIG_LIMBS[i]); // 먼 쪽 팔다리(또는 정면의 다리)를 먼저
  if (vis(11) && vis(12)) { const tc = colOf(11, 23) || colOf(12, 24) || colOf(11, 12); c.fillStyle = tc || col; c.strokeStyle = tc || col; c.lineWidth = Math.max(2, unit * (side ? 0.2 : 0.17) * k); c.beginPath(); const ins = side ? 0 : 0.12; const ax = sL.x + (sR.x - sL.x) * ins, ay = sL.y + (sR.y - sL.y) * ins, bx = sR.x + (sL.x - sR.x) * ins, by = sR.y + (sL.y - sR.y) * ins; c.moveTo(ax, ay); c.lineTo(bx, by); if (hips) { c.lineTo(hR.x, hR.y); c.lineTo(hL.x, hL.y); } else { const dx = (sR.x - sL.x), dy = (sR.y - sL.y), nx = -dy, ny = dx, sg = ny < 0 ? -1 : 1, dn = shoW * 1.05; c.lineTo(bx - dx * 0.08 + sg * nx / shoW * dn, by - dy * 0.08 + sg * ny / shoW * dn); c.lineTo(ax + dx * 0.08 + sg * nx / shoW * dn, ay + dy * 0.08 + sg * ny / shoW * dn); } c.closePath(); c.fill(); c.stroke(); }
  if (side) { for (const i of [4, 5, 8]) limb(...FIG_LIMBS[i]); for (const i of [0, 1]) limb(...FIG_LIMBS[i]); } else for (const i of [0, 1, 2, 3]) limb(...FIG_LIMBS[i]);
  if (vis(0)) { c.strokeStyle = col; c.lineWidth = Math.max(1.5, unit * 0.1 * k); c.beginPath(); c.moveTo(sM.x, sM.y); c.lineTo(n.x, n.y); c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(n.x, n.y, hr, 0, Math.PI * 2); c.fill(); }
  for (const i of [15, 16]) { if (!vis(i)) continue; const p = P(i); c.fillStyle = colOf(i === 15 ? 13 : 14, i) || col; c.globalAlpha = (o.alpha ?? 1) * (far(i) ? 0.62 : 1); c.beginPath(); c.arc(p.x, p.y, Math.max(1.5, unit * 0.075 * k), 0, Math.PI * 2); c.fill(); c.globalAlpha = o.alpha ?? 1; }
  if (o.joints !== false && unit > 26) { c.fillStyle = 'rgba(13,20,36,.55)'; for (const i of [13, 14, 25, 26]) { if (!vis(i)) continue; const p = P(i); c.beginPath(); c.arc(p.x, p.y, Math.max(1.2, unit * 0.035 * k), 0, Math.PI * 2); c.fill(); } }
  c.restore(); return { X, Y, fw, fh };
}
/** 활과 시위(양궁 장면을 알아보기 쉽게). m: drawFigure가 돌려준 좌표 변환 */
function drawBow(c, m, lm, o = {}) { const bw = lm[15], dw = lm[16], hip = lm[23]; if (bw.y > hip.y - 0.12) return; const x = m.X(bw.x), y = m.Y(bw.y), r = m.fh * 0.19, dx = m.X(dw.x), dy = m.Y(dw.y); c.save(); if (o.alpha != null) c.globalAlpha = o.alpha; c.lineCap = 'round'; c.strokeStyle = '#d0a56a'; c.lineWidth = Math.max(2.5, m.fh / 60); c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x + r * 0.55, y, x, y + r); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = Math.max(1, m.fh / 260); c.beginPath(); c.moveTo(x, y - r); c.lineTo(dx, dy); c.lineTo(x, y + r); c.stroke(); c.restore(); }
const segMap = (pairs, color) => { const m = {}; for (const [a, b] of pairs) m[`${a}-${b}`] = color; return m; };
function chip(c, text, x, y, o = {}) { const px = o.size || 13; c.font = `${o.weight || 800} ${px}px ${gfont()}`; const tw = c.measureText(text).width, ph = px + 12, pw = tw + 22; const bx = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2; c.fillStyle = o.bg || 'rgba(4,8,18,.66)'; rrect(c, bx, y - ph / 2, pw, ph, o.r ?? ph / 2); c.fill(); c.fillStyle = o.color || '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(text, bx + 11, y + 0.5); return pw; }
const GOOD_BG = 'rgba(21,150,96,.94)', BAD_BG = 'rgba(214,50,84,.94)';

/* ---------- 장면: 동작마다 "교정 전(틀린 동작)"과 "교정 후(바른 동작)" ---------- */
const ease01 = (u) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));
const cyc = (t, T = 2.6) => { const q = (t % T) / T; return q < 0.4 ? 0.5 - 0.5 * Math.cos(Math.PI * q / 0.4) : q < 0.55 ? 1 : q < 0.9 ? 0.5 + 0.5 * Math.cos(Math.PI * (q - 0.55) / 0.35) : 0; }; // 0→1→0 을 되풀이
const shotU = (q) => q < 0.3 ? ease01(q / 0.3) : q < 0.72 ? 1 : 1 - ease01((q - 0.72) / 0.28); // 양궁 한 번: 들어 올려 당기고 → 멈췄다가 → 내린다
const archeryShot = (q, o = {}) => lerpPose(standPose(), archeryPose(o), shotU(Math.max(0, Math.min(1, q))));
const handUpPose = () => armsPose({ ar: 0.75, armL: 172, foreL: 180, armR: 8, foreR: 4, legVis: 0.95, cy: 0.34 });
const LEGS = [[23, 25], [25, 27], [24, 26], [26, 28]], ARMS = [[11, 13], [13, 15], [12, 14], [14, 16]], TRUNK = [[11, 23], [12, 24]];
const SCENES = {
  match: { name: '모범 동작 따라 하기', short: '모범 따라 하기', ar: 0.75, cue: ['오른쪽 팔꿈치를 더 올리세요', '맞았어요!'], ghost: (t) => archeryShot(((t % 4.4) / 4.4) * 1.12 + 0.02), bow: true, key: 2.2,
    pose: (bad, t) => archeryShot((t % 4.4) / 4.4, bad ? { elbowDrop: 32, bowDrop: 10 } : {}), hl: (bad) => bad ? [[12, 14], [14, 16]] : ARMS },
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
  const bad = !!o.bad; paintBg(c, w, h); const tt = o.still ? (sc.key || 0) : t; const cueH = o.cue ? 36 : 0; const z = sc.bow ? 0.1 : 0; const box = { x: w * z, y: (o.label ? 8 : 0) + h * z * 0.6, w: w * (1 - 2 * z), h: (h - cueH - (o.label ? 8 : 0)) * (1 - z * 0.6) };
  if (sc.ghost && o.ghost !== false) drawFigure(c, sc.ghost(tt), box, { ar: sc.ar, color: INK.ghost, dash: [5, 5], floor: false });
  const lm = sc.pose(bad, tt);
  const m = drawFigure(c, lm, box, { ar: sc.ar, hl: segMap(sc.hl(bad), bad ? INK.bad : INK.good) }); if (sc.bow) drawBow(c, m, lm);
  if (o.label) chip(c, o.label, 10, 20, { align: 'left', size: 12, bg: bad ? BAD_BG : GOOD_BG });
  if (o.cue) chip(c, sc.cue[bad ? 0 : 1], w / 2, h - 20, { size: Math.min(15, Math.max(12, w / 16)), bg: bad ? BAD_BG : GOOD_BG });
}

/* ---------- 움직이는 그림 관리: 화면에 보이는 것만 다시 그린다 ---------- */
const Anim = {
  items: new Set(), raf: null, frame: 0,
  add(cv, fn) { const it = { cv, fn, last: -1 }; this.items.add(it); this.kick(); try { fn(performance.now() / 1000); } catch (e) { /* 아직 크기가 0일 수 있음 */ } return it; },
  kick() { if (this.raf) return; const step = (now) => { this.raf = null; this.frame++; const t = now / 1000; for (const it of [...this.items]) { if (!document.body.contains(it.cv)) { this.items.delete(it); continue; } if (it.cv.offsetParent === null) continue; if (REDUCED) { if (t - it.last < 2.5) continue; } else if (this.frame % 2) continue; it.last = t; try { it.fn(t); } catch (e) { /* 그림 하나의 오류가 화면 전체를 멈추지 않게 */ } } if (this.items.size) this.raf = requestAnimationFrame(step); }; this.raf = requestAnimationFrame(step); },
};
/** 동작 장면을 캔버스에 걸어 둔다 */
function mountScene(cv, id, o = {}) { const sc = sceneOf(id); return Anim.add(cv, (t) => { const { c, w, h } = fitCanvas(cv); if (id === 'race') raceDraw(c, w, h, t); else sceneDraw(c, w, h, sc, t, Object.assign({ still: REDUCED && !o.cue }, o)); }); }
/** 멈춘 모범(사진으로 만든 것)의 윤곽을 캔버스에 그린다 */
function templateToPose(tpl) { // 모범에 저장된 윤곽 좌표 → 33점 형식(그리기용)
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 })); const xs = tpl.sk.filter((p) => p[2] >= 4).map((p) => p[0] / 100), ys = tpl.sk.filter((p) => p[2] >= 4).map((p) => p[1] / 100);
  const minY = Math.min(...ys), maxY = Math.max(...ys), minX = Math.min(...xs), maxX = Math.max(...xs); const span = Math.max(maxY - minY, (maxX - minX) / 0.75, 1.6); const k = 0.78 / span; const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  SK_IDX.forEach((idx, j) => { const p = tpl.sk[j]; lm[idx] = { x: 0.5 + (p[0] / 100 - cx) * k / 0.75, y: 0.52 + (p[1] / 100 - cy) * k, z: 0, visibility: p[2] / 10 }; });
  for (const [a, b] of [[29, 27], [31, 27], [30, 28], [32, 28]]) lm[a] = Object.assign({}, lm[b], { visibility: 0 }); return lm;
}
function drawTemplate(cv, tpl, o = {}) { const { c, w, h } = fitCanvas(cv); paintBg(c, w, h); drawFigure(c, templateToPose(tpl), { x: 0, y: 0, w, h }, { ar: 0.75, floor: false, color: o.color || INK.good }); if (o.label) chip(c, o.label, 10, 20, { align: 'left', size: 12, bg: GOOD_BG }); }
/** 모범 동작(영상으로 만든 것)을 되풀이해서 보여 준다. 사진·영상이 아니라, 저장된 관절 움직임을 인물 그림으로 재생한다. */
function mountMotion(cv, tpl, o = {}) { const dec = unpackMotion(tpl); const T = dec.dur + 1.1; return Anim.add(cv, (t) => { const { c, w, h } = fitCanvas(cv); paintBg(c, w, h); const tau = REDUCED ? dec.dur * 0.5 : Math.min(dec.dur, Math.max(0, (t % T) - 0.35)); const bar = o.bar !== false && h > 90; drawFigure(c, motionPose(dec, tau), { x: 0, y: o.label ? 12 : 2, w, h: h - (bar ? 12 : 2) - (o.label ? 12 : 2) }, { ar: 0.75, floor: false, color: o.color || INK.good });
  if (o.label) chip(c, o.label, 10, 20, { align: 'left', size: 12, bg: GOOD_BG }); if (bar) { c.fillStyle = 'rgba(255,255,255,.16)'; rrect(c, 10, h - 9, w - 20, 4, 2); c.fill(); c.fillStyle = INK.good; rrect(c, 10, h - 9, Math.max(3, (w - 20) * tau / dec.dur), 4, 2); c.fill(); } }); }
/** 모범(동작이든 멈춘 자세든)을 캔버스에 건다 */
function mountModel(cv, mv, o = {}) { if (mv.kind === 'motion') return mountMotion(cv, mv.tpl, o); return Anim.add(cv, () => drawTemplate(cv, mv.tpl, o)); }

/* ---------- 첫 화면의 사용법 안내: 양궁 동작 하나로 처음부터 끝까지(4장면) ---------- */
const GUIDE = [
  { title: '모범 영상을 올린다', dur: 8, say: '교수님이 모범 동작을 찍은 영상을 올립니다. 인공지능이 영상 속 동작을 읽어서 모범으로 등록합니다.' },
  { title: '링크를 보낸다', dur: 6, say: '연습, 과제와 시험, 게임 중 하나를 고르면 링크가 나옵니다. 학생들에게는 링크만 보내면 됩니다.' },
  { title: '모범을 보며 따라 한다', dur: 8.4, say: '학생은 폰으로 링크를 열고, 모범 동작을 보면서 그대로 따라 합니다. 모범과 맞을 때만 횟수가 올라가고, 다른 곳은 그 자리에서 말로 알려 줍니다.' },
  { title: '결과가 모인다', dur: 6.5, say: '열 번 중 몇 번 맞았는지, 어디가 달랐는지 바로 나옵니다. 교수님 화면에는 학생들의 결과가 모입니다.' },
];
const GUIDE_STEPS = GUIDE.map((g) => g.title);
/** 안내 한 장면을 그린다. i: 장면 번호, q: 그 장면의 진행(0~1) */
function guideDraw(c, w, h, i, q) {
  paintBg(c, w, h); const U = Math.min(w, h * 1.5) / 100; const F = (px, wt = 800) => { c.font = `${wt} ${px}px ${gfont()}`; }; const T = (s, x, y, o = {}) => { F(o.size || 12, o.weight || 800); c.fillStyle = o.color || '#fff'; c.textAlign = o.align || 'left'; c.textBaseline = o.base || 'middle'; c.fillText(s, x, y); };
  const seg = (a, b) => Math.max(0, Math.min(1, (q - a) / (b - a)));
  if (i === 0) { // 찍어 둔 영상을 올린다 → AI가 동작을 읽는다 → 모범으로 등록
    const m = U * 4; const read = seg(0.42, 0.8), saved = q >= 0.84;
    const fx = w * 0.19, fy = m, fw = w * 0.62, fh = h - m * 2 - U * 11; const box = { x: fx, y: fy + U * 2, w: fw, h: fh - U * 8 }; c.fillStyle = 'rgba(255,255,255,.04)'; c.strokeStyle = saved ? INK.good : 'rgba(255,255,255,.3)'; c.lineWidth = 2; rrect(c, fx, fy, fw, fh, U * 3); c.fill(); c.stroke(); // 영상 틀
    const lm = saved ? archeryPose() : archeryShot((q / 0.84 * 2) % 1);
    if (!saved) { const fm = drawFigure(c, lm, box, { ar: 0.75, alpha: 1 - read * 0.55 }); drawBow(c, fm, lm, { alpha: 1 - read * 0.55 }); }
    if (read > 0 || saved) { const fm = drawFigure(c, lm, box, { ar: 0.75, color: INK.good, dash: [6, 6], floor: false, alpha: saved ? 1 : read }); if (saved) drawBow(c, fm, lm, { alpha: 0.5 }); }
    if (read > 0 && read < 1) { const sy = fy + fh * read; const g = c.createLinearGradient(0, sy - U * 8, 0, sy); g.addColorStop(0, 'rgba(47,208,138,0)'); g.addColorStop(1, 'rgba(47,208,138,.35)'); c.fillStyle = g; c.fillRect(fx + 2, sy - U * 8, fw - 4, U * 8); c.fillStyle = INK.good; c.fillRect(fx + 2, sy, fw - 4, 2); } // 읽어 내려가는 선
    if (!saved) { c.fillStyle = 'rgba(255,255,255,.2)'; rrect(c, fx + U * 4, fy + fh - U * 4, fw - U * 8, U * 1.2, U); c.fill(); c.fillStyle = '#fff'; rrect(c, fx + U * 4, fy + fh - U * 4, (fw - U * 8) * ((q / 0.84 * 2) % 1), U * 1.2, U); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(fx + U * 4, fy + U * 3.4); c.lineTo(fx + U * 4, fy + U * 7.4); c.lineTo(fx + U * 7.4, fy + U * 5.4); c.closePath(); c.fill(); T('찍어 둔 영상', fx + U * 9.4, fy + U * 5.6, { size: Math.max(11, U * 3.2), weight: 800, color: '#dfe6f1' }); }
    else { c.strokeStyle = INK.good; c.lineWidth = Math.max(3, U); c.lineCap = 'round'; const cx = fx + fw - U * 8, cy = fy + U * 8, r = U * 3.4; c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx - r * 0.25, cy + r * 0.7); c.lineTo(cx + r, cy - r * 0.8); c.stroke(); }
    chip(c, saved ? '모범 동작으로 등록' : read > 0 ? 'AI가 동작을 읽는 중' : '모범 영상을 올립니다', w / 2, h - m - U * 3.6, { size: Math.max(13, U * 3.6), bg: saved ? GOOD_BG : 'rgba(4,8,18,.78)' });
  } else if (i === 1) { // 방식 고르기 → 링크 하나가 여러 폰으로
    const modes = ['연습', '과제·시험', '게임']; const cw = w * 0.24, gap = w * 0.025, x0 = (w - (cw * 3 + gap * 2)) / 2, cy = h * 0.17, ch = Math.max(26, U * 9); const picked = q > 0.12;
    modes.forEach((mname, k) => { const x = x0 + k * (cw + gap); const on = k === 0 && picked; c.fillStyle = on ? INK.red : 'rgba(255,255,255,.08)'; c.strokeStyle = on ? INK.red : 'rgba(255,255,255,.2)'; c.lineWidth = 1.5; rrect(c, x, cy - ch / 2, cw, ch, U * 2.4); c.fill(); c.stroke(); T(mname, x + cw / 2, cy + 0.5, { size: Math.max(11, U * 3.2), weight: 800, align: 'center', color: on ? '#fff' : '#c5cfdd' }); });
    if (q > 0.04 && q < 0.2) { const u = seg(0.04, 0.2); c.strokeStyle = `rgba(255,255,255,${0.7 * (1 - u)})`; c.lineWidth = 2; c.beginPath(); c.arc(x0 + cw / 2, cy, U * (3 + 9 * u), 0, Math.PI * 2); c.stroke(); }
    const cx = w / 2, top = h * 0.42; const lu = seg(0.24, 0.34);
    if (lu > 0) { c.globalAlpha = lu; F(Math.max(13, U * 3.8), 900); const label = '참여 링크'; const tw = c.measureText(label).width + U * 14; c.fillStyle = '#fff'; rrect(c, cx - tw / 2, top - U * 4.6, tw, U * 9.2, U * 4.6); c.fill(); c.fillStyle = INK.red; c.beginPath(); c.arc(cx - tw / 2 + U * 5, top, U * 2.6, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - tw / 2 + U * 3.8, top + U * 1.1); c.lineTo(cx - tw / 2 + U * 6.2, top - U * 1.1); c.stroke(); T(label, cx + U * 2.4, top + 0.5, { size: Math.max(13, U * 3.8), weight: 900, align: 'center', color: '#141d33' }); c.globalAlpha = 1; }
    const nP = 6; for (let k = 0; k < nP; k++) { const px = w * (0.12 + 0.76 * k / (nP - 1)), py = h * (0.77 + 0.04 * Math.sin(k * 1.9)); const u = seg(0.36 + k * 0.07, 0.6 + k * 0.07); const got = u >= 1;
      if (lu > 0) { c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 1.5; c.setLineDash([4, 5]); c.beginPath(); c.moveTo(cx, top + U * 4.6); c.lineTo(px, py - U * 8.5); c.stroke(); c.setLineDash([]); }
      if (u > 0 && u < 1) { c.fillStyle = INK.bad; c.beginPath(); c.arc(cx + (px - cx) * u, top + U * 4.6 + (py - U * 8.5 - top - U * 4.6) * u, U * 1.3, 0, Math.PI * 2); c.fill(); }
      const pw = U * 8.6, ph = U * 15; c.fillStyle = got ? '#12362a' : '#1c2740'; c.strokeStyle = got ? INK.good : '#35425c'; c.lineWidth = 2; rrect(c, px - pw / 2, py - ph / 2, pw, ph, U * 1.6); c.fill(); c.stroke();
      if (got) { c.strokeStyle = INK.good; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(px - U * 2, py); c.lineTo(px - U * 0.4, py + U * 1.8); c.lineTo(px + U * 2.4, py - U * 2); c.stroke(); } }
  } else if (i === 2) { // 학생: 모범을 보며 따라 한다. 첫 번째는 팔꿈치가 낮아 '다름', 두 번째는 '맞음'
    const second = q >= 0.5; const lq = second ? (q - 0.5) / 0.5 : q / 0.5; const play = Math.max(0, Math.min(1, (lq - 0.06) / 0.78)); const judged = lq > 0.86; const holding = play > 0.34 && play < 0.72;
    const mx = w * 0.04, mw = w * 0.27, my = h * 0.12, mh = h * 0.76; c.fillStyle = 'rgba(255,255,255,.05)'; c.strokeStyle = play > 0 && play < 1 ? INK.good : 'rgba(255,255,255,.2)'; c.lineWidth = 1.5; rrect(c, mx, my, mw, mh, U * 2.4); c.fill(); c.stroke();
    T('모범', mx + U * 3, my + U * 4.2, { size: Math.max(11, U * 3.2), weight: 900 }); const ml = archeryShot(play); const mm = drawFigure(c, ml, { x: mx + 2, y: my + U * 7, w: mw - 4, h: mh - U * 12 }, { ar: 0.75, color: INK.good, floor: false, joints: false }); drawBow(c, mm, ml);
    c.fillStyle = 'rgba(255,255,255,.16)'; rrect(c, mx + U * 3, my + mh - U * 3.4, mw - U * 6, U * 1.1, U); c.fill(); c.fillStyle = INK.good; rrect(c, mx + U * 3, my + mh - U * 3.4, Math.max(2, (mw - U * 6) * play), U * 1.1, U); c.fill();
    const box = { x: w * 0.33, y: h * 0.02, w: w * 0.5, h: h * 0.82 }; const sp = Math.max(0, Math.min(1, (lq - 0.1) / 0.78)); const sl = archeryShot(sp, second ? {} : { elbowDrop: 34, bowDrop: 6 });
    drawFigure(c, ml, box, { ar: 0.75, color: INK.ghost, dash: [5, 5], floor: false });
    const bad = !second && sp > 0.2 && sp < 0.9; const sm = drawFigure(c, sl, box, { ar: 0.75, hl: sp > 0.12 && sp < 0.95 ? segMap(bad ? [[12, 14], [14, 16]] : ARMS, bad ? INK.bad : INK.good) : null }); drawBow(c, sm, sl);
    const done = (second ? 4 : 3) - (judged ? 0 : 1), hits = second ? (judged ? 3 : 2) : 2; T(`${done}`, w - U * 14, h * 0.17, { size: Math.max(30, U * 13), weight: 900, align: 'right' }); T('/ 10번', w - U * 13, h * 0.2, { size: Math.max(11, U * 3.2), color: INK.dim }); T(`맞음 ${hits}`, w - U * 4, h * 0.32, { size: Math.max(12, U * 3.6), weight: 900, align: 'right', color: INK.good });
    if (judged) chip(c, second ? '맞았어요! 94%' : '다름 · 팔꿈치가 낮았어요', box.x + box.w / 2, h - U * 6.5, { size: Math.max(13, U * 3.8), bg: second ? GOOD_BG : BAD_BG });
    else if (bad && holding) chip(c, '오른쪽 팔꿈치를 더 올리세요', box.x + box.w / 2, h - U * 6.5, { size: Math.max(13, U * 3.8), bg: BAD_BG });
    else if (lq < 0.06) chip(c, second ? '4번째 준비' : '3번째 준비', box.x + box.w / 2, h - U * 6.5, { size: Math.max(13, U * 3.8) });
  } else { // 결과: 왼쪽은 학생 자신의 결과, 오른쪽은 만든 사람(교수) 화면
    const pad = w * 0.04, gapX = w * 0.03, cwid = (w - pad * 2 - gapX) / 2, top = h * 0.08, ch = h * 0.84; const card = (x, title) => { c.fillStyle = 'rgba(255,255,255,.05)'; c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1.5; rrect(c, x, top, cwid, ch, U * 2.6); c.fill(); c.stroke(); T(title, x + U * 4, top + U * 5.4, { size: Math.max(11, U * 3.1), color: INK.dim }); };
    const u1 = seg(0, 0.14); c.globalAlpha = 0.25 + 0.75 * u1; card(pad, '학생이 받는 결과'); const x = pad + U * 4;
    T('7', x, top + U * 21.5, { size: Math.max(30, U * 13), weight: 900, base: 'alphabetic' }); F(Math.max(30, U * 13), 900); const w7 = c.measureText('7').width; T('/ 10번 맞음', x + w7 + U * 2, top + U * 20.5, { size: Math.max(12, U * 3.6), weight: 800, color: '#c5cfdd', base: 'alphabetic' });
    const pattern = [1, 0, 1, 1, 0, 1, 1, 1, 0, 1], dw = (cwid - U * 8) / 10; pattern.forEach((ok, k) => { const show = seg(0.12 + k * 0.025, 0.16 + k * 0.025); if (show <= 0) return; c.fillStyle = ok ? INK.good : INK.bad; c.beginPath(); c.arc(x + dw * (k + 0.5), top + U * 27.5, Math.max(3, Math.min(dw * 0.34, U * 2)), 0, Math.PI * 2); c.fill(); });
    const rows1 = [['오른쪽 팔꿈치', '당길 때 18° 낮음'], ['상체', '끝에서 6° 기울어짐']]; rows1.forEach(([a, b], k) => { const show = seg(0.34 + k * 0.1, 0.44 + k * 0.1); if (show <= 0) return; const y = top + U * 37 + k * U * 10.5; c.globalAlpha = show; c.fillStyle = k ? 'rgba(255,184,77,.16)' : 'rgba(255,92,122,.18)'; rrect(c, x - U, y - U * 4.4, cwid - U * 6, U * 8.8, U * 2); c.fill(); T(a, x + U * 1.4, y - U * 1.5, { size: Math.max(11, U * 3.2), weight: 900, color: k ? INK.warn : INK.bad }); T(b, x + U * 1.4, y + U * 2, { size: Math.max(10, U * 2.8), weight: 600, color: '#dfe6f1' }); c.globalAlpha = 1; });
    c.globalAlpha = 1; card(pad + cwid + gapX, '교수님 화면 · 낮은 점수부터'); const x2 = pad + cwid + gapX + U * 4; const list = [[4, INK.bad], [5, INK.bad], [7, '#fff'], [9, '#fff'], [10, '#fff']]; const rh = (ch - U * 13) / list.length;
    list.forEach(([hit, colr], k) => { const show = seg(0.05 + k * 0.05, 0.12 + k * 0.05); if (show <= 0) return; const y = top + U * 10 + k * rh; c.globalAlpha = show; c.fillStyle = hit < 6 ? 'rgba(255,92,122,.16)' : 'rgba(255,255,255,.05)'; rrect(c, x2 - U, y, cwid - U * 6, rh - U * 1.6, U * 2); c.fill(); const cyy = y + (rh - U * 1.6) / 2; c.fillStyle = hit < 6 ? INK.bad : '#3a4862'; c.beginPath(); c.arc(x2 + U * 3, cyy, U * 2.1, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,.3)'; rrect(c, x2 + U * 7, cyy - U * 0.9, U * (10 + (k * 5) % 8), U * 1.8, U); c.fill(); T(`${hit}/10`, x2 + cwid - U * 9, cyy + 0.5, { size: Math.max(12, U * 3.6), weight: 900, align: 'right', color: colr }); c.globalAlpha = 1; });
  }
}
/** 안내 재생기: 장면 넘기기, 장면 고르기, 소리로 설명 듣기(기기에 들어 있는 목소리) */
const Guide = { i: 0, t0: null, sound: false, speaking: false, btn: null, spans: [] };
function guideSpeak(text) { if (!('speechSynthesis' in window)) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.rate = 1.0; const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith('ko')); if (v) u.voice = v; Guide.speaking = true; u.onend = u.onerror = () => { Guide.speaking = false; }; speechSynthesis.speak(u); } catch (e) { Guide.speaking = false; } }
function guideSetSound(on) { Guide.sound = !!on && ('speechSynthesis' in window); if (!Guide.sound) { Guide.speaking = false; try { speechSynthesis.cancel(); } catch (e) { /* 소리 기능이 없는 기기 */ } } if (Guide.btn) { Guide.btn.innerHTML = Guide.sound ? `${ICON.mute} 소리 끄기` : `${ICON.sound} 소리로 설명 듣기`; Guide.btn.setAttribute('aria-pressed', String(Guide.sound)); } }
function guideGo(i, restart) { Guide.i = ((i % GUIDE.length) + GUIDE.length) % GUIDE.length; Guide.t0 = null; if (Guide.sound && restart !== false) guideSpeak(GUIDE[Guide.i].say); Guide.spans.forEach((s, k) => s.classList.toggle('cur', k === Guide.i)); }
function guideStop() { if (Guide.sound) guideSetSound(false); }
function mountGuide(cv, stepsEl, btn) {
  stepsEl.innerHTML = GUIDE.map((g, k) => `<button type="button" data-k="${k}"><b>${k + 1}</b>${g.title}</button>`).join(''); Guide.spans = [...stepsEl.children]; Guide.btn = btn || null;
  Guide.spans.forEach((s, k) => s.addEventListener('click', () => guideGo(k)));
  if (btn) { if (!('speechSynthesis' in window)) btn.hidden = true; btn.addEventListener('click', () => { const on = !Guide.sound; guideSetSound(on); if (on) { try { speechSynthesis.getVoices(); } catch (e) { /* 무시 */ } guideGo(0); } }); guideSetSound(false); }
  guideGo(0, false);
  return Anim.add(cv, (t) => { const { c, w, h } = fitCanvas(cv); if (REDUCED && !Guide.sound) { guideDraw(c, w, h, Guide.i, [0.92, 0.95, 0.42, 0.98][Guide.i]); if (Guide.t0 == null) Guide.t0 = t; if (t - Guide.t0 > 5) guideGo(Guide.i + 1, false); return; }
    if (Guide.t0 == null) Guide.t0 = t; let el = t - Guide.t0; const g = GUIDE[Guide.i];
    if (el >= g.dur && !(Guide.sound && Guide.speaking && el < g.dur + 12)) { const next = Guide.i + 1; if (Guide.sound && next >= GUIDE.length) { guideSetSound(false); } guideGo(next); Guide.t0 = t; el = 0; }
    guideDraw(c, w, h, Guide.i, Math.min(1, el / GUIDE[Guide.i].dur)); });
}
