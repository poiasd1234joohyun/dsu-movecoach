import { MOVEMENTS, makeAnalyzer, buildComment, buildReply, analyzePose, customMovement, poseFeatures, poseSample, buildPoseTemplate, comparePose, matchMovement, featureCue, StillCapture, motionFrame, buildMotionTemplate, unpackMotion, motionAt, motionPose, scoreFollow, motionMovement, FollowAnalyzer, HandSignal, cutGestureTail, packBytes, unpackBytes, dtwPath, activeRange, splitCycles } from '../src/engine.mjs';
import { runPose, lerpPose, squatPose, pressPose, squatScript, pressScript, simulate, seeded, studentSquatPlan, studentLevel, bowPose, bowScript, runScript, archeryPose, standPose, armsPose, poseScript, cprScript, plankPose, pushupPose, lungePose } from '../src/synth.mjs';
const W=1000,H=1000;
function base(){ return Array.from({length:33},()=>({x:0.5,y:0.5,z:0,visibility:0.9})); }
const set=(lm,i,p)=>{ lm[i]={x:p.x,y:p.y,z:0,visibility:0.9}; };
// 측면 서 있는/스쿼트 자세
function standing(theta, trunkDeg, opts={}){
  const d=0.2/Math.tan((theta*Math.PI/180)/2); const hip={x:.5,y:.55}, knee={x:.5+d,y:.72}, ank={x:.5,y:.9};
  const sh={x:.5+.25*Math.sin(trunkDeg*Math.PI/180), y:.55-.25*Math.cos(trunkDeg*Math.PI/180)};
  const lm=base(); set(lm,0,{x:sh.x,y:sh.y-.1}); set(lm,11,sh); set(lm,12,{x:sh.x+.01,y:sh.y}); set(lm,23,hip); set(lm,24,{x:.51,y:.55});
  set(lm,25,knee); set(lm,26,{x:knee.x+.01,y:knee.y}); set(lm,27,ank); set(lm,28,{x:.51,y:.9}); set(lm,29,{x:.48,y:.92}); set(lm,30,{x:.49,y:.92}); set(lm,31,{x:.56,y:.93}); set(lm,32,{x:.57,y:.93});
  const wy= opts.handsUp? sh.y-.2 : sh.y+.3; set(lm,13,{x:sh.x,y:sh.y+.15}); set(lm,14,{x:sh.x+.01,y:sh.y+.15}); set(lm,15,{x:sh.x,y:wy}); set(lm,16,{x:sh.x+.01,y:wy});
  return lm;
}
// 플랭크(수평): 어깨(0.3,0.6) 엉덩이 발목(0.9,0.62), hipOffset>0 → 처짐(화면 아래)
function plank(hipOffset){ const lm=base(); const sh={x:.3,y:.6}, ank={x:.9,y:.62}; const hip={x:.6,y:.61+hipOffset};
  set(lm,0,{x:.22,y:.58}); set(lm,11,sh); set(lm,12,{x:.3,y:.61}); set(lm,13,{x:.3,y:.72}); set(lm,14,{x:.3,y:.73}); set(lm,15,{x:.3,y:.8}); set(lm,16,{x:.3,y:.81});
  set(lm,23,hip); set(lm,24,{x:.6,y:hip.y+.01}); set(lm,25,{x:.75,y:.615}); set(lm,26,{x:.75,y:.625}); set(lm,27,ank); set(lm,28,{x:.9,y:.63}); set(lm,29,{x:.92,y:.64}); set(lm,30,{x:.92,y:.65}); set(lm,31,{x:.95,y:.7}); set(lm,32,{x:.95,y:.71}); return lm; }
// CPR 압박: 무릎 꿇고 측면, 어깨가 위아래로 진동. phase 0..1
function cpr(yOff, elbowBent=false, lean=0){ const lm=base(); const wr={x:.6,y:.75}; const sh={x:.6+lean,y:.45+yOff}; const el= elbowBent? {x:.66,y:.6+yOff/2} : {x:sh.x+(wr.x-sh.x)/2,y:sh.y+(wr.y-sh.y)/2};
  set(lm,0,{x:.55,y:.38+yOff}); set(lm,11,sh); set(lm,12,{x:sh.x+.01,y:sh.y}); set(lm,13,el); set(lm,14,{x:el.x+.01,y:el.y}); set(lm,15,wr); set(lm,16,{x:.61,y:.75});
  set(lm,23,{x:.4,y:.6+yOff*.3}); set(lm,24,{x:.41,y:.6+yOff*.3}); set(lm,25,{x:.35,y:.8}); set(lm,26,{x:.36,y:.8}); set(lm,27,{x:.2,y:.82}); set(lm,28,{x:.21,y:.82}); set(lm,29,{x:.18,y:.83}); set(lm,30,{x:.19,y:.83}); set(lm,31,{x:.14,y:.84}); set(lm,32,{x:.15,y:.84}); return lm; }

let fails=0; const check=(c,msg)=>{ if(!c){ fails++; console.log('FAIL:',msg);} else console.log('ok  :',msg); };

