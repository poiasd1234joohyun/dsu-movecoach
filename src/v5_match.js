/* ================= v5 모범 찍기: 자세를 여러 번 찍어 평균(모범)을 만든다 =================
 * 카메라로 3번 찍기 / 사진 여러 장 올리기 / 영상에서 멈춘 자세 찾기 → 확인 화면에서 고르고 이름을 붙인다.
 * 만든 모범은 링크 설정 안에 숫자(각도 10개와 윤곽 좌표)로만 들어간다. 사진·영상 자체는 저장하거나 보내지 않는다.
 */
let K=null; // 찍는 중 상태
async function startCapture(opts){
  initAudio(); K={n:opts.n||3, samples:[], state:'detect', since:null, end:0, buf:[], lastCount:null, onDone:opts.onDone, onCancel:opts.onCancel||null};
  S.session={mode:'capture', movement:{name:'모범 자세 찍기', type:'match', view:'upper', highlight:[]}}; S.result=null; S.flow='idle';
  showView('stage'); stage.classList.add('big'); stage.classList.remove('blind'); stageButtons('capture'); $('#stTitle').textContent='모범 자세 찍기'; $('#stStats').hidden=true; $('#stepbar').hidden=true; $('#hudGoal').textContent=`/ ${K.n}장`; Coach.enabled=$('#voiceToggle').checked;
  $('#sourceNote').textContent=`모범 자세를 잡으면 셋을 세고 찍습니다. ${K.n}번 찍어 평균을 냅니다. 찍은 영상은 저장하거나 보내지 않습니다.`;
  try{ await ensureLandmarker(1); }catch(e){ return; }
  if(!navigator.mediaDevices){ showOverlay('이 화면에서는 카메라를 쓸 수 없습니다','인터넷 주소(https)로 열어야 카메라가 켜집니다. 사진을 올려서 만들 수도 있습니다.',false); return; }
  showOverlay('카메라 여는 중…','카메라 사용 허용을 물으면 "허용"을 눌러 주세요.',true);
  try{ await openCamera(S.facing); }catch(e){ showOverlay('카메라를 켤 수 없습니다',cameraErrorText(e),false); return; }
  onSourceReady(); setHud({count:0,cue:'몸이 화면에 보이게 서 주세요',sev:'',phase:'준비'}); Coach.say('모범 자세를 잡아 주세요. 셋을 세고 찍습니다',{force:true});
}
function captureTick(lm,W,H,ts){ if(M){ motionTick(lm,W,H,ts); return; } if(!K) return; const p= lm&&lm.length>=33? analyzePose(lm,W,H):null; const ok= !!p&&(p.fullBody||p.upperBody||p.deskBody);
  draw(lm,W,H,{angle:null,sev:K.state==='shoot'?'good':'',pose:p});
  if(K.state==='detect'){ if(ok){ if(!K.since) K.since=ts; if(ts-K.since>1000){ K.state='countdown'; K.end=ts+3000; K.lastCount=null; $('#countdown').hidden=false; } } else K.since=null; setHud({count:K.samples.length,cue: ok?'좋아요, 모범 자세를 잡으세요':'몸이 화면에 보이게 서 주세요',sev: ok?'good':'',phase:'준비'}); return; }
  if(K.state==='countdown'){ const left=Math.ceil((K.end-ts)/1000); if(left!==K.lastCount){ K.lastCount=left; $('#countNum').textContent= left>0?left:'찰칵'; if(left>0) Coach.say(String(left),{force:true}); } setHud({count:K.samples.length,cue:'자세를 잡고 그대로 멈추세요',sev:'warn',phase:`${K.samples.length+1}번째`}); if(ts>=K.end){ $('#countdown').hidden=true; K.state='shoot'; K.end=ts+700; K.buf=[]; } return; }
  if(K.state==='shoot'){ if(ok) K.buf.push(poseSample(lm,W,H)); setHud({count:K.samples.length,cue:'찰칵!',sev:'good',phase:'찍는 중'});
    if(ts>=K.end){ if(K.buf.length>=4){ K.samples.push(mergeSamples(K.buf)); beep(1320,90); bigMsg(`찰칵! ${K.samples.length}/${K.n}`,900); Coach.say(K.samples.length>=K.n?'다 찍었어요':'찰칵. 자세를 풀었다가 다시 잡으세요',{force:true}); } else bigMsg('몸이 안 보였어요. 다시 찍을게요',1100);
      if(K.samples.length>=K.n){ finishCapture(); return; } K.state='rest'; K.end=ts+2600; } return; }
  if(K.state==='rest'){ setHud({count:K.samples.length,cue:'자세를 풀었다가 다시 잡으세요',sev:'',phase:`${K.samples.length}/${K.n}`}); if(ts>=K.end){ K.state='detect'; K.since=null; } }
}
function finishCapture(){ if(M){ motionManual(); return; } const k=K; if(!k) return; K=null; stopSource(); S.flow='idle'; if(!k.samples.length){ toast('찍힌 자세가 없습니다'); if(k.onCancel) k.onCancel(); else showView('create'); return; } k.onDone(k.samples); }
function cancelCapture(){ if(M){ const m=M; M=null; $('#btnEndSet').textContent='끝내기'; if(m.onCancel) m.onCancel(); return; } const k=K; K=null; if(k&&k.onCancel) k.onCancel(); }

