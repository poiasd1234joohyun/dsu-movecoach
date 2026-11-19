/* ===== DSU 무브코치 가상 동작 데이터 (DOM 없음) =====
 * 실제 사람·실제 영상이 아니라, 관절 좌표를 계산으로 만들어 내는 "가상 인물"이다.
 * 쓰는 곳: ① 카메라 없이 보는 시연 ② 샘플 수업방의 가상 학생 기록 ③ 자동 점검(tests)
 * 좌표 단위: 1.0 = 화면 높이. ar = 화면 가로/세로 비율.
 */
import { makeAnalyzer } from './engine.mjs';

const RAD = Math.PI / 180;
const c01 = (v) => Math.max(0, Math.min(1, v));
const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * c01(u)); // 천천히 시작해서 천천히 멈춤

function blank(n, v) { return Array.from({ length: 33 }, () => ({ x: n.x, y: n.y, z: 0, visibility: v })); }
function put(lm, i, p, ar, v = 0.95) { lm[i] = { x: 0.5 + p.x / ar, y: p.y, z: 0, visibility: v }; }

/** 옆에서 본 스쿼트. theta: 무릎 각도(175=서 있음, 90=깊이 앉음), trunk: 상체 기울기(도) */
export function squatPose(theta, trunk, o = {}) {
  const ar = o.ar || 0.75, ox = o.ox || 0;
  const depth = c01((175 - theta) / 95);
  const s = (4 + 24 * depth) * RAD;                                   // 정강이가 앞으로 기운 정도
  const A = { x: ox - 0.02, y: 0.9 };
  const K = { x: A.x + 0.21 * Math.sin(s), y: A.y - 0.21 * Math.cos(s) };
  const phi = Math.atan2(Math.cos(s), -Math.sin(s)) + theta * RAD;    // 무릎→엉덩이 방향
  const Hp = { x: K.x + 0.21 * Math.cos(phi), y: K.y + 0.21 * Math.sin(phi) };
  const tr = trunk * RAD;
  const Sh = { x: Hp.x + 0.25 * Math.sin(tr), y: Hp.y - 0.25 * Math.cos(tr) };
  const N = { x: Sh.x + 0.03 + 0.06 * Math.sin(tr), y: Sh.y - 0.02 - 0.075 * Math.cos(tr) };
  let E, Wr;
  if (o.handsUp) { E = { x: Sh.x + 0.03, y: Sh.y - 0.12 }; Wr = { x: Sh.x + 0.04, y: Sh.y - 0.25 }; }
  else {
    const ua = (12 + 58 * depth) * RAD, fa = (70 + 25 * depth) * RAD;  // 내려갈수록 팔을 앞으로 뻗어 균형
    E = { x: Sh.x + 0.13 * Math.sin(ua), y: Sh.y + 0.13 * Math.cos(ua) };
    Wr = { x: E.x + 0.12 * Math.sin(fa), y: E.y + 0.12 * Math.cos(fa) };
  }
  const heel = { x: A.x - 0.03, y: A.y + 0.025 }, toe = { x: A.x + 0.085, y: A.y + 0.03 };
  const lm = blank({ x: 0.5 + N.x / ar, y: N.y }, 0.95);
  const far = (p) => ({ x: p.x + 0.012, y: p.y + 0.004 });           // 반대쪽 팔다리는 살짝 뒤에
  put(lm, 0, N, ar); for (const i of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) put(lm, i, { x: N.x - 0.01 + (i % 3) * 0.008, y: N.y - 0.012 }, ar);
  put(lm, 11, Sh, ar); put(lm, 12, far(Sh), ar); put(lm, 13, E, ar); put(lm, 14, far(E), ar); put(lm, 15, Wr, ar); put(lm, 16, far(Wr), ar);
  for (const i of [17, 19, 21]) put(lm, i, { x: Wr.x + 0.015, y: Wr.y + 0.005 }, ar); for (const i of [18, 20, 22]) put(lm, i, far({ x: Wr.x + 0.015, y: Wr.y + 0.005 }), ar);
  put(lm, 23, Hp, ar); put(lm, 24, far(Hp), ar); put(lm, 25, K, ar); put(lm, 26, far(K), ar); put(lm, 27, A, ar); put(lm, 28, far(A), ar);
  put(lm, 29, heel, ar); put(lm, 30, far(heel), ar); put(lm, 31, toe, ar); put(lm, 32, far(toe), ar);
  return lm;
}

