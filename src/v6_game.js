/* ================= 게임 그림: 직접 그린 캐릭터와 경주 트랙 =================
 * 캐릭터는 모두 이 프로그램 안에서 선과 면으로 그린다(그림 파일 없음, 다른 작품의 캐릭터 아님).
 * 트랙: 내 캐릭터는 정확한 동작을 한 번 할 때마다 앞으로 간다. 상대는 "기록의 주인"(이 링크에서 먼저 한 사람들) 또는 정해진 빠르기로 달리는 페이스 메이커.
 */
const CHARS = [
  { id: 'rabbit', em: '🐰', name: '토리', body: '#ffffff', accent: '#ffd0dc', ear: 'long' },
  { id: 'bear', em: '🐻', name: '곰곰', body: '#b88355', accent: '#f0d6b6', ear: 'round' },
  { id: 'fox', em: '🦊', name: '여울', body: '#ff8a3d', accent: '#fff3e6', ear: 'point' },
  { id: 'panda', em: '🐼', name: '판이', body: '#ffffff', accent: '#ffffff', ear: 'round', dark: '#2b3142' },
  { id: 'tiger', em: '🐯', name: '호야', body: '#ffb526', accent: '#fff4d9', ear: 'round', stripe: '#3a2a12' },
  { id: 'frog', em: '🐸', name: '개굴', body: '#57c76a', accent: '#e9ffd8', ear: 'bump' },
  { id: 'penguin', em: '🐧', name: '펭이', body: '#34425f', accent: '#ffffff', ear: 'none', beak: '#ffb526' },
  { id: 'cat', em: '🐱', name: '나비', body: '#9aa6bd', accent: '#ffffff', ear: 'point', whisker: true },
];
const AVATARS = CHARS.map((ch) => ch.em);
const charOf = (em) => CHARS.find((ch) => ch.em === em || ch.id === em) || CHARS[0];
/** 캐릭터 한 마리. (x, y)는 발밑 가운데, s는 키. o.state: run(달리기)·idle·cheer(만세)·oops(실수), o.t: 시각(초), o.flip: 왼쪽 보기 */
function drawChar(c, ch, x, y, s, o = {}) {
  const st = o.state || 'idle', t = o.t || 0; const ph = (t * (st === 'run' ? 2.6 : 1.2)) % 1; const hop = st === 'run' ? Math.abs(Math.sin(ph * Math.PI * 2)) * s * 0.06 : st === 'cheer' ? Math.abs(Math.sin(t * 6)) * s * 0.16 : Math.sin(t * 2.2) * s * 0.012;
  const bw = s * 0.7, bh = s * 0.74, cy = y - s * 0.12 - bh / 2 - hop; const dark = ch.dark || '#2b3142';
  c.save(); c.translate(x, 0); if (o.flip) c.scale(-1, 1); if (o.alpha != null) c.globalAlpha = o.alpha; c.lineCap = 'round'; c.lineJoin = 'round';
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(0, y, bw * (0.46 - hop / s), s * 0.045, 0, 0, Math.PI * 2); c.fill();
  // 발: 달릴 때 번갈아 앞뒤로
  const fo = st === 'run' ? Math.sin(ph * Math.PI * 2) * s * 0.13 : 0; c.fillStyle = ch.dark || ch.body; for (const [dx, lift] of [[-s * 0.14 + fo, Math.max(0, -Math.sin(ph * Math.PI * 2))], [s * 0.14 - fo, Math.max(0, Math.sin(ph * Math.PI * 2))]]) { c.beginPath(); c.ellipse(dx, y - s * 0.05 - lift * s * 0.07 - (st === 'cheer' ? hop : 0), s * 0.12, s * 0.075, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(20,29,51,.35)'; c.lineWidth = Math.max(1, s * 0.02); c.stroke(); }
  // 귀
  const ear = (dx, kind) => { c.fillStyle = ch.dark || ch.body; c.strokeStyle = 'rgba(20,29,51,.35)'; c.lineWidth = Math.max(1, s * 0.02);
    if (kind === 'long') { c.beginPath(); c.ellipse(dx * 0.62, cy - bh * 0.62, s * 0.085, s * 0.24, dx > 0 ? 0.16 : -0.16, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = ch.accent; c.beginPath(); c.ellipse(dx * 0.62, cy - bh * 0.6, s * 0.04, s * 0.16, dx > 0 ? 0.16 : -0.16, 0, Math.PI * 2); c.fill(); }
    else if (kind === 'round') { c.beginPath(); c.arc(dx, cy - bh * 0.4, s * 0.12, 0, Math.PI * 2); c.fill(); c.stroke(); if (!ch.dark) { c.fillStyle = ch.accent; c.beginPath(); c.arc(dx, cy - bh * 0.4, s * 0.06, 0, Math.PI * 2); c.fill(); } }
    else if (kind === 'point') { const sg = Math.sign(dx); c.beginPath(); c.moveTo(dx - sg * s * 0.13, cy - bh * 0.36); c.lineTo(dx + sg * s * 0.06, cy - bh * 0.72); c.lineTo(dx + sg * s * 0.1, cy - bh * 0.24); c.closePath(); c.fill(); c.stroke(); }
    else if (kind === 'bump') { c.beginPath(); c.arc(dx * 0.78, cy - bh * 0.44, s * 0.125, 0, Math.PI * 2); c.fill(); c.stroke(); } };
  if (ch.ear !== 'none') { ear(-bw * 0.36, ch.ear); ear(bw * 0.36, ch.ear); }
  // 팔: 만세일 때 위로
  c.strokeStyle = ch.dark || ch.body; c.lineWidth = s * 0.1; const armA = st === 'cheer' ? -1.0 : st === 'run' ? 0.5 + Math.sin(ph * Math.PI * 2) * 0.5 : 0.75; for (const sg of [-1, 1]) { const a = sg === 1 && st === 'run' ? 1 - armA + 0.5 : armA; c.beginPath(); c.moveTo(sg * bw * 0.42, cy + bh * 0.08); c.lineTo(sg * (bw * 0.42 + Math.cos(a) * s * 0.12), cy + bh * 0.08 + Math.sin(a) * s * 0.16); c.stroke(); }
  // 몸(머리와 한 덩어리)
  c.fillStyle = ch.body; c.strokeStyle = 'rgba(20,29,51,.35)'; c.lineWidth = Math.max(1.2, s * 0.022); c.beginPath(); c.ellipse(0, cy, bw / 2, bh / 2, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.save(); c.beginPath(); c.ellipse(0, cy, bw / 2, bh / 2, 0, 0, Math.PI * 2); c.clip();
  if (ch.id === 'penguin') { c.fillStyle = ch.accent; c.beginPath(); c.ellipse(s * 0.02, cy + bh * 0.12, bw * 0.36, bh * 0.44, 0, 0, Math.PI * 2); c.fill(); } else if (ch.id !== 'panda') { c.fillStyle = ch.accent; c.beginPath(); c.ellipse(0, cy + bh * 0.36, bw * 0.3, bh * 0.24, 0, 0, Math.PI * 2); c.fill(); }
  if (ch.id === 'fox') { c.fillStyle = ch.accent; c.beginPath(); c.ellipse(0, cy + bh * 0.02, bw * 0.44, bh * 0.2, 0, 0, Math.PI); c.fill(); }
  if (ch.stripe) { c.strokeStyle = ch.stripe; c.lineWidth = s * 0.032; for (const dx of [-0.11, 0, 0.11]) { c.beginPath(); c.moveTo(dx * s, cy - bh * 0.5); c.lineTo(dx * s * 0.9, cy - bh * 0.34 + Math.abs(dx) * s * 0.3); c.stroke(); } }
  // 머리띠(운동 느낌): 동서대 빨강
  c.fillStyle = '#e01838'; c.fillRect(-bw / 2, cy - bh * 0.3, bw, s * 0.065); c.restore();
  c.fillStyle = '#e01838'; c.beginPath(); c.moveTo(bw * 0.46, cy - bh * 0.28); c.lineTo(bw * 0.62, cy - bh * 0.36 + Math.sin(t * 9) * s * 0.012); c.lineTo(bw * 0.6, cy - bh * 0.2 + Math.sin(t * 9 + 1) * s * 0.012); c.closePath(); c.fill();
  // 얼굴
  const ex = bw * 0.17, ey = cy - bh * 0.07; if (ch.id === 'panda') { c.fillStyle = dark; for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(sg * ex, ey, s * 0.075, s * 0.095, sg * 0.4, 0, Math.PI * 2); c.fill(); } }
  c.strokeStyle = ch.id === 'panda' ? '#fff' : '#1d2740'; c.fillStyle = ch.id === 'panda' ? '#fff' : '#1d2740'; c.lineWidth = Math.max(1.4, s * 0.03);
  for (const sg of [-1, 1]) { if (st === 'cheer') { c.beginPath(); c.arc(sg * ex, ey + s * 0.012, s * 0.04, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); } else if (st === 'oops') { const r = s * 0.032; c.beginPath(); c.moveTo(sg * ex - r, ey - r); c.lineTo(sg * ex + r, ey + r); c.moveTo(sg * ex + r, ey - r); c.lineTo(sg * ex - r, ey + r); c.stroke(); } else { c.beginPath(); c.arc(sg * ex, ey, s * 0.034, 0, Math.PI * 2); c.fill(); } }
  c.fillStyle = 'rgba(255,120,150,.55)'; for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(sg * bw * 0.3, ey + s * 0.085, s * 0.05, s * 0.032, 0, 0, Math.PI * 2); c.fill(); }
  if (ch.beak) { c.fillStyle = ch.beak; c.beginPath(); c.moveTo(-s * 0.05, ey + s * 0.05); c.lineTo(s * 0.05, ey + s * 0.05); c.lineTo(0, ey + s * 0.12); c.closePath(); c.fill(); }
  else { c.strokeStyle = '#1d2740'; c.lineWidth = Math.max(1.2, s * 0.024); c.beginPath(); if (st === 'oops') c.arc(0, ey + s * 0.11, s * 0.028, 0, Math.PI * 2); else if (st === 'cheer') { c.arc(0, ey + s * 0.07, s * 0.06, 0.1, Math.PI - 0.1); c.closePath(); c.fillStyle = '#ff6b86'; c.fill(); } else c.arc(0, ey + s * 0.06, s * 0.045, 0.25, Math.PI - 0.25); c.stroke(); }
  if (ch.whisker) { c.strokeStyle = 'rgba(29,39,64,.5)'; c.lineWidth = 1; for (const sg of [-1, 1]) for (const dy of [0, 0.03]) { c.beginPath(); c.moveTo(sg * bw * 0.26, ey + s * (0.07 + dy)); c.lineTo(sg * bw * 0.46, ey + s * (0.055 + dy * 1.8)); c.stroke(); } }
  c.restore();
}
/** 깃발 무늬(결승선) */
function drawChecker(c, x, y, w, h, n = 3) { const cs = h / (n * 2); for (let r = 0; r * cs < h; r++) for (let q = 0; q * cs < w; q++) { c.fillStyle = (r + q) % 2 ? '#fff' : '#141d33'; c.fillRect(x + q * cs, y + r * cs, Math.min(cs, w - q * cs), Math.min(cs, h - r * cs)); } }
/** 경주 트랙. lanes: [{ch, name, prog(0~1), label, me, state}] */
function drawTrack(c, w, h, lanes, t, o = {}) {
  const n = lanes.length; const pad = Math.max(6, h * 0.06); const lh = (h - pad * 2) / n; const x0 = w * 0.1, x1 = w * 0.9;
  c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(10,16,30,.72)'; rrect(c, 0, 0, w, h, o.r ?? 14); c.fill();
  lanes.forEach((ln, i) => { const y = pad + i * lh, base = y + lh * 0.86; c.fillStyle = ln.me ? 'rgba(224,24,56,.24)' : 'rgba(255,255,255,.05)'; rrect(c, 6, y + 2, w - 12, lh - 4, 8); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 1.5; c.setLineDash([6, 7]); c.beginPath(); c.moveTo(x0, base); c.lineTo(x1, base); c.stroke(); c.setLineDash([]);
    const s = Math.min(lh * 0.92, w * 0.11); const px = x0 + (x1 - x0) * Math.max(0, Math.min(1, ln.prog)); drawChar(c, ln.ch, px, base, s, { state: ln.state || (ln.prog >= 1 ? 'cheer' : ln.moving ? 'run' : 'idle'), t: t + i * 0.37 });
    if (w >= 230) { c.font = `800 ${Math.max(10, Math.min(13, lh * 0.34))}px ${gfont()}`; c.textBaseline = 'top'; c.textAlign = 'left'; c.fillStyle = ln.me ? '#fff' : '#b9c4d6'; c.fillText(ln.name, 12, y + 5); c.textAlign = 'right'; c.fillText(ln.label || '', w - 12 - Math.min(18, lh * 0.5), y + 5); } });
  drawChecker(c, x1 + 3, pad, Math.max(8, w * 0.02), h - pad * 2, Math.max(3, n * 2));
}
/** 첫 화면·안내에 쓰는 게임 장면: 세 캐릭터가 달리고, 아래에서는 사람들이 스쿼트를 한다 */
function raceDraw(c, w, h, t) {
  paintBg(c, w, h); const sp = [1.5, 1.85, 2.3], T = 13, tt = t % T, goal = 6; const prog = sp.map((s) => Math.min(1, tt / (s * goal))); const th = Math.min(h * 0.46, 150);
  drawTrack(c, w, th, [0, 1, 2].map((i) => ({ ch: CHARS[[0, 2, 5][i]], name: ['나', '2조', '3조'][i], prog: prog[i], moving: prog[i] < 1 && tt > 0.2, me: i === 0, label: `${Math.min(goal, Math.floor(tt / sp[i]))}/${goal}` })), t, { r: 0 });
  for (let i = 0; i < 3; i++) { const bx = { x: w * i / 3, y: th + 2, w: w / 3, h: h - th - 2 }; const done = prog[i] >= 1; const u = done ? 0 : cyc(tt, sp[i]); drawFigure(c, squatPose(174 - 86 * u, 10 + 26 * u), bx, { ar: 0.75, hl: segMap(LEGS, done ? INK.warn : INK.good) }); }
}
SCENES.race = { name: '다 같이 시합', race: true };
/** 캐릭터 고르기 버튼 묶음. onPick(번호) */
function renderCharPicker(el, cur, onPick) {
  el.innerHTML = CHARS.map((ch, i) => `<button type="button" class="charbtn" data-i="${i}" aria-pressed="${i === cur}" aria-label="${ch.name}"><canvas width="96" height="96"></canvas><span>${ch.name}</span></button>`).join('');
  [...el.children].forEach((b, i) => { const cv = b.querySelector('canvas'); Anim.add(cv, (t) => { const c = cv.getContext('2d'); c.clearRect(0, 0, 96, 96); drawChar(c, CHARS[i], 48, 88, 78, { state: b.getAttribute('aria-pressed') === 'true' ? 'run' : 'idle', t }); }); b.addEventListener('click', () => { [...el.children].forEach((x) => x.setAttribute('aria-pressed', String(x === b))); onPick(i); }); });
}
/** 색종이: 결승선을 넘었을 때 */
function confetti(c, w, h, t0, t) { const el = t - t0; if (el > 3) return; const cols = ['#e01838', '#ffb84d', '#2fd08a', '#5aa9ff', '#ffffff']; for (let i = 0; i < 46; i++) { const sx = (i * 73 % 100) / 100 * w, vx = ((i * 37) % 21 - 10) * 6, vy = 60 + (i * 53 % 90); const x = sx + vx * el, y = -10 + vy * el + 120 * el * el * 0.5; if (y > h) continue; c.fillStyle = cols[i % cols.length]; c.save(); c.translate(x, y); c.rotate(el * (2 + i % 5)); c.fillRect(-4, -2, 8, 4); c.restore(); } }