/* ---------- 사진·영상 파일에서 자세 읽기 ---------- */
const loadImage=(file)=>new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>res(img); img.onerror=()=>rej(new Error('사진을 열 수 없습니다')); img.src=URL.createObjectURL(file); });
function detectOn(el,times=1){ let lm=null; for(let i=0;i<times;i++){ let ts=performance.now(); if(ts<=S.lastTs) ts=S.lastTs+1; S.lastTs=ts; try{ const r=S.landmarker.detectForVideo(el,ts); lm=(r&&r.landmarks&&r.landmarks[0])||lm; }catch(e){} } return lm&&lm.length>=33? lm : null; }
async function samplesFromFiles(files,onProgress){ await ensureLandmarker(1); hideOverlay(); const out=[]; const cv=document.createElement('canvas'), c=cv.getContext('2d'); let i=0;
  for(const f of files){ i++; if(onProgress) onProgress(i,files.length);
    if((f.type||'').startsWith('video/')){ out.push(...await stillFromVideo(f)); continue; }
    try{ const img=await loadImage(f); const sc=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight)); cv.width=Math.round(img.naturalWidth*sc); cv.height=Math.round(img.naturalHeight*sc); c.drawImage(img,0,0,cv.width,cv.height); URL.revokeObjectURL(img.src); const lm=detectOn(cv,3); if(lm) out.push(poseSample(lm,cv.width,cv.height)); }catch(e){} }
  return out; }
/** 영상에서 0.7초 이상 멈춘 자세를 찾아낸다(예: 활을 끝까지 당기고 멈춘 순간). 영상은 이 기기 안에서만 재생·분석한다. */
function stillFromVideo(file){ return new Promise((res)=>{ const v=document.createElement('video'); v.muted=true; v.playsInline=true; const url=URL.createObjectURL(file); v.src=url; const cap=new StillCapture(); let done=false; const finish=()=>{ if(done) return; done=true; try{ v.pause(); URL.revokeObjectURL(url); }catch(e){} res(cap.samples.slice(0,12)); };
  const step=()=>{ if(done) return; if(v.ended||v.error){ finish(); return; } if(v.readyState>=2&&v.videoWidth){ const lm=detectOn(v,1); cap.update(lm,v.videoWidth,v.videoHeight,v.currentTime*1000); } ('requestVideoFrameCallback' in v)? v.requestVideoFrameCallback(step) : requestAnimationFrame(step); };
  v.onended=finish; v.onerror=finish; v.play().then(step).catch(finish); setTimeout(finish,150000); }); }