/** 정면에서 본 "앉아서 팔 뻗기". uL·uR: 0=양손 어깨 옆, 1=머리 위로 다 뻗음. o.maxElbow: 다 뻗었을 때 팔꿈치 각도 */
export function pressPose(uL, uR, o = {}) {
  const ar = o.ar || 4 / 3, tilt = (o.tilt || 0) * RAD, maxElbow = o.maxElbow ?? 174, cy = o.cy ?? 0.58;
  const N = { x: 0, y: cy - 0.115 };
  const lm = blank({ x: 0.5, y: N.y }, 0.95);
  put(lm, 0, N, ar); for (const i of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) put(lm, i, { x: -0.02 + (i % 5) * 0.01, y: N.y - 0.015 }, ar);
  const arm = (sign, u) => {
    const Sh = { x: sign * 0.105, y: cy + sign * 0.105 * Math.tan(tilt) };
    const b = (60 + 105 * ease(u)) * RAD;                             // 위팔: 아래(0°)에서 바깥·위로 도는 각
    const e = (62 + (maxElbow - 62) * ease(u)) * RAD;                 // 팔꿈치 각도
    const g = b + Math.PI - e;                                        // 아래팔 방향
    const E = { x: Sh.x + sign * 0.15 * Math.sin(b), y: Sh.y + 0.15 * Math.cos(b) };
    const Wr = { x: E.x + sign * 0.14 * Math.sin(g), y: E.y + 0.14 * Math.cos(g) };
    return { Sh, E, Wr };
  };
  const L = arm(1, uL), R = arm(-1, uR);
  put(lm, 11, L.Sh, ar); put(lm, 13, L.E, ar); put(lm, 15, L.Wr, ar); put(lm, 12, R.Sh, ar); put(lm, 14, R.E, ar); put(lm, 16, R.Wr, ar);
  for (const i of [17, 19, 21]) put(lm, i, { x: L.Wr.x, y: L.Wr.y - 0.015 }, ar); for (const i of [18, 20, 22]) put(lm, i, { x: R.Wr.x, y: R.Wr.y - 0.015 }, ar);
  const low = o.hipVis ?? 0.3;                                         // 책상에 가려 잘 안 보이는 하체
  put(lm, 23, { x: 0.075, y: cy + 0.3 }, ar, low); put(lm, 24, { x: -0.075, y: cy + 0.3 }, ar, low);
  for (const [i, x, y] of [[25, 0.08, 0.5], [26, -0.08, 0.5], [27, 0.08, 0.62], [28, -0.08, 0.62], [29, 0.08, 0.64], [30, -0.08, 0.64], [31, 0.09, 0.66], [32, -0.09, 0.66]]) put(lm, i, { x, y: cy + y }, ar, 0.05);
  return lm;
}

/** 반복 계획 → 시간(초)에 따른 진행 정도. plan: [{down, hold, up, rest, ...값}] */
export function repTimeline(plan, lead = 1.2) {
  const segs = []; let t = lead;
  plan.forEach((r, i) => { const down = r.down ?? 1.1, hold = r.hold ?? 0.25, up = r.up ?? 0.9, rest = r.rest ?? 0.45; segs.push({ i, r, t0: t, down, hold, up }); t += down + hold + up + rest; });
  return {
    duration: t + 0.6,
    at(el) { // 반환: {r, u} — u는 0(시작 자세)~1(가장 깊은 지점)
      for (const s of segs) {
        const d = el - s.t0; if (d < 0) break;
        if (d <= s.down) return { r: s.r, u: ease(d / s.down) };
        if (d <= s.down + s.hold) return { r: s.r, u: 1 };
        if (d <= s.down + s.hold + s.up) return { r: s.r, u: 1 - ease((d - s.down - s.hold) / s.up) };
      }
      return { r: null, u: 0 };
    },
  };
}

/** 스쿼트 계획: [{bottom:무릎 최저각, trunk:그때 상체 기울기, down, hold, up, rest}] → (초)=>좌표 */
export function squatScript(plan, o = {}) {
  const tl = repTimeline(plan, o.lead); const top = 174, trunkTop = o.trunkTop ?? 10;
  const fn = (el) => { const { r, u } = tl.at(el); if (!r) return squatPose(top, trunkTop, o); return squatPose(top + (r.bottom - top) * u, trunkTop + (r.trunk - trunkTop) * u, o); };
  fn.duration = tl.duration; return fn;
}

