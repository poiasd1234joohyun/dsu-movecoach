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
function captureTick(lm,W,H,ts){ if(!K) return; const p= lm&&lm.length>=33? analyzePose(lm,W,H):null; const ok= !!p&&(p.fullBody||p.upperBody||p.deskBody);
  draw(lm,W,H,{angle:null,sev:K.state==='shoot'?'good':'',pose:p});
  if(K.state==='detect'){ if(ok){ if(!K.since) K.since=ts; if(ts-K.since>1000){ K.state='countdown'; K.end=ts+3000; K.lastCount=null; $('#countdown').hidden=false; } } else K.since=null; setHud({count:K.samples.length,cue: ok?'좋아요, 모범 자세를 잡으세요':'몸이 화면에 보이게 서 주세요',sev: ok?'good':'',phase:'준비'}); return; }
  if(K.state==='countdown'){ const left=Math.ceil((K.end-ts)/1000); if(left!==K.lastCount){ K.lastCount=left; $('#countNum').textContent= left>0?left:'찰칵'; if(left>0) Coach.say(String(left),{force:true}); } setHud({count:K.samples.length,cue:'자세를 잡고 그대로 멈추세요',sev:'warn',phase:`${K.samples.length+1}번째`}); if(ts>=K.end){ $('#countdown').hidden=true; K.state='shoot'; K.end=ts+700; K.buf=[]; } return; }
  if(K.state==='shoot'){ if(ok) K.buf.push(poseSample(lm,W,H)); setHud({count:K.samples.length,cue:'찰칵!',sev:'good',phase:'찍는 중'});
    if(ts>=K.end){ if(K.buf.length>=4){ K.samples.push(mergeSamples(K.buf)); beep(1320,90); bigMsg(`찰칵! ${K.samples.length}/${K.n}`,900); Coach.say(K.samples.length>=K.n?'다 찍었어요':'찰칵. 자세를 풀었다가 다시 잡으세요',{force:true}); } else bigMsg('몸이 안 보였어요. 다시 찍을게요',1100);
      if(K.samples.length>=K.n){ finishCapture(); return; } K.state='rest'; K.end=ts+2600; } return; }
  if(K.state==='rest'){ setHud({count:K.samples.length,cue:'자세를 풀었다가 다시 잡으세요',sev:'',phase:`${K.samples.length}/${K.n}`}); if(ts>=K.end){ K.state='detect'; K.since=null; } }
}
function finishCapture(){ const k=K; if(!k) return; K=null; stopSource(); S.flow='idle'; if(!k.samples.length){ toast('찍힌 자세가 없습니다'); if(k.onCancel) k.onCancel(); else showView('create'); return; } k.onDone(k.samples); }
function cancelCapture(){ const k=K; K=null; if(k&&k.onCancel) k.onCancel(); }

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

/* ---------- 만들기 시작 → 확인 화면 ---------- */
function startTemplateCreate(draft={}){
  openSheet('모범 자세 만들기', `<div class="tplrev"><canvas class="figcv tall" id="mkCv"></canvas><div><p style="margin:0 0 6px"><b>모범 자세를 3번 찍으면, 그 평균이 모범이 됩니다.</b></p><p class="note">학생은 화면의 점선(모범)에 몸을 맞추고, 얼마나 비슷한지 점수로 받습니다. 다른 부위는 "오른팔을 더 올리세요"처럼 말로 알려 줍니다.</p>
    <div class="btns" style="margin-top:12px;flex-direction:column;align-items:stretch"><button class="btn primary big" id="mkCam">📷 카메라로 3번 찍기</button><label class="btn file">🖼️ 사진·영상 올리기<input type="file" id="mkFiles" accept="image/*,video/*" multiple></label></div>
    <p class="note" style="margin-top:8px">가장 잘했을 때의 사진을 여러 장 올려도 됩니다(예: 10점을 쏜 순간들). 영상을 올리면 멈춘 자세를 찾아냅니다. 사진·영상은 이 기기 밖으로 나가지 않습니다.</p><p class="note" id="mkNote"></p></div></div>`);
  mountScene($('#mkCv'),'match',{cue:true});
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
    $('#tOk').onclick=()=>{ keep(); const t=build(); if(!t) return; if(!st.name){ toast('자세 이름을 적어 주세요'); $('#tName').focus(); return; } const use=[...st.use].filter(g=>groups.includes(g)); const def={id:'cm'+uid(6), kind:'match', name:st.name, tpl:t, hold:st.hold, use: use.length===groups.length? null : use, count:3, createdAt:Date.now()}; C.custom=def; C.movement=null; closeSheet(); renderCreate(); gotoStep(3); toast(`"${def.name}" 모범이 준비되었습니다`); };
  };
  render();
}