/* ---------- 모범 동작 찍기: 한 손 들기 → 셋 세기 → 동작 한 번 → 다시 한 손 들기. 이것을 3번 ---------- */
let M=null; // 동작을 찍는 중 상태
const MOTION_MAX=15; // 한 번에 찍는 가장 긴 시간(초)
async function startMotionCapture(opts){
  initAudio(); M={n:opts.n||3, lead:opts.lead||3, fixed:opts.fixed||0, takes:(opts.takes||[]).slice(), state:'wait', sig:new HandSignal(), frames:[], end:0, t0:0, armAt:0, lastCount:null, saidAt:0, onDone:opts.onDone, onCancel:opts.onCancel||null}; M.goalN=M.takes.length+M.n;
  S.session={mode:'capture', movement:{name:'모범 동작 찍기', type:'match', view:'upper', highlight:[]}}; S.result=null; S.flow='idle';
  showView('stage'); stage.classList.add('big'); stage.classList.remove('blind'); stageButtons('capture'); $('#stTitle').textContent='모범 동작 찍기'; $('#stStats').hidden=true; $('#stepbar').hidden=true; $('#hudGoal').textContent=`/ ${M.goalN}번`; $('#btnEndSet').textContent='지금 시작'; Coach.enabled=$('#voiceToggle').checked;
  $('#sourceNote').textContent=`한 손을 머리 위로 들면 ${M.lead}초를 세고 찍기 시작합니다. 동작을 한 번 하고 ${M.fixed?`${M.fixed}초 뒤 저절로 끝납니다`:'다시 한 손을 들면 끝납니다'}. 찍은 영상은 저장하거나 보내지 않고, 관절의 움직임(숫자)만 남깁니다.`;
  try{ await ensureLandmarker(1); }catch(e){ return; }
  if(!navigator.mediaDevices){ showOverlay('이 화면에서는 카메라를 쓸 수 없습니다','인터넷 주소(https)로 열어야 카메라가 켜집니다. 찍어 둔 영상을 올려서 만들 수도 있습니다.',false); return; }
  showOverlay('카메라 여는 중…','카메라 사용 허용을 물으면 "허용"을 눌러 주세요.',true);
  try{ await openCamera(S.facing); }catch(e){ showOverlay('카메라를 켤 수 없습니다',cameraErrorText(e),false); return; }
  onSourceReady(); setHud({count:M.takes.length,cue:'몸이 화면에 보이게 서 주세요',sev:'',phase:'준비'}); Coach.say('몸이 보이게 선 다음, 한 손을 머리 위로 들면 시작합니다',{force:true}); M.saidAt=performance.now();
}
function motionCount(ts){ M.state='count'; M.end=ts+M.lead*1000; M.lastCount=null; $('#countdown').hidden=false; $('#btnEndSet').textContent='끝내기'; Coach.say(M.takes.length||M.fixed? '손을 내리고 준비하세요' : '손을 내리고 준비하세요. 동작이 끝나면 다시 한 손을 드세요',{force:true}); }
function motionTick(lm,W,H,ts){ const has=!!(lm&&lm.length>=33); const p= has? analyzePose(lm,W,H):null; const ok= !!p&&(p.fullBody||p.upperBody||p.deskBody); const n=M.takes.length;
  draw(lm,W,H,{angle:null,sev:M.state==='rec'?'good':'',pose:p});
  if(M.state==='wait'){ const up= ok&&M.sig.update(lm,ts); setHud({count:n,cue: ok? (M.sig.raised?'좋아요, 그대로…':'한 손을 들면 시작') : '몸이 보이게 서 주세요',sev: ok?(M.sig.raised?'good':''):'',phase:`${n+1}번째 준비`}); if(up){ sfx('good'); motionCount(ts); return; }
    if(ok&&ts-M.saidAt>10000){ Coach.say('준비되면 한 손을 머리 위로 들어 주세요'); M.saidAt=ts; } return; }
  if(M.state==='count'){ const left=Math.ceil((M.end-ts)/1000); if(left!==M.lastCount){ M.lastCount=left; $('#countNum').textContent= left>0?left:'시작'; if(left>0&&left<=3){ Coach.say(String(left),{force:true}); beep(520,80); } }
    setHud({count:n,cue:'손 내리고 준비',sev:'warn',phase:`${n+1}번째`}); if(ts>=M.end){ $('#countdown').hidden=true; M.state='rec'; M.frames=[]; M.t0=ts; M.armAt=ts+1200; M.sig.reset(); $('#recBadge').hidden=false; $('#btnEndSet').textContent='촬영 끝'; beep(940,160); Coach.say('시작',{force:true}); } return; }
  if(M.state==='rec'){ if(has) M.frames.push(motionFrame(lm,W,H,ts)); const el=(ts-M.t0)/1000; const byHand= !M.fixed&&ts>M.armAt&&has&&M.sig.update(lm,ts);
    setHud({count:n,cue: M.fixed? `찍는 중 · ${Math.max(0,Math.ceil(M.fixed-el))}초 남음` : `찍는 중 ${el.toFixed(1)}초`,sev:'good',phase: M.fixed?'찍는 중':'끝나면 한 손 들기'});
    if(byHand||(M.fixed&&el>=M.fixed)||el>=MOTION_MAX) motionEndTake(byHand,ts); return; }
  if(M.state==='rest'){ setHud({count:n,cue: n>=M.goalN?'다 찍었어요':'좋아요. 다시 한 손을 들면 다음',sev:'good',phase:`${n}/${M.goalN}`}); if(ts>=M.end){ if(n>=M.goalN){ motionFinish(); return; } M.state='wait'; M.sig.reset(); $('#btnEndSet').textContent='지금 시작'; M.saidAt=ts; } }
}
function motionEndTake(byHand,ts){ $('#recBadge').hidden=true; let fr= byHand? cutGestureTail(M.frames) : M.frames; const dur= fr.length>1? (fr[fr.length-1].t-fr[0].t)/1000 : 0; M.state='rest'; M.end=ts+2200; $('#btnEndSet').textContent='끝내기';
  if(fr.length<8||dur<0.8){ beep(220,200); bigMsg('너무 짧아요. 다시 찍을게요',1600); Coach.say('너무 짧았어요. 다시 찍을게요',{force:true}); return; }
  M.takes.push(fr); sfx('good'); const n=M.takes.length; bigMsg(`${n} / ${M.goalN} 찍었어요`,1500); Coach.say(n>=M.goalN? '다 찍었어요' : `${n}번째 끝. 준비되면 다시 한 손을 드세요`,{force:true}); }
