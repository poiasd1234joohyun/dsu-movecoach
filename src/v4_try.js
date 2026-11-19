/* ================= 체험: 샘플 수업방(가상 학생) · 1분 체험 · 기기 점검 ================= */
const DEMO_ID='Ldemo01', DEMO_GAME_ID='Ldemo02', DEMO_KEY='demo', DEMO_SEED_VER=2, DEMO_N=32;
const SAMPLE_VIDEO='./media/sample_squat.mp4'; // 팀원이 직접 찍은 영상을 이 자리에 넣으면 "촬영해 둔 영상" 버튼이 나타난다
const T={ lastId:null, sample:false };
const V_SUR=['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황'];
const V_GIV=['하늘','도윤','서연','지호','민서','예준','수아','건우','지유','현우','다은','준서','채원','시우','유나','태윤','소율','은우','하린','지안','서준','예린','주원','나은','민재','가은','승현','다인','우진','세아','동현','라온'];
const vName=(i)=>V_SUR[(i*5+3)%V_SUR.length]+V_GIV[i%V_GIV.length];

/* ---------- 샘플 수업방: 가상 학생의 기록(실제 학생 아님) ---------- */
function demoCfg(){ return { id:DEMO_ID, demo:true, mode:'practice', course:'웨이트트레이닝1', title:'3주차 자세 교정 (샘플 수업방)', prof:'', movement:'squat', customMovement:null, goal:10, due:'', demoUrl:'', notes:'', video:false, autoSend:true, takes:0, release:true, face:false, pw:'', game:null, createdAt:new Date().toISOString() }; }
function demoGameCfg(){ return Object.assign(demoCfg(),{ id:DEMO_GAME_ID, mode:'game', title:'스쿼트 20개 시합 (샘플)', goal:20, game:{kind:'race',players:1} }); }
function seedDemoRecords(){
  const cfg=demoCfg(), mv=MOVEMENTS.squat, rnd=seeded(20261118), rnd2=seeded(47011), now=Date.now(), out=[];
  for(let i=0;i<DEMO_N;i++){
    const su=simulate(mv, squatScript(studentSquatPlan(rnd, studentLevel(rnd))), {goal:10}); if(!su) continue; // 분석 엔진이 실제로 채점한 결과
    const ts=now-Math.round((3+rnd2()*36)*60000); // 최근 40분 안에 낸 것처럼
    const s=Object.assign(su,{ts, mode:'practice', student:{name:vName(i), id:`2026${String(1001+i*3)}`}, course:cfg.course, title:cfg.title});
    out.push(Object.assign(recordPayload(s,''),{roomId:DEMO_ID, id:'S'+String(100+i), video:undefined, hasVideo:false, local:true, seed:true, device:'가상 데이터'}));
  }
  out.sort((a,b)=>a.score-b.score); // 점수가 낮은 두 명에게는 이미 답장을 보낸 상태로 둔다
  out.slice(1,3).forEach(r=>{ r.reply=buildReply(r, mv); r.replyAt=new Date(now-60000).toISOString(); });
  // 게임 순위판 샘플: 가상 학생 14명의 스쿼트 20개 시합 기록
  const g=demoGameCfg(), rnd3=seeded(5021), av=['🐰','🐻','🦊','🐼','🐯','🦁','🐸','🐵','🐧','🦄'];
  for(let i=0;i<14;i++){ const done=rnd3()>0.14; const time= done? +(34+rnd3()*30).toFixed(1) : null; const count= done?20:8+Math.floor(rnd3()*11);
    out.push({roomId:DEMO_GAME_ID, id:'G'+String(100+i), mode:'game', course:g.course, title:g.title, name:vName(i+7), studentId:'', movement:'squat', movementName:'스쿼트', kind:'game', count, goal:20, score:Math.round(count/20*100), grade:'', topIssue:'', tiles:[['게임','스쿼트 시합'],['결과', done?`완주 ${time}초`:`${count}회`]], items:[], comment:'', ts:new Date(now-Math.round(rnd3()*9*60000)).toISOString(), device:'가상 데이터', local:true, seed:true, hasVideo:false, game:{kind:'race',players:1,time,result: done?`완주 ${time}초`:`${count}회 (미완주)`,avatar:av[i%av.length],winner:null,valid:count,invalid:Math.floor(rnd3()*4),combo:3+Math.floor(rnd3()*9)}}); }
  return out;
}
function ensureDemoRoom(){
  const rooms=store.get('mc4.localrooms',{}); let ch=false; if(!rooms[DEMO_ID]){ rooms[DEMO_ID]={cfg:demoCfg(),adminKey:DEMO_KEY}; ch=true; } if(!rooms[DEMO_GAME_ID]){ rooms[DEMO_GAME_ID]={cfg:demoGameCfg(),adminKey:DEMO_KEY}; ch=true; } if(ch) store.set('mc4.localrooms',rooms);
  const recs=store.get('mc4.records',[]); const isDemo=(r)=>(r.roomId===DEMO_ID||r.roomId===DEMO_GAME_ID)&&r.seed;
  if(store.get('mc4.demoSeed',0)!==DEMO_SEED_VER || !recs.some(isDemo)){ store.set('mc4.records', recs.filter(r=>!isDemo(r)).concat(seedDemoRecords()).slice(0,400)); store.set('mc4.demoSeed',DEMO_SEED_VER); }
  return rooms[DEMO_ID].cfg;
}