// --- 스쿼트 ---
{ const an=makeAnalyzer(MOVEMENTS.squat,{goal:10}); let t=0; const dt=33; const push=(a,tr)=>{ const o=an.update(standing(a,tr),W,H,t); t+=dt; return o; };
  for(let i=0;i<20;i++) push(175,20);
  const plan=[[85,30,1000],[115,30,1000],[85,65,1000],[85,30,300],[135,30,1000],[90,30,1000]];
  for(const [m,tr,down] of plan){ const n=Math.round(down/dt); for(let i=1;i<=n;i++) push(175-(175-m)*i/n,tr); for(let i=0;i<6;i++) push(m,tr); for(let i=1;i<=n;i++) push(m+(175-m)*i/n,tr); for(let i=0;i<10;i++) push(175,20); }
  const s=an.summary(); console.log('squat', s.count, s.partial, s.score, s.reps.map(r=>r.issues.map(i=>i.code).join('+')||'ok').join(','));
  check(s.count===5 && s.partial===1, 'squat count 5 + partial 1');
  check(s.reps[1].issues[0].code==='depth' && s.reps[2].issues[0].code==='trunk' && s.reps[3].issues[0].code==='tempo', 'squat issue codes');
  console.log(buildComment(s).replace(/<[^>]+>/g,' ').slice(0,200));
}
// --- 런지 (primaryMode min) ---
{ const an=makeAnalyzer(MOVEMENTS.lunge,{}); let t=0; const dt=33; const push=(a,tr)=>{ an.update(standing(a,tr),W,H,t); t+=dt; };
  for(let i=0;i<20;i++) push(175,5); for(let k=0;k<3;k++){ for(let i=1;i<=30;i++) push(175-85*i/30,10); for(let i=0;i<6;i++) push(90,10); for(let i=1;i<=30;i++) push(90+85*i/30,10); for(let i=0;i<10;i++) push(175,5); }
  const s=an.summary(); console.log('lunge', s.count, s.score, s.reps.map(r=>r.issues.map(i=>i.code).join('+')||'ok').join(','));
  check(s.count===3, 'lunge 3 reps');
}
// --- 플랭크 ---
{ const an=makeAnalyzer(MOVEMENTS.plank,{goal:20}); let t=0; const dt=100; let says=[]; let done=false;
  for(let i=0;i<260 && !done;i++){ const off = (i>=60&&i<110)? 0.09 : 0; // 5초간 처짐
    const o=an.update(plank(off),W,H,t); t+=dt; if(o.repEvent&&o.repEvent.say) says.push(o.repEvent.say); if(o.done) done=true; }
  const s=an.summary(); console.log('plank', s.held.toFixed(1), s.goodTime.toFixed(1), s.score, s.topIssue, says.slice(0,6));
  check(done && s.held>=20 && s.topIssue && s.topIssue.code==='sag', 'plank done, sag detected');
}
// --- CPR 압박 (110/분 → 주기 0.545초) ---
{ const an=makeAnalyzer(MOVEMENTS.cpr_compression,{goal:30}); let t=0; const dt=33; let done=false; let n=0;
  while(!done && t<40000){ const sec=t/1000; const period= sec<8? 60/110 : 60/80; // 뒤 절반은 느리게
    const ph=(sec%period)/period; const yOff= 0.05*(1-Math.cos(ph*2*Math.PI))/2; // 0..0.05 (아래로)
    const o=an.update(cpr(yOff, sec>12, 0),W,H,t); t+=dt; n=o.count; if(o.done) done=true; }
  const s=an.summary(); console.log('cpr', s.count, s.avgRate.toFixed(0), (s.inRange*100).toFixed(0)+'%', (s.elbowOk*100).toFixed(0)+'%', s.score, s.topIssue, 'items', s.items.length, 'time', (t/1000).toFixed(1));
  check(done && s.count===30, 'cpr 30 compressions counted');
  check(s.avgRate>85 && s.avgRate<115, 'cpr rate plausible '+s.avgRate.toFixed(0));
  check(s.elbowOk<1, 'cpr elbow bend detected');
}
// --- CPR 절차 ---
{ const an=makeAnalyzer(MOVEMENTS.cpr_sequence,{cycles:1}); let t=0; const dt=50; const announces=[]; let done=false; let compStart=null;
  for(let i=0;i<4000 && !done;i++){
    const step=an.current(); let lm;
    if(step && step.type==='movement'){ if(compStart==null) compStart=t; const sec=(t-compStart)/1000; const period=60/110; const ph=(sec%period)/period; lm=cpr(0.05*(1-Math.cos(ph*2*Math.PI))/2); }
    else { compStart=null; lm= standing(175, 10, {handsUp: step && step.id!=='breath' && (t - (an.stepStart||0))>3000}); } // 호흡확인은 타이머(10초)로, 나머지는 손들기로 넘어감
    const o=an.update(lm,W,H,t); t+=dt; if(o.announce) announces.push(o.announce.say.slice(0,30)); if(o.done) done=true;
  }
  const s=an.summary(); console.log('procedure', s.count, '/', s.goal, 'score', s.score, 'aiScore', s.aiScore, 'time', (t/1000).toFixed(0)+'s'); console.log(announces); console.log(s.items.map(i=>i.cols.join(' | ')));
  check(done && s.count===s.goal, 'procedure completed all steps');
  check(s.steps.find(r=>r.type==='movement').summary.count===30, 'procedure compression step counted 30');
  console.log(buildComment(s).replace(/<[^>]+>/g,' ').slice(0,300));
}
// --- 가상 동작 데이터: 좌표가 의도한 각도를 내는지 ---
{ for(const th of [174,140,100,85]){ const p=analyzePose(squatPose(th,30),720,960); check(Math.abs(p.mL.knee-th)<0.6 && Math.abs(p.mL.trunkLean-30)<0.6 && p.fullBody && !p.handsUp && !p.frontal, `synth squat pose knee ${th}`); }
  const r=analyzePose(pressPose(0,0),960,720), t=analyzePose(pressPose(1,1),960,720);
  check(r.deskBody && !r.fullBody && r.headroom>0.02 && r.mL.elbow<100 && t.mL.elbow>165, `synth press pose rest ${r.mL.elbow.toFixed(0)} top ${t.mL.elbow.toFixed(0)}`);
  check(analyzePose(pressPose(0,0,{cy:0.3}),960,720).headroom<0.02, 'press: no headroom when sitting too close');
}
// --- 가상 스쿼트: 일부러 넣은 오류를 그대로 잡아내는지 ---
{ const s=simulate(MOVEMENTS.squat, squatScript([{bottom:88,trunk:35},{bottom:92,trunk:38},{bottom:108,trunk:40},{bottom:90,trunk:62},{bottom:120,trunk:35},{bottom:90,trunk:35,down:.4,hold:.05,up:.4},{bottom:132,trunk:35}]));
  const codes=s.reps.map(r=>r.issues.map(i=>i.code).join('+')); console.log('synth squat', s.count, s.score, codes, 'partial', s.partial);
  check(s.count===6 && s.partial===1, 'synth squat 6 counted + 1 partial');
  check(codes[0]===''&&codes[1]===''&&codes[2]==='depth'&&codes[3]==='trunk'&&codes[4]==='depth'&&codes[5]==='tempo', 'synth squat issues match the plan');
}
// --- 앉아서 팔 뻗기(각도가 커질수록 목표에 가까운 동작) ---
{ const s=simulate(MOVEMENTS.press, pressScript([{},{},{maxElbow:142},{right:0.55},{tilt:18},{down:.3,hold:.05,up:.3},{maxElbow:118}]),{W:960,H:720});
  const codes=s.reps.map(r=>r.issues.map(i=>i.code).join('+')); console.log('press', s.count, s.score, s.reps.map(r=>r.min.toFixed(0)), codes, 'partial', s.partial);
  check(s.count===6 && s.partial===1, 'press 6 counted + 1 partial (arm not extended)');
  check(codes[0]===''&&codes[1]==='', 'press good reps pass');
  check(codes[2]==='depth', 'press short extension flagged'); check(codes[3].includes('uneven'), 'press uneven arms flagged'); check(codes[4]==='tilt', 'press body tilt flagged'); check(codes[5]==='tempo', 'press too fast flagged');
  check(s.invert===true && s.tiles[1][0]==='평균 최고 각도', 'press summary uses "최고 각도"');
  const c=buildComment(s).replace(/<[^>]+>/g,' '); check(c.includes('155° 이상') && c.includes('인정되지 않은 동작이 1회'), 'press comment wording'); console.log(c.slice(0,160));
  // 손이 머리 위로 올라가도(= 다른 동작의 "끝내기" 신호) 이 동작은 끝나지 않아야 한다 → 엔진은 handsUp만 알려 주고, 화면 쪽이 noHandsEnd를 본다
  check(MOVEMENTS.press.noHandsEnd===true && analyzePose(pressPose(1,1),960,720).handsUp===true, 'press sets noHandsEnd');
  const g=makeAnalyzer(MOVEMENTS.press,{goal:3}); const sc=pressScript([{},{},{},{}]); let done=false; for(let t=0;t<20000&&!done;t+=40){ done=g.update(sc(t/1000),960,720,1000+t).done; } check(done && g.reps.length===3, 'press stops at goal');
}
// --- 가상 학생 32명(샘플 수업방): 씨앗값이 같으면 늘 같은 결과, 점수가 고르게 퍼져야 한다 ---
{ const run=()=>{ const rnd=seeded(20261118); const a=[]; for(let i=0;i<32;i++){ const su=simulate(MOVEMENTS.squat, squatScript(studentSquatPlan(rnd, studentLevel(rnd))),{goal:10}); a.push(su?su.score:null); } return a; };
  const a=run(), b=run(); const ok=a.filter(x=>x!=null); const avg=ok.reduce((x,y)=>x+y,0)/ok.length; console.log('demo class', ok.length, 'avg', avg.toFixed(1), '<70:', ok.filter(x=>x<70).length, 'min', Math.min(...ok), 'max', Math.max(...ok));
  check(JSON.stringify(a)===JSON.stringify(b), 'demo class is deterministic'); check(ok.length===32, 'demo class: all 32 produce a result');
  check(avg>72 && avg<92 && ok.filter(x=>x<70).length>=3 && ok.filter(x=>x>=90).length>=5, 'demo class has a realistic spread');
}
// --- 교수 답장 기본 문구(내장 규칙) ---
{ const r1=buildReply({name:'가상학생',movement:'squat',movementName:'스쿼트',kind:'rep',count:10,score:72,topIssue:'상체 숙임'});
  check(r1.includes('가상학생') && r1.includes('72점') && r1.includes('상체 숙임') && r1.includes('가슴을 들고'), 'reply names the top issue with its tip');
  check(buildReply({name:'가',movement:'squat',movementName:'스쿼트',kind:'rep',count:10,score:96,topIssue:''}).includes('기준을 벗어난 동작이 없었습니다'), 'reply for a clean set');
  const r3=buildReply({name:'가',movement:'squat',movementName:'스쿼트',kind:'rep',count:10,score:55,topIssue:'깊이 부족',mode:'exam'},null,{hideScore:true}); check(!r3.includes('55') && !r3.includes('깊이') && r3.includes('접수'), 'reply hides score for a blind exam');
  check(buildReply({name:'가',movement:'cmabc',movementName:'고블릿 스쿼트',kind:'rep',count:8,score:80,topIssue:'무릎 모임'}).includes('무릎 모임'), 'reply works for an unknown (custom) movement');
}
// ================= v5 =================
// --- 인사: 각도가 커질수록 목표에 가까운 동작 + 목표에 따라 움직이는 기준(너무 깊이 숙임) ---
{ for(const L of [3,15,30,45]){ const p=analyzePose(bowPose(L),720,960); check(Math.abs(p.mL.trunkLean-L)<0.6 && p.mL.knee>175 && p.fullBody, `bow pose lean ${L}`); }
  const s=simulate(MOVEMENTS.bow, bowScript([{lean:31},{lean:33},{lean:22},{lean:55},{lean:32,kneeBend:35},{lean:31,down:.35,hold:.05,up:.35},{lean:12}]));
  const codes=s.reps.map(r=>r.issues.map(i=>i.code).join('+')); console.log('bow', s.count, s.score, codes);
  check(s.count===6 && codes.join('|')==='||depth|over|knee|tempo', 'bow: 덜 숙임·너무 깊이·무릎 굽힘·너무 빠름을 구분한다');
  const s45=simulate(MOVEMENTS.bow, bowScript([{lean:46},{lean:31},{lean:60}]),{}); check(s45.reps[1].issues.length===0, 'bow 30° 목표: 31°는 통과');
  const an=makeAnalyzer(MOVEMENTS.bow,{target:45}); const sc=bowScript([{lean:46},{lean:36},{lean:68}]); for(let t=0;t<sc.duration*1000;t+=40) an.update(sc(t/1000),720,960,1000+t); const su=an.summary(); console.log('bow 45', su.reps.map(r=>r.min.toFixed(0)+':'+r.issues.map(i=>i.code).join('+')));
  check(su.target===45 && su.reps[0].issues.length===0 && su.reps[1].issues[0].code==='depth' && su.reps[2].issues[0].code==='over', 'bow 45° 목표: 기준이 목표를 따라 움직인다');
}
// --- 달리기: 발걸음 수와 자세 문제 ---
{ const run=(plan)=>simulate(MOVEMENTS.run, runScript(plan),{goal:20,fps:30}); const g=run([{sec:24,spm:172}]);
  check(g && Math.abs(g.cadence-172)<3 && g.score>=95 && !g.topIssue && g.count===20, `run good: cadence ${g&&g.cadence.toFixed(0)} score ${g&&g.score}`);
  for(const [code,plan] of [['lean',[{sec:24,spm:172,lean:24}]],['back',[{sec:24,spm:172,lean:-8}]],['over',[{sec:24,spm:166,stride:1.3,over:true}]],['bounce',[{sec:24,spm:172,bounce:0.036}]],['slow',[{sec:24,spm:140}]],['arm',[{sec:24,spm:172,elbow:155}]]]){ const s=run(plan); check(s && s.topIssue && s.topIssue.code===code && s.score<95, `run ${code}: top ${s&&s.topIssue&&s.topIssue.code} score ${s&&s.score}`); }
  const fast=run([{sec:24,spm:186}]); check(Math.abs(fast.cadence-186)<4, `run cadence 186 → ${fast.cadence.toFixed(0)}`);
  const c=buildComment(run([{sec:24,spm:140}])).replace(/<[^>]+>/g,' '); check(c.includes('분당 140보') && c.includes('발걸음 느림') && c.includes('추정값'), 'run comment');
  const an=makeAnalyzer(MOVEMENTS.run,{goal:10}); const sc=runScript([{sec:14,spm:172,lean:25}]); let said=null, done=false; for(let t=0;t<16000&&!done;t+=33){ const o=an.update(sc(t/1000),720,960,1000+t); if(o.repEvent&&o.repEvent.say&&!/초$/.test(o.repEvent.say)) said=o.repEvent.say; done=o.done; } check(done && said==='상체를 세우세요', `run live cue: ${said}`);
}
// --- 모범 자세 따라 하기: 여러 번 찍은 평균 → 비슷한 정도 → 어느 부위를 어떻게 ---
{ const W=720,H=960; const tpl=buildPoseTemplate([archeryPose(),archeryPose({elbowDrop:3,bowDrop:2}),archeryPose({elbowDrop:-3,lean:1})].map(lm=>poseSample(lm,W,H)));
  check(tpl && tpl.n===3 && Object.keys(tpl.f).length===10 && tpl.an==='sho' && tpl.sk.length===13, `template: ${tpl&&Object.keys(tpl.f).length} features, ${JSON.stringify(tpl).length} bytes`);
  check(Math.abs(tpl.f.armL[0]-89)<=2 && Math.abs(tpl.f.armR[0]+100)<=2 && tpl.f.armR[1]===12, 'template: 평균 각도와 허용 범위');
  const wide=buildPoseTemplate([archeryPose({elbowDrop:-12}),archeryPose(),archeryPose({elbowDrop:12})].map(lm=>poseSample(lm,W,H))); check(wide.f.armR[1]>12 && wide.sd>tpl.sd, `template: 모범이 서로 다르면 허용 범위가 넓어진다 (${wide.f.armR[1]}°)`);
  const cmp=(lm)=>comparePose(tpl,poseFeatures(analyzePose(lm,W,H)));
  check(cmp(archeryPose()).sim>99, 'match: 같은 자세 100');
  let c=cmp(archeryPose({elbowDrop:25})); check(c.sim>80&&c.sim<97 && c.worst.k==='armR' && featureCue(c.worst.k,c.per[c.worst.k])==='오른팔을 더 올리세요', `match: 당기는 팔꿈치 처짐 → ${c.sim.toFixed(0)} ${featureCue(c.worst.k,c.per[c.worst.k])}`);
  c=cmp(archeryPose({bowDrop:20})); check(c.worst.k==='armL' && featureCue(c.worst.k,c.per[c.worst.k])==='왼팔을 더 올리세요', 'match: 활 든 팔 처짐');
  check(cmp(standPose()).sim<50, `match: 팔을 내리고 서 있으면 낮은 점수 (${cmp(standPose()).sim.toFixed(0)})`);
  const mirror=(lm)=>{ const m=lm.map(p=>({x:1-p.x,y:p.y,z:0,visibility:p.visibility})); for(const [a,b] of [[11,12],[13,14],[15,16],[23,24],[25,26],[27,28],[29,30],[31,32],[17,18],[19,20],[21,22],[1,4],[2,5],[3,6],[7,8],[9,10]]){ const t=m[a]; m[a]=m[b]; m[b]=t; } return m; };
  c=cmp(mirror(archeryPose({elbowDrop:25}))); check(c.mirrored && c.sim>80 && c.worst.k==='armL' , `match: 좌우가 뒤집힌 자세(왼손잡이)도 맞춰 보고, 부위 이름은 학생 기준 (${c.worst.k})`);
  check(comparePose(tpl,poseFeatures(analyzePose(mirror(archeryPose()),W,H)),{mirror:false}).sim<60, 'match: 좌우 뒤집기를 끄면 낮은 점수');
  const mv=customMovement({id:'cmx',name:'양궁 풀 드로',kind:'match',tpl}); check(mv.type==='match' && mv.view==='full' && !mv.noHandsEnd, 'match movement from customMovement');
  const s=simulate(mv, poseScript([{pose:archeryPose()},{pose:archeryPose({elbowDrop:25})},{pose:archeryPose({bowDrop:6,elbowDrop:4})},{pose:archeryPose({elbowDrop:70,bowDrop:50})},{pose:archeryPose({lean:14})}], standPose()),{goal:4,maxSec:60});
  console.log('match', s.count, s.score, s.reps.map(r=>Math.round(r.sim)+':'+r.issues.map(i=>i.label).join('+')));
  check(s.count===4 && s.reps[0].issues.length===0 && s.reps[1].worst==='armR' && s.reps[1].fix==='오른팔을 더 올리세요' && s.reps[2].issues.length===0, 'match: 크게 다른 자세는 세지 않고, 조금 다른 자세는 세되 부위를 알려 준다');
  check(s.type==='match' && s.topIssue && s.consistency>0 && s.tiles[3][0]==='자세 일관성' && s.chart.target===75, 'match summary');
  const txt=buildComment(s).replace(/<[^>]+>/g,' '); check(txt.includes('비슷한 정도는 평균') && txt.includes('자세 일관성'), 'match comment');
  // 유지 시간이 모자라면 인정하지 않는다
  const s2=simulate(mv, poseScript([{pose:archeryPose(),in:0.3,hold:0.9,out:0.3}], standPose()),{goal:1,maxSec:8}); check(s2===null, 'match: 2초를 못 채우면 인정하지 않는다');
  // 엄격하게(허용 범위 0.6배)
  const strict=customMovement({id:'cms',name:'엄격',kind:'match',tpl,tolScale:0.6}); const cs=comparePose(tpl,poseFeatures(analyzePose(archeryPose({elbowDrop:12}),W,H)),{tolScale:0.6}); check(cs.worst&&cs.worst.k==='armR' && cmp(archeryPose({elbowDrop:12})).worst===null && strict.tolScale===0.6, 'match: 엄격도');
  // 책상 앞(상체만 보임): 보이는 부위만으로 모범을 만든다
  const t2=buildPoseTemplate([armsPose({ar:16/9}),armsPose({ar:16/9,armL:33}),armsPose({ar:16/9,armR:27})].map(lm=>poseSample(lm,1280,720))); const mv2=matchMovement({id:'cmy',name:'양손 들기',kind:'match',tpl:t2});
  check(Object.keys(t2.f).sort().join()==='armL,armR,elbL,elbR,head' && mv2.view==='upper', 'desk template uses visible parts only');
  const c2=(lm)=>comparePose(t2,poseFeatures(analyzePose(lm,1280,720))).sim; check(c2(armsPose({ar:16/9}))>99 && c2(armsPose({ar:16/9,armR:5,foreR:10}))<75, 'desk match');
  // 부위 묶음 끄기(다리는 안 본다)
  const noLegs=comparePose(tpl,poseFeatures(analyzePose(archeryPose(),W,H)),{use:['arms','body']}); check(noLegs.n===6, 'match: 다리를 빼고 비교');
  // 영상에서 멈춘 자세를 찾아 표본으로
  const sc=poseScript([{pose:archeryPose(),hold:1.5},{pose:archeryPose({elbowDrop:4}),hold:1.5},{pose:archeryPose({bowDrop:3}),hold:1.5}], standPose(), {lead:0.1}); const cap=new StillCapture(); for(let t=0;t<sc.duration*1000;t+=33) cap.update(sc(t/1000),W,H,t);
  console.log('still samples', cap.samples.map(x=>Math.round(x.f.armL.a))); check(cap.samples.filter(x=>x.f.armL.a>80).length===3, 'StillCapture: 멈춘 자세 3번을 모두 찾는다');
  // 링크로 받은 글자가 화면에 그대로 들어가지 않는다(스크립트 주입 방지)
  const evil=customMovement({id:'cme',name:'<img src=x onerror=alert(1)>',template:'squat',feedback:{depth:{label:'<b>x</b>',tip:'<script>alert(1)</script>'}}}); const es=simulate(evil, squatScript([{bottom:108,trunk:40},{bottom:108,trunk:40}])); const html=buildComment(es); check(!/<script|<b>|<img/.test(html) && html.includes('&lt;b&gt;'), 'buildComment escapes text that came from a link');
}
// --- 그림·시연용 자세가 기존 분석기와 맞는지 ---
{ let s=simulate(MOVEMENTS.cpr_compression, cprScript({rate:110,n:30})); check(s.count===30 && s.score>=95 && Math.abs(s.avgRate-110)<4, `cpr synth good ${s.score}`);
  s=simulate(MOVEMENTS.cpr_compression, cprScript({rate:110,n:30,elbowBend:40})); check(s.topIssue.code==='elbow', 'cpr synth elbow bent');
  s=simulate(MOVEMENTS.cpr_compression, cprScript({rate:84,n:30})); check(s.topIssue.code==='slow', 'cpr synth slow');
  const an=makeAnalyzer(MOVEMENTS.plank,{goal:6}); for(let t=0;t<9000;t+=40) an.update(plankPose(t>4000?0.08:0),960,720,1000+t); const su=an.summary(); check(su && su.topIssue.code==='sag' && su.score>35 && su.score<70, `plank synth sag ${su&&su.score}`);
  check(analyzePose(pushupPose(0),960,720).mL.elbow>150 && analyzePose(pushupPose(1),960,720).mL.elbow<70, 'pushup synth'); check(Math.abs(analyzePose(lungePose(1),720,960).mL.knee-90)<12, 'lunge synth');
}
// --- 모범 동작(영상) 따라 하기 ---
{ const MW=720, MH=960; const ease=(u)=>0.5-0.5*Math.cos(Math.PI*Math.max(0,Math.min(1,u)));
  // 양궁 동작 한 번: 서 있다가 → 들어 올려 당기고 → 멈췄다가 → 내린다
  const shot=(o={})=>{ const tin=o.tin??1.4, hold=o.hold??1.6, tout=o.tout??1.0, lead=o.lead??0.6; const fn=(t)=>{ const x=t-lead; const u= x<0?0 : x<tin? ease(x/tin) : x<tin+hold? 1 : x<tin+hold+tout? 1-ease((x-tin-hold)/tout) : 0; let lm=lerpPose(standPose(), archeryPose(o.pose||{}), u); if(o.mirror){ lm=lm.map(p=>({x:1-p.x,y:p.y,z:0,visibility:p.visibility})); for(const [a,b] of [[11,12],[13,14],[15,16],[23,24],[25,26],[27,28],[29,30],[31,32]]){ const q=lm[a]; lm[a]=lm[b]; lm[b]=q; } } return lm; }; fn.duration=lead+tin+hold+tout+0.6; return fn; };
  let seed=7; const rnd=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; }; const noisy=(lm)=>lm.map(p=>({x:p.x+(rnd()-0.5)*0.004,y:p.y+(rnd()-0.5)*0.004,z:0,visibility:p.visibility}));
  const take=(fn)=>{ const fr=[]; for(let t=0;t<=fn.duration*1000;t+=1000/24) fr.push(motionFrame(noisy(fn(t/1000)),MW,MH,t)); return fr; };
  // 글자로 바꾸기/되돌리기, 시간축 맞추기
  { const a=[-128,-90,-1,0,1,90,127,5]; check(JSON.stringify(unpackBytes(packBytes(a)))===JSON.stringify(a), 'motion: 바이트를 글자로 바꿨다가 되돌리면 같다'); const path=dtwPath(4,6,(i,j)=>Math.abs(i*5/3-j),3); check(path[0][0]===0&&path[0][1]===0&&path[path.length-1][0]===3&&path[path.length-1][1]===5, 'motion: 시간축 맞추기가 처음과 끝을 잇는다'); }
  const takes=[take(shot()), take(shot({tin:1.7,hold:1.4,lead:0.9})), take(shot({tin:1.2,hold:1.9,tout:1.2}))];
  const tpl=buildMotionTemplate(takes); const size=JSON.stringify(tpl).length;
  check(tpl&&tpl.kind==='motion'&&tpl.n===3&&tpl.an==='sho'&&tpl.keys.length===10&&tpl.dur>3.8&&tpl.dur<5.2, `motion: 세 번 찍어 모범 ${tpl.dur}초, 키 ${tpl.K}개`);
  check(tpl.sd<3&&tpl.move>60, `motion: 빠르기가 다른 세 번을 맞춰 평균(차이 ±${tpl.sd}°), 움직임 ${tpl.move}°`); check(size<1300, `motion: 저장 크기 ${size}자(1,300자 미만) → 링크에 담을 수 있다`);
  check(buildMotionTemplate([take(shot()).slice(0,6)])===null, 'motion: 너무 짧게 찍힌 것은 모범이 되지 않는다');
  const dec=unpackMotion(tpl); { const mid=motionAt(dec,tpl.dur*0.5), start=motionAt(dec,0); check(Math.abs(mid.f.armL[0]-90)<8&&Math.abs(start.f.armL[0])<14, `motion: 가운데는 팔을 든 자세(${Math.round(mid.f.armL[0])}°), 처음은 내린 자세`); const lm=motionPose(dec,tpl.dur*0.5); check(lm.length===33&&lm[15].y<lm[23].y&&lm.every(p=>p.x>-0.05&&p.x<1.05&&p.y>-0.05&&p.y<1.05), 'motion: 그림으로 다시 그릴 수 있다(상자 안)'); }
  const mv=customMovement({id:'cm1',kind:'motion',name:'양궁 <b>슈팅</b>',tpl,count:3}); check(mv.type==='follow'&&mv.view==='full'&&!mv.isHold&&makeAnalyzer(mv) instanceof FollowAnalyzer, 'motion: 따라 하기 동작과 분석기');
  // 가상 학생: 모범이 재생되기 시작할 때 맞춰 움직인다. per(k): k번째 회차의 동작
  const follow=(per, goal=3, lag=0.3)=>{ const an=makeAnalyzer(mv,{goal}); let t=1000, playT=null, k=0; const stand=standPose(); for(let n=0;n<24*200;n++){ t+=1000/24; const lm= an.phase==='play'&&playT!=null? per(k)((t-playT)/1000-lag) : stand; const out=an.update(noisy(lm),MW,MH,t); if(out.repEvent&&out.repEvent.go) playT=t; if(out.repEvent&&out.repEvent.n) k=out.repEvent.n; if(out.done) break; } return an.summary(); };
  const P=(o)=>()=>shot(Object.assign({lead:0},o));
  let s=follow(P({})); check(s.type==='follow'&&s.count===3&&s.hits===3&&s.sim>93&&!s.parts.length, `follow: 똑같이 따라 하면 3/3 (${s.sim.toFixed(0)}%)`);
  s=follow(P({}),3,0.75); check(s.hits===3, `follow: 0.45초쯤 늦게 따라 해도 맞음 (${s.sim.toFixed(0)}%)`);
  s=follow(P({mirror:true})); check(s.hits===3&&s.sim>93, 'follow: 좌우가 반대인 사람(왼손잡이)도 맞음');
  s=follow(P({pose:{elbowDrop:32}})); check(s.hits===0&&s.topIssue.code==='armR'&&s.parts[0].k==='armR'&&s.parts[0].seg===1&&/오른팔을 더 올리세요/.test(s.parts[0].cue), `follow: 당기는 팔이 낮으면 "다름" + 오른팔·동작 중간 (${s.sim.toFixed(0)}%)`);
  s=follow(P({pose:{bowDrop:25}})); check(s.hits===0&&s.topIssue.code==='armL', 'follow: 활 든 팔이 낮으면 왼팔을 짚는다');
  s=follow(()=>()=>standPose()); check(s.hits===0&&s.sim<50, `follow: 가만히 서 있으면 낮은 점수 (${s.sim.toFixed(0)}%)`);
  s=follow(P({tin:2.3,hold:2.5,tout:1.6})); check(s.hits===0&&s.lateN===3&&s.topIssue.label==='빠르기'&&!s.parts.length, 'follow: 너무 느리면 부위가 아니라 빠르기 문제로 알려 준다');
  s=follow((k)=> k===1? P({pose:{elbowDrop:32}})() : P({})(), 4); check(s.hits===3&&s.count===4&&s.items[1].flag&&!s.items[0].flag&&s.tiles[0][1]==='3 / 4번', 'follow: 4번 중 틀린 한 번만 "다름"');
  { const html=buildComment(s); check(/4번 따라 했고, 그중 3번/.test(html)&&/오른팔/.test(html), 'follow: 결과 문장에 맞은 횟수와 다른 부위'); check(!/<b>슈팅/.test(buildComment(Object.assign({},s,{movementName:'<b>x'}))), 'follow: 결과 문장은 바깥 글자를 그대로 넣지 않는다'); }
  // 처음 한 번은 준비 숫자(3·2·1) → 재생 → 판정 → 쉼
  { const an=makeAnalyzer(mv,{goal:2}); const seen=new Set(); let t=1000, ticks=0, went=false; for(let n=0;n<24*20;n++){ t+=1000/24; const out=an.update(standPose(),MW,MH,t); seen.add(out.phase); if(out.repEvent&&out.repEvent.tick) ticks++; if(out.repEvent&&out.repEvent.go) went=true; if(out.tpl) check.tplOk= Array.isArray(out.tpl.sk)&&out.tpl.sk.length===13&&!!out.pip; if(out.done) break; } check(ticks===2&&went&&seen.has('lead')&&seen.has('play')&&seen.has('rest')&&seen.has('done')&&check.tplOk, `follow: 재생 → 판정 → 준비 숫자(2·1) → 재생 → 끝, 점선과 작은 모범 화면 정보 (숫자 ${ticks}번)`); }
  // 손 신호: 한 손만 머리 위로 0.5초
  { const up=armsPose({ar:0.75,armL:172,foreL:180,armR:8,foreR:4,legVis:0.95,cy:0.34}); const fire=(pose)=>{ const h=new HandSignal(); let f=null; for(let t=0;t<1500;t+=40) if(h.update(pose,t)&&f==null) f=t; return f; };
    check(fire(up)>=480&&fire(up)<=600, `signal: 한 손을 들면 0.5초 뒤 신호 (${fire(up)}ms)`); check(fire(standPose())===null&&fire(archeryPose())===null, 'signal: 서 있거나 활을 당긴 자세는 신호가 아니다'); check(fire(armsPose({ar:0.75,armL:172,foreL:180,armR:172,foreR:180,legVis:0.95,cy:0.34}))===null, 'signal: 두 손을 다 들면 신호가 아니다(끝내기 동작과 구분)');
    const base=shot(); const withTail=(t)=> t<base.duration? base(t) : lerpPose(standPose(), up, ease((t-base.duration)/0.7)); const fr=[]; for(let t=0;t<=(base.duration+1.3)*1000;t+=1000/24) fr.push(motionFrame(noisy(withTail(t/1000)),MW,MH,t)); const cut=cutGestureTail(fr); const end=cut[cut.length-1].t/1000;
    check(end>base.duration-0.5&&end<base.duration+0.15, `signal: 끝내려고 손을 든 부분은 잘라 낸다 (${end.toFixed(2)}초, 동작 끝 ${base.duration.toFixed(2)}초)`); const t2=buildMotionTemplate([cut,takes[1],takes[2]]); check(Math.abs(t2.dur-tpl.dur)<0.4, 'signal: 잘라 낸 촬영으로 만든 모범의 길이가 같다'); }
  // 멈춘 자세도 "동작 모범"으로 찍을 수 있다(예: 플랭크처럼 버티는 자세)
  { const hold=()=>{ const fr=[]; for(let t=0;t<=3000;t+=1000/24) fr.push(motionFrame(noisy(archeryPose()),MW,MH,t)); return fr; }; const th=buildMotionTemplate([hold(),hold()]); const mh=motionMovement({id:'h',name:'버티기',tpl:th}); check(th&&th.move<12&&mh.isHold, `motion: 거의 안 움직이면 "멈춘 자세"로 본다(움직임 ${th.move}°)`); }
}
// --- 올린 영상에서 모범 구간 찾기 (폰으로 찍은 영상: 걸어 들어옴 → 잠깐 멈춤 → 동작 → 잠깐 멈춤 → 걸어 나옴) ---
{ const VW=720, VH=1280; const ease=(u)=>0.5-0.5*Math.cos(Math.PI*Math.max(0,Math.min(1,u))); let seed=3; const rnd=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; }; const noisy=(lm)=>lm.map(p=>({x:p.x+(rnd()-0.5)*0.004,y:p.y+(rnd()-0.5)*0.004,z:0,visibility:p.visibility}));
  const grow=(lm,k)=>lm.map(p=>({x:0.5+(p.x-0.5)*k,y:0.9+(p.y-0.9)*k,z:0,visibility:p.visibility})); // 카메라에 가까우면 몸이 크게 보인다
  // 0~3초 걸어 들어감(몸이 1.6배 → 1배), 3~4.5초 멈춤, 동작 mdur초, 1.5초 멈춤, 2.5초 걸어 나옴
  const video=(motion,mdur)=>{ const stand=motion(0), fr=[], total=3+1.5+mdur+1.5+2.5; for(let t=0;t<=total*1000;t+=1000/15){ const s=t/1000; const lm= s<3? grow(runPose((s*1.6)%1,{}),1.6-0.6*(s/3)) : s<4.5? stand : s<4.5+mdur? motion(s-4.5) : s<6+mdur? stand : grow(runPose((s*1.6)%1,{}),1+0.6*((s-6-mdur)/2.5)); fr.push(motionFrame(noisy(lm),VW,VH,t)); } return fr; };
  const shot=(t)=>{ const u= t<1.4? ease(t/1.4) : t<3.0? 1 : t<4.0? 1-ease((t-3)/1.0) : 0; return lerpPose(standPose(),archeryPose(),u); };
  let fr=video(shot,4.0), r=activeRange(fr), cyc=splitCycles(fr,r.t0,r.t1);
  check(r.t0>=3000&&r.t0<=4600&&r.t1>=8400&&r.t1<=10000&&!r.hold, `video: 걸어 들어오고 나가는 부분을 빼고 동작 구간을 찾는다 (${(r.t0/1000).toFixed(1)}~${(r.t1/1000).toFixed(1)}초, 실제 동작 4.5~8.5초)`);
  check(cyc.length===1, 'video: 한 번 하는 동작은 한 번으로 본다'); { const t=buildMotionTemplate(cyc.map(([a,b])=>fr.filter(f=>f.t>=a&&f.t<=b))); check(t&&t.n===1&&t.dur>3.6&&t.dur<5.2&&t.move>100, `video: 그 구간으로 모범 동작 ${t.dur}초`); }
  const sq=squatScript([{bottom:90,trunk:32,down:1.0,hold:.3,up:.9,rest:.6},{bottom:88,trunk:34,down:1.1,hold:.3,up:.9,rest:.6},{bottom:91,trunk:33,down:1.0,hold:.2,up:1.0,rest:.6}],{lead:0,ar:VW/VH});
  fr=video(sq,sq.duration); r=activeRange(fr); cyc=splitCycles(fr,r.t0,r.t1); { const t=buildMotionTemplate(cyc.map(([a,b])=>fr.filter(f=>f.t>=a&&f.t<=b))); check(cyc.length===3&&t&&t.n===3&&t.dur>2&&t.dur<3.2&&t.sd<4, `video: 스쿼트 3번을 한 번씩 나눠 평균을 낸다 (${cyc.map(c=>((c[1]-c[0])/1000).toFixed(1)).join(', ')}초 → 모범 ${t&&t.dur}초)`); }
  fr=Array.from({length:91},(_,i)=>motionFrame(noisy(archeryPose()),VW,VH,i*1000/15)); r=activeRange(fr); check(r.hold&&r.t1-r.t0>=4000, 'video: 처음부터 끝까지 멈춘 자세면 "멈춘 자세"로 본다');
  fr=Array.from({length:69},(_,i)=>motionFrame(noisy(shot(i/15-0.3)),VW,VH,i*1000/15)); r=activeRange(fr); check(r.t0<=300&&r.t1>=4200&&splitCycles(fr,r.t0,r.t1).length===1, 'video: 동작만 담긴 짧은 영상은 통째로 쓴다(가운데 멈춤에서 자르지 않는다)');
  check(activeRange([])===null&&splitCycles([],0,1000).length===1, 'video: 사람이 안 잡힌 영상은 탈 없이 넘어간다');
}
console.log(fails? `\n${fails} FAIL(S)`:'\nALL OK');