function motionManual(){ if(!M) return; const ts=performance.now(); if(M.state==='wait') motionCount(Math.max(ts,S.lastTs)); else if(M.state==='rec') motionEndTake(false,Math.max(ts,S.lastTs)); else if(M.state==='rest'||M.state==='count') motionFinish(); }
function motionFinish(){ const m=M; if(!m) return; M=null; $('#btnEndSet').textContent='끝내기'; $('#countdown').hidden=true; stopSource(); S.flow='idle'; if(!m.takes.length){ toast('찍힌 동작이 없습니다'); if(m.onCancel) m.onCancel(); else showView('create'); return; } m.onDone(m.takes); }
/** 찍어 둔 영상 파일 → 동작 한 번(영상 하나가 한 번). 영상은 이 기기 안에서만 재생·분석한다. */
function takeFromVideo(file){ return new Promise((res)=>{ const v=document.createElement('video'); v.muted=true; v.playsInline=true; const url=URL.createObjectURL(file); v.src=url; const fr=[]; let done=false; const finish=()=>{ if(done) return; done=true; try{ v.pause(); URL.revokeObjectURL(url); }catch(e){} res(fr); };
  const step=()=>{ if(done) return; if(v.ended||v.error){ finish(); return; } if(v.readyState>=2&&v.videoWidth&&v.currentTime<=MOTION_MAX+1){ const lm=detectOn(v,1); if(lm) fr.push(motionFrame(lm,v.videoWidth,v.videoHeight,v.currentTime*1000)); } else if(v.currentTime>MOTION_MAX+1){ finish(); return; } ('requestVideoFrameCallback' in v)? v.requestVideoFrameCallback(step) : requestAnimationFrame(step); };
  v.onended=finish; v.onerror=finish; v.play().then(step).catch(finish); setTimeout(finish,60000); }); }