/* ---------- 1분 체험 ---------- */
function enterTry(mv){ const cfg=ensureDemoRoom(); S.room=cfg; S.roomId=DEMO_ID; S.role='try'; R={mode:'practice',cfg,mv,takeCount:0}; S.takes=[]; }
const TRY_ME={name:'체험자',id:'체험'};
// A. 내 카메라로: 아무 자세나 모범으로 3번 찍고 → 그 자세를 다시 따라 한다(만드는 사람과 따라 하는 사람을 한 번에 체험)
function tryMatch(){ enterTry(MOVEMENTS.squat); startCapture({n:3, onCancel:()=>backView(), onDone:(samples)=>{ const tpl=buildPoseTemplate(samples); if(!tpl){ toast('자세를 읽지 못했습니다. 어깨와 양팔이 보이게 다시 해 주세요'); backView(); return; } const mv=matchMovement({id:'cmtry',name:'내가 찍은 모범',kind:'match',tpl,hold:2}); enterTry(mv); startSession({mode:'practice', movement:mv, goal:3, student:TRY_ME, try:'match'}); }}); }
// A'. 내 카메라로: 앉은 채 팔 뻗기 5회
function tryCamera(){ enterTry(MOVEMENTS.press); startSession({mode:'practice', movement:MOVEMENTS.press, goal:5, student:TRY_ME, try:'cam'}); }
// B. 카메라 없이: 가상 동작 데이터(일부러 틀린 동작 포함)로 같은 화면을 본다
const TRY_SYNTH={
  squat:()=>{ const plan=[{bottom:88,trunk:34},{bottom:90,trunk:36},{bottom:109,trunk:38},{bottom:91,trunk:36},{bottom:90,trunk:63},{bottom:88,trunk:35},{bottom:118,trunk:37},{bottom:89,trunk:35}]; return {mv:MOVEMENTS.squat, goal:plan.length, synth:squatScript(plan,{ar:0.75})}; },
  match:()=>{ const tpl=buildPoseTemplate([archeryPose(),archeryPose({elbowDrop:3,bowDrop:2}),archeryPose({elbowDrop:-3,lean:1})].map(lm=>poseSample(lm,720,960))); const mv=matchMovement({id:'cmdemo',name:'양궁 풀 드로 (예시 모범)',kind:'match',tpl,hold:2}); return {mv, goal:3, synth:poseScript([{pose:archeryPose({elbowDrop:2})},{pose:archeryPose({elbowDrop:30,bowDrop:10}),hold:3.2},{pose:archeryPose({bowDrop:3})}], standPose(), {lead:0.8})}; },
  run:()=>({mv:MOVEMENTS.run, goal:16, synth:runScript([{sec:8,spm:170,lean:24},{sec:12,spm:174}],{lead:0.6})}),
  bow:()=>({mv:MOVEMENTS.bow, goal:3, synth:bowScript([{lean:31},{lean:21},{lean:32,kneeBend:34},{lean:31}],{lead:0.8})}),
};
function trySynth(kind='squat'){ const d=(TRY_SYNTH[kind]||TRY_SYNTH.squat)(); enterTry(d.mv); startSession({mode:'practice', movement:d.mv, goal:d.goal, student:{name:'체험자(가상 동작)',id:'체험'}, try:'synth:'+kind, synth:d.synth, synthW:720, synthH:960}); }
// B'. 촬영해 둔 실제 영상(팀원 본인)을 이 기기에서 분석
function trySample(){ enterTry(MOVEMENTS.squat); startSession({mode:'practice', movement:MOVEMENTS.squat, goal:null, student:{name:'체험자(샘플 영상)',id:'체험'}, try:'video', file:{url:SAMPLE_VIDEO,name:'팀원이 직접 찍은 스쿼트 영상'}}); }
// C. 모이는 화면
function tryAdmin(){ ensureDemoRoom(); openAdminPage(DEMO_ID,DEMO_KEY); }
function tryBoard(){ ensureDemoRoom(); openAdminPage(DEMO_GAME_ID,DEMO_KEY); }
function retry(kind){ if(kind==='cam') tryCamera(); else if(kind==='match') tryMatch(); else if(kind==='video') trySample(); else trySynth(String(kind).split(':')[1]||'squat'); }
function renderTry(){
  $('#tryCards').innerHTML=`
    <div class="trycard"><canvas class="figcv" id="tryCv1"></canvas><h3>내 카메라로 해 보기</h3><p>아무 자세나 3번 찍고, 다시 따라 하면 점수가 나옵니다.</p><div class="btns"><button class="btn primary" id="tryMatch">📸 모범 찍고 따라 하기</button><button class="btn" id="tryCam">팔 뻗기 5회</button></div><p class="note">영상은 이 기기 밖으로 나가지 않습니다.</p></div>
    <div class="trycard"><canvas class="figcv" id="tryCv2"></canvas><h3>카메라 없이 구경하기</h3><p>가상 인물이 일부러 틀리게 움직입니다. 어떻게 교정하는지 보세요.</p><div class="btns"><button class="btn primary" data-syn="squat" id="trySyn">스쿼트</button><button class="btn" data-syn="match">양궁 자세</button><button class="btn" data-syn="run">달리기</button><button class="btn" data-syn="bow">인사</button><button class="btn" id="tryVid" hidden>찍어 둔 영상</button></div><p class="note">실제 사람·실제 영상이 아닌 가상 동작 데이터입니다.</p></div>
    <div class="trycard"><canvas class="figcv" id="tryCv3"></canvas><h3>모이는 화면 보기</h3><p>가상 학생 ${DEMO_N}명의 기록. 점수가 낮은 학생이 위에 옵니다.</p><div class="btns"><button class="btn primary" id="tryAdm">결과 화면</button><button class="btn" id="tryBrd">🏁 게임 순위판</button></div><p class="note">모두 가상 인물의 기록입니다.</p></div>`;
  mountScene($('#tryCv1'),'match',{cue:true}); mountScene($('#tryCv2'),'squat',{cue:true,bad:true}); mountScene($('#tryCv3'),'race');
  $('#tryMatch').onclick=tryMatch; $('#tryCam').onclick=tryCamera; $$('#tryCards [data-syn]').forEach(b=>b.addEventListener('click',()=>trySynth(b.dataset.syn))); $('#tryVid').onclick=trySample; $('#tryAdm').onclick=tryAdmin; $('#tryBrd').onclick=tryBoard;
  if(HOSTED) fetch(SAMPLE_VIDEO,{method:'HEAD'}).then(r=>{ T.sample= r.ok&&/video/.test(r.headers.get('content-type')||''); $('#tryVid').hidden=!T.sample; }).catch(()=>{});
}