/** 팔 뻗기 계획: [{maxElbow, right:오른팔 비율(1=같게), tilt, down, hold, up, rest}] → (초)=>좌표 */
export function pressScript(plan, o = {}) {
  const tl = repTimeline(plan, o.lead);
  const fn = (el) => { const { r, u } = tl.at(el); if (!r) return pressPose(0, 0, o); return pressPose(u, u * (r.right ?? 1), Object.assign({}, o, { maxElbow: r.maxElbow ?? 174, tilt: (r.tilt || 0) * u })); };
  fn.duration = tl.duration; return fn;
}

/** 가상 시계로 분석기를 끝까지 돌려 결과 요약을 얻는다(화면·카메라 없음). */
export function simulate(mv, script, o = {}) {
  const W = o.W || 720, H = o.H || 960, fps = o.fps || 24, an = makeAnalyzer(mv, { goal: o.goal ?? null });
  const end = (o.maxSec ?? script.duration ?? 60) * 1000;
  for (let t = 0; t <= end; t += 1000 / fps) { const out = an.update(script(t / 1000), W, H, 1000 + t); if (out.done) break; }
  return an.summary();
}

/** 씨앗값이 같으면 늘 같은 숫자가 나오는 난수(샘플 데이터가 열 때마다 바뀌지 않게) */
export function seeded(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** 가상 학생 한 명의 스쿼트 계획. level: 0(서툼)~1(능숙). 학생마다 버릇(얕게 앉기·상체 숙이기·빠르게)이 다르다. */
export function studentSquatPlan(rnd, level, reps = 10) {
  const weak = 1 - level;
  const shallow = rnd() < 0.2 + 0.55 * weak, lean = rnd() < 0.15 + 0.5 * weak, fast = rnd() < 0.08 + 0.3 * weak;
  const bottom0 = 87 + weak * 8 + (shallow ? 9 + 20 * rnd() : 0), trunk0 = 33 + weak * 6 + (lean ? 15 + 16 * rnd() : 0);
  const plan = [];
  for (let i = 0; i < reps; i++) {
    const tired = (i / reps) * weak;                                   // 뒤로 갈수록 자세가 흐트러짐
    const bottom = bottom0 + (rnd() - 0.5) * 10 + tired * 12, trunk = trunk0 + (rnd() - 0.5) * 8 + tired * 10;
    const quick = fast && rnd() < 0.6;
    plan.push({ bottom: Math.min(bottom, 128), trunk: Math.min(trunk, 70), down: quick ? 0.42 : 0.9 + rnd() * 0.5, hold: quick ? 0.05 : 0.15 + rnd() * 0.2, up: quick ? 0.4 : 0.7 + rnd() * 0.4, rest: 0.35 + rnd() * 0.3 });
  }
  return plan;
}

/** 가상 학생의 수준(0~1). 반에 능숙한 학생이 많고 서툰 학생이 조금 있는 분포 */
export function studentLevel(rnd) { return Math.min(0.98, 0.12 + 0.88 * Math.pow(rnd(), 0.75)); }

/* ================= v5: 그림·시연·점검에 쓰는 가상 자세 모음 ================= */
const dir = (a, len, ang) => ({ x: a.x + len * Math.sin(ang * RAD), y: a.y + len * Math.cos(ang * RAD) }); // 아래 0°, +x(화면 오른쪽) 90°, 위 180°
function ik(a, b, l1, l2, sgn) { // 두 마디(l1, l2)로 a와 b를 잇는 가운데 관절 위치. sgn: 굽는 방향
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, dd = Math.min(d, l1 + l2 - 1e-4);
  const x = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - x * x)), ux = dx / d, uy = dy / d;
  return { x: a.x + ux * x - sgn * uy * h, y: a.y + uy * x + sgn * ux * h };
}
function face(lm, N, ar) { for (const i of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) put(lm, i, { x: N.x - 0.012 + (i % 4) * 0.008, y: N.y - 0.012 }, ar); }
function hands(lm, WL, WR, ar, vL = 0.95, vR = 0.95) { for (const i of [17, 19, 21]) put(lm, i, { x: WL.x, y: WL.y + 0.012 }, ar, vL); for (const i of [18, 20, 22]) put(lm, i, { x: WR.x, y: WR.y + 0.012 }, ar, vR); }
/** 옆모습: j = 카메라에 가까운 쪽 관절 {N,Sh,E,W,Hp,K,A,heel,toe}, far = 먼 쪽(없으면 가까운 쪽을 살짝 옮긴 것) */
function sideFig(j, ar, far) {
  const lm = blank({ x: 0.5 + j.N.x / ar, y: j.N.y }, 0.95); const f = (k) => (far && far[k]) ? far[k] : { x: j[k].x + 0.012, y: j[k].y + 0.004 };
  put(lm, 0, j.N, ar); face(lm, j.N, ar);
  put(lm, 11, j.Sh, ar); put(lm, 12, f('Sh'), ar, 0.9); put(lm, 13, j.E, ar); put(lm, 14, f('E'), ar, 0.9); put(lm, 15, j.W, ar); put(lm, 16, f('W'), ar, 0.9);
  put(lm, 23, j.Hp, ar); put(lm, 24, f('Hp'), ar, 0.9); put(lm, 25, j.K, ar); put(lm, 26, f('K'), ar, 0.9); put(lm, 27, j.A, ar); put(lm, 28, f('A'), ar, 0.9);
  put(lm, 29, j.heel, ar); put(lm, 30, f('heel'), ar, 0.9); put(lm, 31, j.toe, ar); put(lm, 32, f('toe'), ar, 0.9); hands(lm, j.W, f('W'), ar); return lm;
}
/** 정면: 화면 오른쪽이 그 사람의 왼쪽(L). j = {N, ShL,ShR, EL,ER, WL,WR, HpL,HpR, KL,KR, AL,AR} */
function frontFig(j, ar, legVis = 0.95) {
  const lm = blank({ x: 0.5 + j.N.x / ar, y: j.N.y }, 0.95); put(lm, 0, j.N, ar); face(lm, j.N, ar);
  put(lm, 11, j.ShL, ar); put(lm, 12, j.ShR, ar); put(lm, 13, j.EL, ar); put(lm, 14, j.ER, ar); put(lm, 15, j.WL, ar); put(lm, 16, j.WR, ar);
  put(lm, 23, j.HpL, ar, Math.max(legVis, 0.3)); put(lm, 24, j.HpR, ar, Math.max(legVis, 0.3)); put(lm, 25, j.KL, ar, legVis); put(lm, 26, j.KR, ar, legVis); put(lm, 27, j.AL, ar, legVis); put(lm, 28, j.AR, ar, legVis);
  put(lm, 29, { x: j.AL.x - 0.01, y: j.AL.y + 0.025 }, ar, legVis); put(lm, 31, { x: j.AL.x + 0.03, y: j.AL.y + 0.035 }, ar, legVis); put(lm, 30, { x: j.AR.x + 0.01, y: j.AR.y + 0.025 }, ar, legVis); put(lm, 32, { x: j.AR.x - 0.03, y: j.AR.y + 0.035 }, ar, legVis);
  hands(lm, j.WL, j.WR, ar); return lm;
}
function frontBody(o = {}) { // 정면 몸통과 다리. lean: 상체가 화면 오른쪽으로 기운 각도
  const ox = o.ox || 0, cy = o.cy ?? 0.34, lean = o.lean || 0; const C = { x: ox, y: cy + 0.25 }, S = dir(C, 0.25, 180 - lean); const c = Math.cos(lean * RAD), sn = Math.sin(lean * RAD);
  const ShL = { x: S.x + 0.10 * c, y: S.y + 0.10 * sn }, ShR = { x: S.x - 0.10 * c, y: S.y - 0.10 * sn }; const HpL = { x: ox + 0.06, y: C.y }, HpR = { x: ox - 0.06, y: C.y };
  const KL = dir(HpL, 0.21, 3), AL = dir(KL, 0.21, 0), KR = dir(HpR, 0.21, -3), AR = dir(KR, 0.21, 0);
  return { S, ShL, ShR, HpL, HpR, KL, KR, AL, AR, N: dir(S, 0.095, 180 - lean - (o.headTurn || 0)) };
}
/** 정면에서 본 서 있는 자세(양팔 내림) */
export function standPose(o = {}) { const ar = o.ar || 0.75, b = frontBody(o); const EL = dir(b.ShL, 0.14, 8), WL = dir(EL, 0.13, 4), ER = dir(b.ShR, 0.14, -8), WR = dir(ER, 0.13, -4); return frontFig(Object.assign(b, { EL, WL, ER, WR }), ar, o.legVis); }
/** 정면에서 본 양궁 풀 드로(활을 끝까지 당긴 자세). 활 드는 팔=왼팔(화면 오른쪽), 당기는 팔=오른팔.
 *  elbowDrop: 당기는 팔꿈치가 처진 각도, bowDrop: 활 든 팔이 처진 각도, lean: 상체가 뒤(화면 왼쪽)로 젖혀진 각도, drawShort: 덜 당긴 거리 */