/* ---------- 만들기 시작 → 확인 화면 ---------- */
function startTemplateCreate(draft={}){
  const st={lead:draft.lead||3, fixed:draft.fixed||0};
  openSheet('모범 동작 만들기', `<div class="tplrev"><canvas class="figcv tall" id="mkCv"></canvas><div>
    <p style="margin:0 0 8px"><b>같은 동작을 3번 찍으면, 그 평균이 모범이 됩니다.</b></p>
    <ol class="howto"><li><b>한 손을 머리 위로</b> 들면 셋을 셉니다</li><li>모범 동작을 <b>한 번</b> 합니다</li><li>다시 <b>한 손을 들면</b> 끝. 이것을 3번</li></ol>
    <div class="field" style="margin-top:10px"><label>준비 시간 (손을 든 뒤 자리를 잡는 시간)</label><div class="btns" id="mkLead">${[3,5,10].map(v=>`<button class="btn sm" data-v="${v}" aria-pressed="${st.lead===v}">${v}초</button>`).join('')}</div></div>
    <div class="field" style="margin-top:8px"><label>끝내는 방법</label><div class="btns" id="mkFixed">${[[0,'한 손 들기'],[5,'5초 뒤 저절로'],[10,'10초 뒤 저절로']].map(([v,l])=>`<button class="btn sm" data-v="${v}" aria-pressed="${st.fixed===v}">${l}</button>`).join('')}</div></div>
    <div class="btns" style="margin-top:14px;flex-direction:column;align-items:stretch"><button class="btn primary big" id="mkCam">${ICON.video} 모범 동작 찍기 (3번)</button></div>
    <details class="more"><summary>다른 방법으로 만들기</summary><div class="btns" style="margin-top:10px"><label class="btn file">${ICON.upload} 찍어 둔 영상 올리기 (동작 한 번씩, 여러 개)<input type="file" id="mkVideos" accept="video/*" multiple></label><button class="btn" id="mkStill">${ICON.camera} 멈춘 자세로 만들기 (사진 3번)</button></div>
      <p class="note" style="margin-top:6px">영상과 사진은 이 기기 밖으로 나가지 않습니다. 관절의 움직임(숫자)만 모범으로 남습니다.</p></details>
    <p class="note" id="mkNote" style="margin-top:6px"></p></div></div>`);
  mountScene($('#mkCv'),'match',{cue:true});
  const pick=(box,key)=>$$(`${box} [data-v]`).forEach(b=>b.addEventListener('click',()=>{ st[key]=+b.dataset.v; $$(`${box} [data-v]`).forEach(x=>x.setAttribute('aria-pressed',String(x===b))); })); pick('#mkLead','lead'); pick('#mkFixed','fixed');
  $('#mkCam').onclick=()=>{ closeSheet(); startMotionCapture({n:3, lead:st.lead, fixed:st.fixed, onDone:(t)=>{ showView('create'); openMotionReview(t,Object.assign({},draft,st)); }, onCancel:()=>showView('create')}); };
  $('#mkStill').onclick=()=>startStillCreate(draft);
  $('#mkVideos').addEventListener('change',async(e)=>{ const files=[...e.target.files].slice(0,6); if(!files.length) return; const note=$('#mkNote'); note.textContent='동작을 읽는 중…'; try{ await ensureLandmarker(1); hideOverlay(); const takes=[]; let i=0; for(const f of files){ i++; note.textContent=`동작을 읽는 중… ${i}/${files.length}`; const t=await takeFromVideo(f); if(t.length>=8) takes.push(t); } if(!takes.length){ note.textContent='영상에서 사람의 동작을 찾지 못했습니다. 몸이 잘 보이는 영상으로 다시 해 주세요.'; return; } openMotionReview(takes,Object.assign({},draft,st)); }catch(err){ note.textContent='읽지 못했습니다: '+((err&&err.message)||'오류'); } });
}
const STRICT={ easy:{tol:20,pass:75,label:'너그럽게'}, normal:{tol:14,pass:80,label:'보통'}, strict:{tol:10,pass:85,label:'엄격하게'} };
function openMotionReview(takes,draft={}){
  const st={ items:takes.map(t=>({t,on:true})), name:draft.name||'', strict:draft.strict||'normal', count:draft.count||10, use:new Set(draft.use||['arms','body','legs']), lead:draft.lead||3, fixed:draft.fixed||0 };
  const build=()=>{ const on=st.items.filter(x=>x.on).map(x=>x.t); return on.length? buildMotionTemplate(on,{tol:STRICT[st.strict].tol}) : null; };
  const render=()=>{ const tpl=build(); const on=st.items.filter(x=>x.on).length; const groups= tpl? [...new Set(tpl.keys.map(k=>FEATURES[k].group))] : []; const uneven= tpl&&on>1&&tpl.sd>9;
    openSheet('모범 동작 확인', `<div class="tplrev"><canvas class="figcv tall" id="tplCv"></canvas><div>
      <div class="field"><label for="tName">동작 이름</label><input type="text" id="tName" maxlength="30" value="${esc(st.name)}" placeholder="예: 양궁 슈팅, 인사, 가슴압박 준비"></div>
      <p class="note" style="margin-top:8px">${tpl? `${on}번의 평균 · 길이 ${tpl.dur}초${on>1?` · 찍은 동작끼리의 차이 평균 ±${tpl.sd}°`:''}${tpl.move<12?' · 거의 움직이지 않는 "멈춘 자세"입니다':''}` : '쓸 수 있는 동작이 없습니다. 다시 찍어 주세요.'}</p>
      ${uneven?'<p class="callout warn" style="margin-top:8px">찍은 동작끼리 차이가 큽니다. 같은 빠르기·같은 모양으로 다시 찍으면 더 믿을 만한 모범이 됩니다.</p>':''}${tpl&&on===1?'<p class="note">한두 번 더 찍으면 더 믿을 만한 모범이 됩니다.</p>':''}
      <div class="shots" id="tShots">${st.items.map((x,i)=>`<button class="shot" data-i="${i}" aria-pressed="${x.on}" title="눌러서 넣기/빼기"><canvas class="figcv"></canvas><span>${i+1}번 · ${x.on?'넣음':'뺌'}</span></button>`).join('')}</div>
      <p class="note">잘못 찍힌 것은 눌러서 빼세요.</p></div></div>
      <div class="grid3" style="margin-top:10px"><div class="field"><label>볼 부위</label><div class="btns" id="tUse">${Object.entries(FEATURE_GROUPS).map(([g,n])=>`<button class="btn sm" data-g="${g}" aria-pressed="${st.use.has(g)&&groups.includes(g)}" ${groups.includes(g)?'':'disabled'}>${n}</button>`).join('')}</div></div>
        <div class="field"><label for="tCount">따라 할 횟수</label><select id="tCount">${[3,5,10,20].map(v=>`<option value="${v}" ${v===st.count?'selected':''}>${v}번</option>`).join('')}</select></div>
        <div class="field"><label for="tStrict">엄격도</label><select id="tStrict">${Object.entries(STRICT).map(([k,v])=>`<option value="${k}" ${k===st.strict?'selected':''}>${v.label} (±${v.tol}°)</option>`).join('')}</select></div></div>
      <div class="btns" style="margin-top:12px"><button class="btn primary big" id="tOk" ${tpl?'':'disabled'}>이 모범으로 정하기</button><button class="btn" id="tMore">한 번 더 찍기</button><button class="btn" id="tRedo">처음부터 다시</button></div>`);
    if(tpl) mountMotion($('#tplCv'),tpl,{label:'모범'}); $$('#tShots .shot').forEach(b=>{ const x=st.items[+b.dataset.i]; const one=buildMotionTemplate([x.t]); if(one) mountMotion(b.querySelector('canvas'),one,{color:x.on?INK.body:INK.dim,bar:false}); b.addEventListener('click',()=>{ keep(); x.on=!x.on; render(); }); });
    const keep=()=>{ st.name=$('#tName').value.trim(); st.count=+$('#tCount').value; st.strict=$('#tStrict').value; }; const draftOf=()=>({name:st.name,strict:st.strict,count:st.count,use:[...st.use],lead:st.lead,fixed:st.fixed});
    $$('#tUse [data-g]').forEach(b=>b.addEventListener('click',()=>{ keep(); const g=b.dataset.g; if(st.use.has(g)){ if([...st.use].filter(x=>groups.includes(x)).length>1) st.use.delete(g); } else st.use.add(g); render(); }));
    $('#tStrict').addEventListener('change',()=>{ keep(); render(); });
    $('#tMore').onclick=()=>{ keep(); closeSheet(); startMotionCapture({n:1, lead:st.lead, fixed:st.fixed, takes:st.items.map(x=>x.t), onDone:(all)=>{ showView('create'); openMotionReview(all,draftOf()); }, onCancel:()=>{ showView('create'); render(); }}); };
    $('#tRedo').onclick=()=>{ keep(); startTemplateCreate(draftOf()); };
    $('#tOk').onclick=()=>{ keep(); const t=build(); if(!t) return; if(!st.name){ toast('동작 이름을 적어 주세요'); $('#tName').focus(); return; } const use=[...st.use].filter(g=>groups.includes(g)); const def={id:'cm'+uid(6), kind:'motion', name:st.name, tpl:t, use: use.length===groups.length? null : use, count:st.count, pass:STRICT[st.strict].pass, createdAt:Date.now()}; C.custom=def; C.movement=null; rememberModel(def); $('#fGoal').value=st.count; $('#fGoal').dataset.touched='1'; closeSheet(); renderCreate(); gotoStep(3); toast(`"${def.name}" 모범이 준비되었습니다`); };
  };
  render();
}
/* 멈춘 자세(사진)로 만드는 예전 방식: 버티는 자세·한순간의 자세에 쓴다 */
function startStillCreate(draft={}){
  openSheet('멈춘 자세로 만들기', `<div class="tplrev"><canvas class="figcv tall" id="mkCv"></canvas><div><p style="margin:0 0 6px"><b>모범 자세를 3번 찍으면, 그 평균이 모범이 됩니다.</b></p><p class="note">움직임이 아니라 한순간의 자세(예: 활을 끝까지 당긴 순간, 인사 30°)를 맞출 때 씁니다. 참여자는 화면의 점선에 몸을 맞추고 그대로 멈춥니다.</p>
    <div class="btns" style="margin-top:12px;flex-direction:column;align-items:stretch"><button class="btn primary big" id="mkCam">${ICON.camera} 카메라로 3번 찍기</button><label class="btn file">${ICON.upload} 사진·영상 올리기<input type="file" id="mkFiles" accept="image/*,video/*" multiple></label></div>
    <p class="note" style="margin-top:8px">가장 잘했을 때의 사진을 여러 장 올려도 됩니다. 사진·영상은 이 기기 밖으로 나가지 않습니다.</p><p class="note" id="mkNote"></p></div></div>`);
  mountScene($('#mkCv'),'match',{cue:true,still:true});
  $('#mkCam').onclick=()=>{ closeSheet(); startCapture({n:3, onDone:(s)=>{ showView('create'); openTemplateReview(s,draft); }, onCancel:()=>showView('create')}); };
  $('#mkFiles').addEventListener('change',async(e)=>{ const files=[...e.target.files]; if(!files.length) return; const note=$('#mkNote'); note.textContent='자세를 읽는 중…'; try{ const s=await samplesFromFiles(files,(i,n)=>{ note.textContent=`자세를 읽는 중… ${i}/${n}`; }); if(!s.length){ note.textContent='사람의 자세를 찾지 못했습니다. 몸이 잘 보이는 사진으로 다시 해 주세요.'; return; } openTemplateReview(s,draft); }catch(err){ note.textContent='읽지 못했습니다: '+((err&&err.message)||'오류'); } });
}
function openTemplateReview(samples,draft={}){
  const st={ items:samples.map(s=>({s,on:true})), name:draft.name||'', hold:draft.hold||2, strict:draft.strict||'normal', use:new Set(draft.use||['arms','body','legs']) };
  const tolOf=()=>st.strict==='easy'?18:st.strict==='strict'?8:12; const build=()=>{ const on=st.items.filter(x=>x.on).map(x=>x.s); return on.length? buildPoseTemplate(on,{tol:tolOf()}) : null; };
  const render=()=>{ const tpl=build(); const on=st.items.filter(x=>x.on).length; const groups= tpl? [...new Set(Object.keys(tpl.f).map(k=>FEATURES[k].group))] : [];
    openSheet('모범 자세 확인', `<div class="tplrev"><canvas class="figcv tall" id="tplCv"></canvas><div>
      <div class="field"><label for="tName">자세 이름</label><input type="text" id="tName" maxlength="30" value="${esc(st.name)}" placeholder="예: 양궁 풀 드로, 인사 30도"></div>
      <p class="note" style="margin-top:8px">${tpl? `${on}장의 평균입니다.${on>1?` 찍은 자세끼리의 차이는 평균 ±${tpl.sd}°.`:' 두세 장 더 찍으면 더 믿을 만한 모범이 됩니다.'}` : '쓸 수 있는 자세가 없습니다. 다시 찍어 주세요.'}</p>
      <div class="shots" id="tShots">${st.items.map((x,i)=>`<button class="shot" data-i="${i}" aria-pressed="${x.on}" title="눌러서 넣기/빼기"><canvas class="figcv"></canvas><span>${x.on?'넣음':'뺌'}</span></button>`).join('')}</div>
      <p class="note">모범이 아닌 장면은 눌러서 빼세요.</p></div></div>
      <div class="grid3" style="margin-top:10px"><div class="field"><label>볼 부위</label><div class="btns" id="tUse">${Object.entries(FEATURE_GROUPS).map(([g,n])=>`<button class="btn sm" data-g="${g}" aria-pressed="${st.use.has(g)&&groups.includes(g)}" ${groups.includes(g)?'':'disabled'}>${n}</button>`).join('')}</div></div>
        <div class="field"><label for="tHold">멈춰 있는 시간</label><select id="tHold">${[1,2,3,5,10].map(v=>`<option value="${v}" ${v===st.hold?'selected':''}>${v}초</option>`).join('')}</select></div>
        <div class="field"><label for="tStrict">엄격도</label><select id="tStrict"><option value="easy" ${st.strict==='easy'?'selected':''}>너그럽게 (±18°)</option><option value="normal" ${st.strict==='normal'?'selected':''}>보통 (±12°)</option><option value="strict" ${st.strict==='strict'?'selected':''}>엄격하게 (±8°)</option></select></div></div>
      <div class="btns" style="margin-top:12px"><button class="btn primary big" id="tOk" ${tpl?'':'disabled'}>이 모범으로 정하기</button><button class="btn" id="tMore">한 장 더 찍기</button></div>`);
    if(tpl) drawTemplate($('#tplCv'),tpl,{label:'모범'}); $$('#tShots .shot').forEach(b=>{ const x=st.items[+b.dataset.i]; const one=buildPoseTemplate([x.s]); if(one) drawTemplate(b.querySelector('canvas'),one,{color:x.on?INK.body:INK.dim}); b.addEventListener('click',()=>{ keep(); x.on=!x.on; render(); }); });
    const keep=()=>{ st.name=$('#tName').value.trim(); st.hold=+$('#tHold').value; st.strict=$('#tStrict').value; };
    $$('#tUse [data-g]').forEach(b=>b.addEventListener('click',()=>{ keep(); const g=b.dataset.g; if(st.use.has(g)){ if([...st.use].filter(x=>groups.includes(x)).length>1) st.use.delete(g); } else st.use.add(g); render(); }));
    $('#tStrict').addEventListener('change',()=>{ keep(); render(); });
    $('#tMore').onclick=()=>{ keep(); closeSheet(); startCapture({n:1, onDone:(more)=>{ showView('create'); openTemplateReview(st.items.map(x=>x.s).concat(more), {name:st.name,hold:st.hold,strict:st.strict,use:[...st.use]}); }, onCancel:()=>{ showView('create'); render(); }}); };
    $('#tOk').onclick=()=>{ keep(); const t=build(); if(!t) return; if(!st.name){ toast('자세 이름을 적어 주세요'); $('#tName').focus(); return; } const use=[...st.use].filter(g=>groups.includes(g)); const def={id:'cm'+uid(6), kind:'match', name:st.name, tpl:t, hold:st.hold, use: use.length===groups.length? null : use, count:3, createdAt:Date.now()}; C.custom=def; C.movement=null; rememberModel(def); closeSheet(); renderCreate(); gotoStep(3); toast(`"${def.name}" 모범이 준비되었습니다`); };
  };
  render();
}