/* ---------- 기기 점검: 이 폰·노트북에서 되는지 자동으로 확인 ---------- */
const CK={ rows:[], busy:false };
const CK_ICON={ok:'✔',warn:'△',bad:'✖',wait:'…'};
function ckSet(key,label,state,detail){ let r=CK.rows.find(x=>x.key===key); if(!r){ r={key}; CK.rows.push(r); } Object.assign(r,{label,state,detail}); $('#ckList').innerHTML=CK.rows.map(x=>`<div class="ckrow ${x.state}"><b>${CK_ICON[x.state]}</b><div><strong>${esc(x.label)}</strong><span>${esc(x.detail||'')}</span></div></div>`).join(''); }
function deviceName(){ const u=navigator.userAgent; const dev=/iPhone/.test(u)?'아이폰':/iPad/.test(u)?'아이패드':/Android/.test(u)?'안드로이드':/Windows/.test(u)?'윈도우 PC':/Macintosh/.test(u)?'맥':'기타'; const br=/KAKAOTALK/i.test(u)?'카카오톡 안 브라우저':/NAVER\(inapp/i.test(u)?'네이버 앱 안 브라우저':/SamsungBrowser/.test(u)?'삼성 인터넷':/Whale/.test(u)?'웨일':/Edg\//.test(u)?'엣지':/CriOS|Chrome\//.test(u)?'크롬':/Safari\//.test(u)?'사파리':'기타 브라우저'; return {dev,br,inapp:/KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(u)}; }
async function runCheck(){
  if(CK.busy) return; CK.busy=true; CK.rows=[]; $('#ckStart').disabled=true; $('#ckCopy').disabled=true; $('#ckNote').textContent='점검 중입니다. 카메라 허용을 물으면 "허용"을 눌러 주세요.'; initAudio();
  const v=$('#ckVideo'); let stream=null;
  try{
    const d=deviceName(); ckSet('dev','기기·브라우저', d.inapp?'warn':'ok', `${d.dev} · ${d.br}${d.inapp?' — 카메라가 안 켜지면 "다른 브라우저로 열기"를 눌러 주세요':''}`);
    ckSet('url','주소', window.isSecureContext?'ok':'bad', window.isSecureContext? location.host||'이 기기의 파일' : '카메라를 쓸 수 없는 주소입니다(https 주소로 열어야 합니다)');
    let saveOk=false; try{ localStorage.setItem('mc4.ck','1'); saveOk=localStorage.getItem('mc4.ck')==='1'; localStorage.removeItem('mc4.ck'); }catch(e){} ckSet('save','기록 저장', saveOk?'ok':'bad', saveOk?'이 기기에 저장할 수 있습니다':'저장이 막혀 있습니다(사생활 보호 모드일 수 있습니다)');
    let voices=[]; if('speechSynthesis' in window){ voices=speechSynthesis.getVoices(); if(!voices.length){ await new Promise(res=>{ const t=setTimeout(res,1200); speechSynthesis.addEventListener('voiceschanged',()=>{ clearTimeout(t); res(); },{once:true}); }); voices=speechSynthesis.getVoices(); } } const ko=voices.filter(x=>x.lang&&x.lang.startsWith('ko')).length;
    ckSet('voice','음성 안내', !('speechSynthesis' in window)?'bad':ko?'ok':'warn', !('speechSynthesis' in window)?'이 브라우저는 음성 안내를 지원하지 않습니다(자막은 나옵니다)':ko?`한국어 목소리 ${ko}개`:'한국어 목소리를 찾지 못했습니다(자막은 나옵니다)'); if(ko) Coach.say('음성 안내 점검입니다',{force:true});
    const types=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm']; const rt= typeof MediaRecorder==='undefined'? null : (types.find(t=>{ try{ return MediaRecorder.isTypeSupported(t); }catch(e){ return false; } })||'기본 형식');
    ckSet('rec','영상 녹화(과제·시험용)', rt?'ok':'warn', rt?`가능 · ${rt.split(';')[0]}`:'이 브라우저는 녹화를 지원하지 않습니다(연습은 가능)');
    ckSet('ai','자세 인식 파일','wait','불러오는 중…');
    try{ await ensureLandmarker(1); const local= MP.base===MP_LOCAL && MP.model===MODEL_LOCAL; ckSet('ai','자세 인식 파일', S.fake||local?'ok':'warn', S.fake? '점검용 가짜 인식기' : `${MP.ms!=null?(MP.ms/1000).toFixed(1)+'초 · ':''}${MP.base===MP_LOCAL?'프로그램 안 파일':'바깥 주소(jsDelivr)'} · 모델 ${MP.model===MODEL_LOCAL?'프로그램 안':'바깥 주소(구글)'} · ${MP.delegate==='GPU'?'그래픽 가속':'일반 계산'}`); }
    catch(e){ ckSet('ai','자세 인식 파일','bad',(e&&e.message)||'불러오지 못했습니다'); throw new Error('stop'); }
    ckSet('cam','카메라','wait','여는 중…');
    try{ stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:false}); v.srcObject=stream; await v.play(); ckSet('cam','카메라','ok',`켜짐 · ${v.videoWidth}×${v.videoHeight}`); }
    catch(e){ ckSet('cam','카메라','bad',cameraErrorText(e)); throw new Error('stop'); }
    ckSet('fps','인식 속도','wait','8초 동안 재는 중… 화면에 상체가 보이게 해 주세요');
    const t0=performance.now(); let n=0, seen=0, upper=0, full=0;
    while(performance.now()-t0<8000){ await new Promise(res=>requestAnimationFrame(res)); if(v.readyState<2||!v.videoWidth) continue; let ts=performance.now(); if(ts<=S.lastTs) ts=S.lastTs+1; S.lastTs=ts; let res; try{ res=S.landmarker.detectForVideo(v,ts); }catch(e){ continue; } n++; const lm=res&&res.landmarks&&res.landmarks[0]; if(lm&&lm.length>=33){ seen++; const p=analyzePose(lm,v.videoWidth,v.videoHeight); if(p.fullBody) full++; if(p.deskBody||p.upperBody) upper++; } }
    const fps=n/((performance.now()-t0)/1000);
    ckSet('fps','인식 속도', fps>=15?'ok':fps>=8?'warn':'bad', `1초에 ${fps.toFixed(0)}번 ${fps>=15?'(충분)':fps>=8?'(느린 편 · 동작을 천천히)':'(너무 느림 · 다른 기기 권장)'}`);
    ckSet('person','사람 인식', !n?'bad':seen/n>0.6?'ok':'warn', !n?'측정하지 못했습니다': seen/n>0.6? `${Math.round(seen/n*100)}% · ${full/n>0.5?'전신 보임':upper/n>0.5?'상체·양팔 보임':'얼굴·어깨만 보임'}` : `${Math.round(seen/n*100)}% · 화면에 사람이 잘 보이지 않았습니다. 상체가 보이게 다시 해 주세요`);
    $('#ckNote').textContent= CK.rows.some(r=>r.state==='bad')? '✖ 표시가 있는 항목 때문에 이 기기에서는 일부 기능이 되지 않습니다. "결과 복사"로 내용을 팀에 알려 주세요.' : CK.rows.some(r=>r.state==='warn')? '쓸 수 있지만 △ 표시 항목을 확인해 주세요. "결과 복사"로 팀에 알려 주세요.' : '모든 항목 통과. 이 기기에서 쓸 수 있습니다.';
  }catch(e){ if(!e||e.message!=='stop') ckSet('err','점검 중 오류','bad',(e&&e.message)||'알 수 없는 오류'); $('#ckNote').textContent='점검이 중간에 멈췄습니다. "결과 복사"로 내용을 팀에 알려 주세요.'; }
  finally{ if(stream) stream.getTracks().forEach(t=>t.stop()); v.srcObject=null; CK.busy=false; $('#ckStart').disabled=false; $('#ckStart').textContent='다시 점검'; $('#ckCopy').disabled=false; }
}
function checkText(){ return ['[무브코치 기기 점검] '+new Date().toLocaleString('ko-KR')].concat(CK.rows.map(r=>`${CK_ICON[r.state]} ${r.label}: ${r.detail||''}`), ['기기 정보: '+navigator.userAgent.slice(0,140)]).join('\n'); }