export function archeryPose(o = {}) {
  const ar = o.ar || 0.75, b = frontBody(Object.assign({}, o, { lean: -(o.lean || 0), headTurn: 16 }));
  const a1 = 90 - (o.bowDrop || 0), EL = dir(b.ShL, 0.14, a1), WL = dir(EL, 0.13, a1 + (o.bowBend || 0));
  const ER = dir(b.ShR, 0.14, -(100 - (o.elbowDrop || 0))); const T = { x: b.N.x - 0.005 - (o.drawShort || 0), y: b.N.y + 0.045 }; const d = Math.hypot(T.x - ER.x, T.y - ER.y) || 1; const WR = { x: ER.x + 0.13 * (T.x - ER.x) / d, y: ER.y + 0.13 * (T.y - ER.y) / d };
  return frontFig(Object.assign(b, { EL, WL, ER, WR }), ar, o.legVis);
}
/** 정면 상체: 양팔을 원하는 방향으로. armL/armR: 위팔이 아래에서 바깥으로 벌어진 각도, foreL/foreR: 아래팔 방향(180=위) */
export function armsPose(o = {}) { const ar = o.ar || 4 / 3, b = frontBody(Object.assign({ cy: 0.5 }, o)); const EL = dir(b.ShL, 0.14, o.armL ?? 30), WL = dir(EL, 0.13, o.foreL ?? 150), ER = dir(b.ShR, 0.14, -(o.armR ?? 30)), WR = dir(ER, 0.13, -(o.foreR ?? 150)); return frontFig(Object.assign(b, { EL, WL, ER, WR }), ar, o.legVis ?? 0.1); }
/** 옆에서 본 인사. lean: 허리 숙인 각도, kneeBend: 무릎 굽힌 각도 */
export function bowPose(lean, o = {}) {
  const ar = o.ar || 0.75, ox = o.ox || 0, kb = o.kneeBend || 0; const A = { x: ox - 0.02, y: 0.9 }, K = dir(A, 0.21, 180 - kb / 2), Hp = dir(K, 0.21, 180 + kb / 2), Sh = dir(Hp, 0.25, 180 - lean), N = dir(Sh, 0.09, 180 - (lean + (o.neck ?? 16)));
  const E = dir(Sh, 0.13, 8), W = dir(E, 0.12, 35); return sideFig({ N, Sh, E, W, Hp, K, A, heel: { x: A.x - 0.03, y: A.y + 0.025 }, toe: { x: A.x + 0.085, y: A.y + 0.03 } }, ar);
}
/** 인사 계획: [{lean:숙인 각도, kneeBend, down, hold, up, rest}] */
export function bowScript(plan, o = {}) { const tl = repTimeline(plan.map(r => Object.assign({ down: 0.9, hold: 0.9, up: 0.9, rest: 0.7 }, r)), o.lead); const fn = (el) => { const { r, u } = tl.at(el); return r ? bowPose(3 + (r.lean - 3) * u, Object.assign({}, o, { kneeBend: (r.kneeBend || 0) * u })) : bowPose(3, o); }; fn.duration = tl.duration; return fn; }
/** 옆에서 본 달리기. ph: 0~1(두 걸음 한 주기). lean: 상체 앞 기울기, stride: 보폭 배율, bounce: 위아래 흔들림, over: 다리를 쭉 뻗어 멀리 디딤, elbow: 팔꿈치 각도 */
export function runPose(ph, o = {}) {
  const ar = o.ar || 0.75, ox = o.ox || 0, lean = o.lean ?? 7, stride = o.stride ?? 1, bounce = o.bounce ?? 0.018, elbow = o.elbow ?? 90, strike = o.over ? 5 : 18;
  const Hp = { x: ox, y: 0.515 + bounce * Math.cos(4 * Math.PI * ph) };
  const leg = (q) => { const sw = Math.cos(2 * Math.PI * q), th = 8 + 28 * stride * sw, rec = Math.max(0, -Math.sin(2 * Math.PI * q)), sup = Math.max(0, Math.sin(2 * Math.PI * q)), kf = strike + 85 * rec + 12 * sup; const K = dir(Hp, 0.21, th), A = dir(K, 0.21, th - kf); return { K, A, heel: { x: A.x - 0.025, y: A.y + 0.02 }, toe: { x: A.x + 0.075, y: A.y + 0.028 } }; };
  const Sh = dir(Hp, 0.25, 180 - lean), N = dir(Sh, 0.09, 180 - (lean + 14)); const arm = (sw) => { const ua = 5 + 28 * sw, E = dir(Sh, 0.13, ua), W = dir(E, 0.12, ua + (180 - elbow)); return { E, W }; };
  const near = leg(ph), far = leg((ph + 0.5) % 1), an = arm(-Math.cos(2 * Math.PI * ph)), af = arm(Math.cos(2 * Math.PI * ph));
  return sideFig({ N, Sh, E: an.E, W: an.W, Hp, K: near.K, A: near.A, heel: near.heel, toe: near.toe }, ar, { Sh: { x: Sh.x + 0.01, y: Sh.y }, Hp: { x: Hp.x + 0.01, y: Hp.y }, E: af.E, W: af.W, K: far.K, A: far.A, heel: far.heel, toe: far.toe });
}
/** 달리기 계획: [{sec, spm:분당 발걸음, lean, stride, bounce, over, elbow}] */
export function runScript(plan, o = {}) {
  const segs = []; let t = o.lead ?? 1.0; for (const r of plan) { segs.push({ t0: t, t1: t + r.sec, r }); t += r.sec; }
  const fn = (el) => { if (el < segs[0].t0) return bowPose(3, o); let ph = 0; for (const s of segs) { const a = Math.min(el, s.t1) - s.t0; if (a > 0) ph += a * (s.r.spm ?? 172) / 120; } const cur = segs.find(s => el < s.t1) || segs[segs.length - 1]; return runPose(ph % 1, Object.assign({}, o, cur.r)); };
  fn.duration = t + 0.3; return fn;
}
/** 옆에서 본 가슴압박(무릎 꿇은 자세). u: 0(올라옴)~1(가장 깊이), elbowBend: 팔꿈치 굽힌 각도, offset: 어깨가 손보다 뒤에 있는 거리 */
export function cprPose(u, o = {}) {
  const ar = o.ar || 0.75, ox = o.ox || 0, press = 0.035 * u, off = o.offset || 0, bend = o.elbowBend || 0;
  const K = { x: ox - 0.02, y: 0.9 }, A = { x: ox - 0.22, y: 0.915 }, Hp = { x: ox - 0.065, y: 0.69 + press * 0.3 }, W = { x: ox + 0.1, y: 0.80 + press }, Sh = { x: W.x - off, y: Hp.y - 0.19 + press * 0.7 };
  const mx = (Sh.x + W.x) / 2, my = (Sh.y + W.y) / 2, half = Math.hypot(Sh.x - W.x, Sh.y - W.y) / 2, k = half * Math.tan(bend / 2 * RAD), ux = (W.x - Sh.x) / (2 * half), uy = (W.y - Sh.y) / (2 * half); const E = { x: mx + uy * k, y: my - ux * k };
  return sideFig({ N: { x: Sh.x + 0.05, y: Sh.y - 0.075 }, Sh, E, W, Hp, K, A, heel: { x: A.x - 0.02, y: A.y - 0.03 }, toe: { x: A.x - 0.06, y: A.y } }, ar);
}
/** 가슴압박 계획: {rate:분당 횟수, n:횟수, elbowBend, offset} */
export function cprScript(r = {}, o = {}) { const rate = r.rate ?? 110, n = r.n ?? 30, lead = o.lead ?? 1.0; const fn = (el) => { const t = el - lead; if (t < 0 || t > n * 60 / rate) return cprPose(0, Object.assign({}, o, r)); return cprPose(0.5 - 0.5 * Math.cos(2 * Math.PI * t * rate / 60), Object.assign({}, o, r)); }; fn.duration = lead + n * 60 / rate + 0.6; return fn; }
/** 옆에서 본 플랭크. sag: 엉덩이가 처진 정도(+), 음수면 들림 */
export function plankPose(sag = 0, o = {}) {
  const ar = o.ar || 4 / 3, ox = o.ox || 0; const A = { x: ox - 0.36, y: 0.80 }, Sh = { x: ox + 0.22, y: 0.63 }, E = { x: Sh.x, y: 0.80 }, W = { x: Sh.x + 0.12, y: 0.80 };
  const Hp = { x: (A.x + Sh.x) / 2 + 0.03, y: (A.y + Sh.y) / 2 + sag }, K = { x: (A.x + Hp.x) / 2, y: (A.y + Hp.y) / 2 + sag * 0.3 };
  return sideFig({ N: { x: Sh.x + 0.085, y: Sh.y - 0.015 }, Sh, E, W, Hp, K, A, heel: { x: A.x - 0.01, y: A.y - 0.035 }, toe: { x: A.x + 0.01, y: A.y + 0.03 } }, ar);
}
/** 옆에서 본 푸시업. u: 0(팔 폄)~1(가장 낮게) */
export function pushupPose(u = 0, o = {}) {
  const ar = o.ar || 4 / 3, ox = o.ox || 0; const A = { x: ox - 0.38, y: 0.80 }, W = { x: ox + 0.2, y: 0.82 }, Sh = { x: ox + 0.2, y: 0.555 + 0.17 * u }, E = ik(Sh, W, 0.135, 0.135, 1);
  const Hp = { x: A.x + (Sh.x - A.x) * 0.52, y: A.y + (Sh.y - A.y) * 0.52 + (o.sag || 0) }, K = { x: (A.x + Hp.x) / 2, y: (A.y + Hp.y) / 2 };
  return sideFig({ N: { x: Sh.x + 0.085, y: Sh.y - 0.01 }, Sh, E, W, Hp, K, A, heel: { x: A.x - 0.01, y: A.y - 0.035 }, toe: { x: A.x + 0.01, y: A.y + 0.03 } }, ar);
}
/** 옆에서 본 런지. u: 0(서 있음)~1(가장 낮게) */
export function lungePose(u = 0, o = {}) {
  const ar = o.ar || 0.75, ox = o.ox || 0; const Hp = { x: ox, y: 0.505 + 0.16 * u }, A1 = { x: ox + 0.17, y: 0.9 }, A2 = { x: ox - 0.25, y: 0.885 }; const K1 = ik(Hp, A1, 0.21, 0.21, -1), K2 = ik(Hp, A2, 0.21, 0.21, -1);
  const Sh = dir(Hp, 0.25, 180 - (o.trunk ?? 6)), N = dir(Sh, 0.09, 180 - 18), E = dir(Sh, 0.13, 6), W = dir(E, 0.12, 20);
  return sideFig({ N, Sh, E, W, Hp, K: K1, A: A1, heel: { x: A1.x - 0.03, y: A1.y + 0.025 }, toe: { x: A1.x + 0.085, y: A1.y + 0.03 } }, ar, { K: K2, A: A2, heel: { x: A2.x - 0.02, y: A2.y - 0.03 }, toe: { x: A2.x + 0.03, y: A2.y + 0.035 } });
}
/** 두 자세 사이를 부드럽게 잇는다 */
export function lerpPose(a, b, u) { return a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * u, y: p.y + (b[i].y - p.y) * u, z: 0, visibility: Math.min(p.visibility, b[i].visibility) })); }
/** 쉬는 자세 ↔ 목표 자세를 오가는 계획: [{pose, in, hold, out, rest}] (모범 따라 하기 시연·점검용) */
export function poseScript(plan, rest, o = {}) { const tl = repTimeline(plan.map(r => ({ down: r.in ?? 1.0, hold: r.hold ?? 2.7, up: r.out ?? 0.7, rest: r.rest ?? 1.0, pose: r.pose })), o.lead ?? 1.2); const fn = (el) => { const { r, u } = tl.at(el); return r ? lerpPose(rest, r.pose, u) : rest; }; fn.duration = tl.duration; return fn; }

