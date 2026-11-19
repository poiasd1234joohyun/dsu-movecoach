/* ===== DSU 무브코치 분석 엔진 (DOM 없음) =====
 * 자세 좌표(MediaPipe 33점) → 관절 각도 → 동작별 판정.
 * 동작 유형: rep(반복), hold(유지), rate(압박 속도), procedure(절차: 여러 단계), match(모범 자세 따라 하기), gait(달리기)
 */
const escH=(s)=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); // 링크로 받은 글자를 화면에 넣기 전에 반드시 거친다
export const J = { nose:0, lear:7, rear:8, lsho:11, rsho:12, lelb:13, relb:14, lwri:15, rwri:16, lidx:19, ridx:20, lhip:23, rhip:24, lknee:25, rknee:26, lank:27, rank:28, lheel:29, rheel:30, lfoot:31, rfoot:32 };
export const CONNECTIONS = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[27,31],[28,30],[30,32],[28,32]];
const deg = (r)=>r*180/Math.PI;
export const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
export function angleAt(a,b,c){ const v1={x:a.x-b.x,y:a.y-b.y}, v2={x:c.x-b.x,y:c.y-b.y}; const d=v1.x*v2.x+v1.y*v2.y; const m=Math.hypot(v1.x,v1.y)*Math.hypot(v2.x,v2.y); if(!m) return 180; return deg(Math.acos(clamp(d/m,-1,1))); }
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,v:Math.min(a.v,b.v)});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const leanFromVertical=(lower,upper)=>deg(Math.atan2(Math.abs(upper.x-lower.x), -(upper.y-lower.y)));

/** 한 프레임의 좌표를 픽셀로 바꾸고 좌/우 관절 지표를 계산 */
export function analyzePose(lm, W, H){
  const P=(i)=>({x:lm[i].x*W, y:lm[i].y*H, v: lm[i].visibility==null?1:lm[i].visibility});
  const side=(l)=> l? {sho:P(11),elb:P(13),wri:P(15),hip:P(23),knee:P(25),ank:P(27),heel:P(29),foot:P(31)} : {sho:P(12),elb:P(14),wri:P(16),hip:P(24),knee:P(26),ank:P(28),heel:P(30),foot:P(32)};
  const L=side(true), R=side(false), nose=P(0);
  const shoMid=mid(L.sho,R.sho), hipMid=mid(L.hip,R.hip); const torso=dist(shoMid,hipMid)||1;
  const frontal = dist(L.sho,R.sho)/torso > 0.45;
  const vis=(S,keys)=>keys.reduce((s,k)=>s+S[k].v,0)/keys.length;
  const fullBody=['sho','hip','knee','ank'].every(k=>Math.max(L[k].v,R[k].v)>0.6);
  const upperBody=['sho','elb','wri','hip'].every(k=>Math.max(L[k].v,R[k].v)>0.6);
  const handsUp = L.wri.v>0.5 && R.wri.v>0.5 && nose.v>0.5 && L.wri.y<nose.y && R.wri.y<nose.y;
  // 책상 앞(상체만 보임): 양쪽 어깨·팔꿈치·손목이 보이면 준비. 엉덩이는 책상에 가려도 된다.
  const deskBody=['sho','elb','wri'].every(k=>Math.min(L[k].v,R[k].v)>0.5);
  const shoW=dist(L.sho,R.sho)||1;
  const shoulderTilt=deg(Math.atan2(Math.abs(L.sho.y-R.sho.y), Math.abs(L.sho.x-R.sho.x)||1e-6)); // 0이면 어깨가 수평
  const armLen=(S)=>dist(S.sho,S.elb)+dist(S.elb,S.wri);
  const reach=Math.max(armLen(L),armLen(R),1.5*shoW); // 팔을 굽혀 짧게 보일 때를 대비해 어깨너비로 하한을 둔다
  const headroom=(shoMid.y-reach)/H; // 0보다 크면 손을 머리 위로 뻗어도 화면 안
  const metricsFor=(S)=>{
    const knee=angleAt(S.hip,S.knee,S.ank), hip=angleAt(S.sho,S.hip,S.knee), elbow=angleAt(S.sho,S.elb,S.wri), shoulder=angleAt(S.elb,S.sho,S.hip);
    const bodyline=angleAt(S.sho,S.hip,S.ank), bodyDev=180-bodyline;
    const d2=dist(S.sho,S.ank)**2||1; const t=((S.hip.x-S.sho.x)*(S.ank.x-S.sho.x)+(S.hip.y-S.sho.y)*(S.ank.y-S.sho.y))/d2; const proj={x:S.sho.x+t*(S.ank.x-S.sho.x), y:S.sho.y+t*(S.ank.y-S.sho.y)};
    const hipAbove = S.hip.y < proj.y; // 화면에서 위쪽이면 엉덩이가 올라간 것(파이크)
    const trunkLean=leanFromVertical(S.hip,S.sho);
    const armVertical=leanFromVertical(S.wri,S.sho); // 0이면 어깨가 손 바로 위
    const shank=dist(S.knee,S.ank)||1; const facing=Math.sign((S.foot.x-S.heel.x)||1);
    const kneeOverToe=((S.knee.x-S.foot.x)*facing)/shank; // >0 이면 무릎이 발끝보다 앞
    return {knee,hip,elbow,shoulder,bodyline,bodyDev,hipAbove,trunkLean,armVertical,kneeOverToe};
  };
  const mL=metricsFor(L), mR=metricsFor(R);
  const valgus = frontal ? Math.abs(L.knee.x-R.knee.x)/(Math.abs(L.ank.x-R.ank.x)||1) : null;
  return {L,R,mL,mR,nose,shoMid,hipMid,torso,frontal,fullBody,upperBody,deskBody,shoulderTilt,headroom,handsUp,valgus,vis,W,H};
}

/* ===== 동작 라이브러리 (내장 피드백 포함, 외부 AI 불필요) ===== */
export const MOVEMENTS = {
  squat: {
    id:'squat', name:'스쿼트', type:'rep', category:'하체', primary:'knee', chain:['hip','knee','ank'], angleLabel:'무릎 각도',
    stand:160, descend:150, target:100, countTol:25, minTempo:1.2, highlight:[[23,25],[25,27],[24,26],[26,28]],
    checks:[
      {code:'trunk', metric:'trunkLean', op:'>', value:55, pen:20, live:true},
      {code:'valgus', metric:'valgus', op:'<', value:0.8, pen:20, live:true, view:'frontal'},
    ],
    feedback:{
      depth:{label:'깊이 부족', cue:'더 깊이 앉으세요', fix:'허벅지가 바닥과 평행할 때까지', tip:'엉덩이를 뒤로 빼면서 무릎 각도가 목표(기본 100°) 이하가 될 때까지 내려가세요. 체중을 발뒤꿈치 쪽에 두면 더 깊이 앉을 수 있습니다.'},
      trunk:{label:'상체 숙임', cue:'상체를 세우세요', fix:'가슴 들고 시선 정면', tip:'내려갈 때 가슴을 들고 시선을 정면에 두세요. 상체가 55° 넘게 기울면 허리 부담이 커집니다. 발목이 뻣뻣하면 뒤꿈치 아래에 얇은 판을 받쳐 보세요.'},
      valgus:{label:'무릎 모임', cue:'무릎을 발끝 방향으로', fix:'무릎이 발끝과 같은 방향', tip:'무릎이 안쪽으로 모이면 무릎 인대에 부담이 갑니다. 발을 어깨너비보다 조금 넓게, 발끝을 15~30° 바깥으로 두고 무릎을 발끝 방향으로 밀어내세요.'},
      tempo:{label:'너무 빠름', cue:'천천히', fix:'내려갈 때 2초, 올라올 때 1초', tip:'반복이 1.2초보다 빠르면 근육 대신 반동을 쓰게 됩니다. 내려갈 때 둘을 세고 올라오세요.'},
    },
    live:{shallow:'더 깊이 앉으세요', nearly:'조금만 더', reached:'좋아요, 올라오세요', descending:'천천히 내려가세요', ready:'시작 자세로 서 주세요', partial:'더 깊이 앉아야 횟수로 인정돼요'},
    good:['좋아요','정확해요','잘했어요','바로 그 자세예요'],
    checkpoints:['발은 어깨너비, 발끝은 15~30° 바깥','엉덩이를 뒤로 빼며 시작','무릎은 발끝 방향','허벅지가 바닥과 평행할 때까지(무릎 100° 이하)','가슴 들고 시선 정면','뒤꿈치가 뜨지 않게'],
    setup:'측면 2~3m, 전신이 보이게. 정면에서는 무릎 모임도 함께 봅니다.',
  },
  pushup: {
    id:'pushup', name:'푸시업', type:'rep', category:'상체', primary:'elbow', chain:['sho','elb','wri'], angleLabel:'팔꿈치 각도',
    stand:155, descend:145, target:95, countTol:25, minTempo:1.0, highlight:[[11,13],[13,15],[12,14],[14,16]], avgFrontal:false,
    checks:[ {code:'body', metric:'bodyDev', op:'>', value:20, pen:20, live:true, variant:(m)=>m.hipAbove?'pike':'sag'} ],
    feedback:{
      depth:{label:'깊이 부족', cue:'가슴을 더 내리세요', fix:'팔꿈치 90° 근처까지', tip:'가슴이 주먹 하나 높이까지 내려가도록 팔꿈치를 90° 근처까지 굽히세요. 힘들면 무릎을 대고 깊이를 먼저 익히세요.'},
      body:{label:'몸 일직선 아님', cue:'몸을 일직선으로', fix:'어깨-엉덩이-발목 한 줄', tip:'복부와 엉덩이에 힘을 주어 어깨-엉덩이-발목이 한 줄이 되게 하세요.'},
      sag:{label:'엉덩이 처짐', cue:'엉덩이가 처졌어요, 배에 힘', fix:'복부에 힘, 골반 살짝 말기', tip:'엉덩이가 처지면 허리가 꺾입니다. 배꼽을 등 쪽으로 당기고 엉덩이에 힘을 주세요.'},
      pike:{label:'엉덩이 들림', cue:'엉덩이를 내리세요', fix:'엉덩이를 낮춰 일직선', tip:'엉덩이가 올라가면 가슴 대신 어깨만 쓰게 됩니다. 몸을 길게 늘인다는 느낌으로 엉덩이를 내리세요.'},
      tempo:{label:'너무 빠름', cue:'천천히', fix:'내려갈 때 2초', tip:'반동 없이 내려갈 때 둘을 세고 올라오세요.'},
    },
    live:{shallow:'가슴을 더 내리세요', nearly:'조금만 더', reached:'좋아요, 밀어 올리세요', descending:'천천히 내려가세요', ready:'팔을 펴고 플랭크 자세로 준비', partial:'더 내려가야 횟수로 인정돼요'},
    good:['좋아요','정확해요','잘했어요'],
    checkpoints:['손은 어깨보다 약간 넓게','어깨-엉덩이-발목 일직선','팔꿈치 90°까지 내리기','시선은 바닥 약간 앞','올라올 때 팔꿈치를 다 펴기'],
    setup:'측면에서 몸 전체가 보이게, 카메라는 바닥 가까이.',
  },
  lunge: {
    id:'lunge', name:'런지', type:'rep', category:'하체', primary:'knee', primaryMode:'min', chain:['hip','knee','ank'], angleLabel:'앞 무릎 각도',
    stand:160, descend:150, target:100, countTol:25, minTempo:1.2, highlight:[[23,25],[25,27],[24,26],[26,28]],
    checks:[ {code:'trunk', metric:'trunkLean', op:'>', value:25, pen:20, live:true}, {code:'kneeOver', metric:'kneeOverToe', op:'>', value:0.35, pen:15, live:true} ],
    feedback:{
      depth:{label:'깊이 부족', cue:'더 낮게 내려가세요', fix:'앞 무릎 90°, 뒷 무릎은 바닥 가까이', tip:'뒷 무릎이 바닥에 거의 닿을 때까지 수직으로 내려가세요. 보폭이 좁으면 깊이 내려가기 어렵습니다.'},
      trunk:{label:'상체 숙임', cue:'상체를 세우세요', fix:'상체 수직 유지', tip:'런지는 상체를 수직으로 유지해야 앞 무릎 부담이 줄어듭니다. 시선을 정면에 두세요.'},
      kneeOver:{label:'무릎이 발끝 넘음', cue:'앞 무릎이 발끝을 넘지 않게', fix:'보폭을 넓히고 수직으로 내려가기', tip:'앞 무릎이 발끝보다 많이 앞으로 나가면 무릎 관절에 부담이 큽니다. 보폭을 한 발 더 넓히고 아래로 내려가세요.'},
      tempo:{label:'너무 빠름', cue:'천천히', fix:'내려갈 때 2초', tip:'균형을 잡으며 천천히 내려가야 효과가 있습니다.'},
    },
    live:{shallow:'더 낮게 내려가세요', nearly:'조금만 더', reached:'좋아요, 올라오세요', descending:'천천히 내려가세요', ready:'한 발을 앞으로 내딛고 서 주세요', partial:'더 내려가야 횟수로 인정돼요'},
    good:['좋아요','균형이 좋아요','잘했어요'],
    checkpoints:['한 발 크게 앞으로','앞 무릎 90°, 뒷 무릎 바닥 가까이','상체 수직','앞 무릎이 발끝을 넘지 않게','양쪽 번갈아'],
    setup:'측면 2~3m, 전신이 보이게.',
  },
  press: {
    id:'press', name:'앉아서 팔 뻗기', type:'rep', category:'상체 · 앉아서', primary:'elbow', invert:true, view:'desk', bilateral:true, noHandsEnd:true,
    chain:['sho','elb','wri'], angleLabel:'팔꿈치 각도', trunkMetric:'shoulderTilt', trunkLabel:'어깨 기울기', phaseNames:{down:'뻗는 중', up:'준비 자세'},
    stand:100, descend:112, target:155, countTol:25, minTempo:1.0, highlight:[[11,13],[13,15],[12,14],[14,16]],
    checks:[
      {code:'uneven', metric:'armDiff', op:'>', value:25, pen:20, live:true},
      {code:'tilt', metric:'shoulderTilt', op:'>', value:12, pen:15, live:true},
    ],
    feedback:{
      depth:{label:'팔 덜 폄', cue:'팔을 끝까지 펴세요', fix:'팔꿈치가 다 펴질 때까지 위로', tip:'손을 머리 위로 밀어 올릴 때 팔꿈치가 완전히 펴지는 지점(155° 이상)까지 올리세요. 어깨가 뻣뻣하면 손을 조금 앞쪽으로 올려도 됩니다.'},
      uneven:{label:'양팔 높이 다름', cue:'양팔을 똑같이 펴세요', fix:'양손이 같은 높이에 오게', tip:'한쪽 팔만 덜 펴지면 그쪽 어깨가 굳어 있다는 신호입니다. 거울을 보듯 양손 높이를 맞추고, 덜 펴지는 쪽을 조금 더 천천히 올리세요.'},
      tilt:{label:'몸 기울어짐', cue:'어깨를 수평으로', fix:'허리를 세우고 양어깨 높이를 같게', tip:'팔을 올릴 때 몸이 한쪽으로 기울면 허리에 부담이 갑니다. 엉덩이를 의자 깊숙이 넣고 배에 가볍게 힘을 준 채 올리세요.'},
      tempo:{label:'너무 빠름', cue:'천천히', fix:'올릴 때 1초, 내릴 때 1초', tip:'반동으로 휘두르면 어깨 근육 대신 탄력을 쓰게 됩니다. 올릴 때 하나, 내릴 때 하나를 세세요.'},
    },
    live:{shallow:'팔을 더 펴세요', nearly:'조금만 더', reached:'좋아요, 내리세요', descending:'머리 위로 쭉 뻗으세요', ready:'양손을 어깨 옆으로 들어 주세요', partial:'팔을 끝까지 펴야 횟수로 인정돼요'},
    good:['좋아요','정확해요','잘했어요'],
    checkpoints:['의자에 깊숙이 앉아 허리를 세우기','양손을 어깨 옆에서 시작','머리 위로 팔꿈치가 다 펴질 때까지 뻗기','양손 높이를 똑같이','올릴 때 1초, 내릴 때 1초'],
    setup:'노트북이나 폰 정면에 앉아, 손을 머리 위로 뻗어도 손끝까지 화면에 보이도록 의자를 한 걸음 뒤로 빼 주세요.', setupSay:'양손을 어깨 옆으로 들어 주세요',
  },
  bow: {
    id:'bow', name:'인사 (허리 숙여 인사)', type:'rep', category:'응대 · 예절', primary:'trunkLean', invert:true, avgFrontal:false, labelJoint:'hip', chain:['sho','hip','ank'], angleLabel:'허리 숙인 각도', trunkMetric:'knee', trunkLabel:'무릎 각도', phaseNames:{down:'숙이는 중', up:'바로 선 자세'},
    stand:10, descend:14, target:30, countTol:10, minTempo:1.8, highlight:[[11,23],[12,24]], targets:[[15,'목례 15°'],[30,'보통례 30°'],[45,'정중례 45°']],
    checks:[
      {code:'over', metric:'trunkLean', op:'>', rel:18, pen:15},
      {code:'knee', metric:'knee', op:'<', value:158, pen:15, live:true},
    ],
    feedback:{
      depth:{label:'덜 숙임', cue:'조금 더 숙이세요', fix:'허리를 목표 각도까지', tip:'고개만 숙이지 말고 허리부터 접어 목표 각도까지 숙이세요. 등과 목은 일직선을 유지합니다.'},
      over:{label:'너무 깊이 숙임', cue:'조금 덜 숙이세요', fix:'목표 각도에서 멈추기', tip:'필요 이상으로 깊이 숙이면 균형이 흐트러집니다. 목표 각도에서 잠깐 멈췄다가 올라오세요.'},
      knee:{label:'무릎 굽힘', cue:'무릎을 펴세요', fix:'다리는 곧게, 허리만 접기', tip:'인사할 때 무릎이 굽으면 엉거주춤해 보입니다. 다리는 곧게 펴고 허리만 접으세요.'},
      tempo:{label:'너무 빨리 일어남', cue:'천천히, 잠깐 멈췄다가', fix:'숙이고 1초 멈춘 뒤 올라오기', tip:'숙인 자세에서 1초쯤 멈췄다가 천천히 올라오면 정중해 보입니다.'},
    },
    live:{shallow:'허리를 더 숙이세요', nearly:'조금만 더', reached:'좋아요, 잠깐 멈췄다가 올라오세요', descending:'허리를 숙여 인사하세요', ready:'옆에서 전신이 보이게 바로 서 주세요', partial:'목표 각도까지 숙여야 인정돼요'},
    good:['좋아요','정중해요','잘했어요'], next:'다음에는 시선과 인사말까지 함께 연습해 보세요.',
    checkpoints:['발뒤꿈치를 붙이고 바로 서기','허리부터 접어 목표 각도까지 숙이기','등과 목은 일직선, 무릎은 곧게','숙인 자세에서 1초 멈추기','천천히 올라와 상대를 바라보기'],
    setup:'옆(측면) 2~3m에서 전신이 보이게 서 주세요.',
  },
  run: {
    id:'run', name:'달리기 자세', type:'gait', category:'달리기 · 런닝머신', beta:true, duration:30, rateMin:160, rateMax:190, leanMax:15, bounceMax:14, angleLabel:'발걸음 수(보/분)', unit:'보/분', trunkLabel:'상체 기울기', phaseNames:{go:'달리는 중'}, highlight:[[23,25],[25,27],[24,26],[26,28]],
    feedback:{
      slow:{label:'발걸음 느림', cue:'보폭을 줄이고 발을 더 자주', fix:'분당 160보 이상', tip:'발걸음이 느리면 한 걸음이 길어져 무릎에 충격이 커집니다. 보폭을 조금 줄이고 발을 더 자주 디뎌 보세요.'},
      lean:{label:'상체 과하게 숙임', cue:'상체를 세우세요', fix:'가슴을 펴고 시선은 정면', tip:'상체가 많이 숙여지면 허리에 부담이 가고 호흡이 답답해집니다. 발목부터 살짝만 기울이고 가슴을 펴세요.'},
      back:{label:'상체 뒤로 젖힘', cue:'상체를 살짝 앞으로', fix:'발목부터 몸 전체를 살짝 앞으로', tip:'상체가 뒤로 젖혀지면 발이 몸 앞에서 브레이크처럼 작용합니다. 몸 전체를 살짝 앞으로 기울이세요.'},
      over:{label:'발을 멀리 디딤', cue:'발을 몸 가까이 디디세요', fix:'무릎을 살짝 굽혀 몸 아래에 착지', tip:'다리를 쭉 뻗어 몸보다 한참 앞에 디디면 충격이 큽니다. 무릎을 살짝 굽힌 채 몸 가까이에 디디세요.'},
      bounce:{label:'위아래로 많이 튐', cue:'위로 뛰지 말고 앞으로', fix:'머리 높이를 일정하게', tip:'위아래로 많이 튀면 힘이 위로 새어 나갑니다. 머리 높이가 일정하도록 낮고 가볍게 디디세요.'},
      arm:{label:'팔이 펴짐', cue:'팔꿈치를 굽히세요', fix:'팔꿈치 90도 안팎', tip:'팔을 편 채 흔들면 리듬이 느려집니다. 팔꿈치를 90도 안팎으로 굽히고 앞뒤로 가볍게 흔드세요.'},
    },
    live:{ready:'옆에서 전신이 보이게 두고 달려 주세요', go:'달리는 중'}, good:['좋아요, 그 리듬','아주 좋아요'],
    checkpoints:['시선은 정면, 가슴을 펴기','몸 전체를 발목부터 살짝 앞으로','발은 몸 가까이, 무릎을 살짝 굽혀 착지','분당 160~190보의 가벼운 발걸음','팔꿈치 90도, 앞뒤로 가볍게'],
    setup:'런닝머신 옆(측면) 2~3m 바닥에 폰을 세워 전신이 보이게 두세요. 속도를 맞춘 뒤 시작합니다. 폰 카메라 한 대로 보는 추정값입니다.',
  },
  plank: {
    id:'plank', name:'플랭크', type:'hold', category:'코어', duration:30, metric:'bodyDev', tol:15, angleLabel:'몸 일직선 오차', highlight:[[11,23],[12,24],[23,27],[24,28]],
    feedback:{
      sag:{label:'엉덩이 처짐', cue:'엉덩이가 처졌어요, 배에 힘주세요', fix:'배꼽을 등 쪽으로', tip:'엉덩이가 처지면 허리가 꺾여 통증이 옵니다. 배꼽을 등 쪽으로 당기고 엉덩이에 힘을 주세요.'},
      pike:{label:'엉덩이 들림', cue:'엉덩이를 내리세요', fix:'어깨-엉덩이-발목 한 줄', tip:'엉덩이가 올라가면 복근에 자극이 줄어듭니다. 몸을 길게 늘인다는 느낌으로 내리세요.'},
      lost:{label:'자세 이탈', cue:'자세로 돌아오세요', fix:'다시 플랭크 자세', tip:'힘들면 무릎을 대고 시간을 채우는 것이 자세가 무너진 채 버티는 것보다 낫습니다.'},
    },
    live:{ready:'팔꿈치를 어깨 아래에 두고 플랭크 자세를 잡으세요', hold:'좋아요, 유지', done:'끝, 잘했어요'},
    good:['좋아요, 유지','아주 좋아요','그대로'],
    checkpoints:['팔꿈치는 어깨 바로 아래','머리-어깨-엉덩이-발목 일직선','배와 엉덩이에 힘','숨 참지 않기'],
    setup:'측면에서 몸 전체가 보이게, 카메라는 바닥 가까이.',
  },
  cpr_compression: {
    id:'cpr_compression', name:'가슴압박', type:'rate', category:'응급처치', count:30, rateMin:100, rateMax:120, angleLabel:'압박 속도(회/분)', highlight:[[11,13],[13,15],[12,14],[14,16]],
    checks:[ {code:'elbow', metric:'elbow', op:'<', value:160, pen:20}, {code:'vertical', metric:'armVertical', op:'>', value:20, pen:15} ],
    feedback:{
      slow:{label:'속도 느림', cue:'더 빠르게', fix:'분당 100~120회', tip:'분당 100회보다 느리면 혈류가 충분하지 않습니다. 메트로놈(박자 소리)에 맞춰 누르세요.'},
      fast:{label:'속도 빠름', cue:'조금 천천히', fix:'분당 120회 이하', tip:'너무 빠르면 가슴이 완전히 올라오기 전에 다시 눌러 깊이가 얕아집니다.'},
      elbow:{label:'팔꿈치 굽힘', cue:'팔꿈치를 쭉 펴세요', fix:'팔을 곧게 펴고 체중으로 누르기', tip:'팔꿈치가 굽으면 팔 힘으로 누르게 되어 금방 지치고 깊이가 얕아집니다. 팔을 펴고 어깨 체중으로 누르세요.'},
      vertical:{label:'어깨가 손 위에 없음', cue:'어깨를 손 바로 위에', fix:'환자 가슴 위로 몸을 가져오기', tip:'어깨가 손 바로 위에 있어야 수직으로 힘이 전달됩니다. 환자에게 더 가까이 무릎을 꿇으세요.'},
      pause:{label:'중단', cue:'멈추지 말고 계속 압박', fix:'중단은 10초 이내', tip:'압박 중단이 길어질수록 생존율이 떨어집니다. 교대나 호흡 외에는 멈추지 마세요.'},
    },
    live:{ready:'환자 옆에 무릎을 꿇고 가슴 중앙에 손을 올리세요', go:'압박 시작'},
    good:['좋아요, 그 속도','아주 좋아요'],
    checkpoints:['환자 옆에 무릎 꿇기','가슴뼈 아래쪽 절반에 손꿈치, 손깍지','팔꿈치 펴고 어깨가 손 바로 위','분당 100~120회','깊이 약 5cm (카메라로는 측정 불가 → 마네킹 표시등·교수 확인)','압박 후 가슴이 완전히 올라오게','중단 최소화'],
    setup:'측면에서 상체와 팔이 보이게. 마네킹을 사용하세요.',
  },
  cpr_sequence: {
    id:'cpr_sequence', name:'심폐소생술 절차 (성인)', type:'procedure', category:'응급처치', cycles:2,
    steps:[
      {id:'check', name:'반응 확인', type:'manual', duration:8, instruction:'환자의 어깨를 가볍게 두드리며 "괜찮으세요?"라고 크게 물어보세요.', check:'양 어깨를 두드리며 큰 소리로 반응 확인'},
      {id:'call', name:'119 신고·AED 요청', type:'manual', duration:8, instruction:'주변 사람을 지목해 119 신고와 자동심장충격기를 요청하세요.', check:'특정인을 지목해 신고·AED 요청'},
      {id:'breath', name:'호흡 확인', type:'manual', duration:10, instruction:'10초 이내로 가슴의 움직임을 보고 호흡이 있는지 확인하세요.', check:'10초 이내 호흡 확인'},
      {id:'comp', name:'가슴압박 30회', type:'movement', movement:'cpr_compression', count:30, maxDuration:40, cycle:true},
      {id:'airway', name:'기도 개방·인공호흡 2회', type:'manual', duration:10, instruction:'머리를 뒤로 젖히고 턱을 들어 올린 뒤, 코를 막고 1초씩 2회 숨을 불어넣으세요.', check:'머리 젖히고 턱 들기, 가슴이 올라오는 1초 호흡 2회', cycle:true},
      {id:'aed', name:'자동심장충격기 사용', type:'manual', duration:20, instruction:'전원을 켜고 패드를 붙이세요. 분석 중에는 환자에게서 떨어지고, 지시가 나오면 충격 버튼을 누른 뒤 즉시 압박을 재개하세요.', check:'전원→패드 부착→분석 시 떨어지기→충격→즉시 압박 재개'},
    ],
    feedback:{},
    checkpoints:['반응 확인 → 119 신고·AED 요청 → 호흡 확인','가슴압박 30회 : 인공호흡 2회 반복','압박 분당 100~120회, 깊이 5cm','AED 도착 즉시 사용, 중단 최소화'],
    setup:'마네킹을 가운데 두고 측면에서 상체가 보이게. 단계 안내는 음성으로 나오며, 각 단계는 시간이 지나거나 두 손을 머리 위로 들면 다음으로 넘어갑니다.',
  },
};

/** 교수자가 시범으로 만든 사용자 정의 동작: 템플릿(기존 rep 동작) + 이름 + 목표 */
export function customMovement(def){ if(def.kind==='match'&&def.tpl) return matchMovement(def); const base=MOVEMENTS[def.template]||MOVEMENTS.squat; const fb={}; for(const k of Object.keys(base.feedback||{})) fb[k]=Object.assign({},base.feedback[k],(def.feedback||{})[k]||{}); return Object.assign({}, base, {id:def.id, name:def.name, target:def.target??base.target, duration:def.duration??base.duration, count:def.count??base.count, custom:true, template:def.template, checkpoints:(def.checkpoints&&def.checkpoints.length)?def.checkpoints:base.checkpoints, setup:def.setup||base.setup, feedback:fb}); }

/* ===== 반복 동작 ===== */
const hitCheck=(ch,v,target)=>{ const lim= ch.rel!=null? target+ch.rel : ch.value; return (ch.op==='>'&&v>lim)||(ch.op==='<'&&v<lim); };
export class RepAnalyzer {
  constructor(mv, opts={}){ this.mv=mv; this.target= opts.target??mv.target; this.goal=opts.goal??null; this.reset(); }
  reset(){ this.phase='idle'; this.reps=[]; this.partial=0; this.cur=null; this.smooth=null; this.timeline=[]; this.lastSample=0; this.startT=null; this.noPerson=true; this.lastSeen=null; this.goodStreak=0; }
  update(lm,W,H,t){
    if(this.startT==null) this.startT=t;
    if(!(lm&&lm.length>=33)){ this.noPerson=true; return this.out(null,null,this.mv.live.ready,'',null,null); }
    const p=analyzePose(lm,W,H); const chain=this.mv.chain; const vl=p.vis(p.L,chain), vr=p.vis(p.R,chain);
    if(Math.max(vl,vr)<0.5){ this.noPerson=true; return this.out(null,null,this.mv.view==='desk'?'어깨와 양팔이 보이게 앉아 주세요':'전신이 보이게 서 주세요','',null,p); }
    this.noPerson=false; this.lastSeen=t;
    let side= vl>=vr?'L':'R'; let m= side==='L'?p.mL:p.mR; let primary;
    const both = vl>0.6&&vr>0.6;
    if(this.mv.primaryMode==='min' && both){ if(p.mL[this.mv.primary]<=p.mR[this.mv.primary]){ m=p.mL; side='L'; } else { m=p.mR; side='R'; } primary=m[this.mv.primary]; }
    else if((p.frontal||this.mv.bilateral) && both && this.mv.avgFrontal!==false) primary=(p.mL[this.mv.primary]+p.mR[this.mv.primary])/2;
    else primary=m[this.mv.primary];
    this.smooth= this.smooth==null?primary:(this.smooth*0.5+primary*0.5); const ang=this.smooth;
    const snap=Object.assign({},m,{valgus:p.valgus, frontal:p.frontal, shoulderTilt:p.shoulderTilt, armDiff: both? Math.abs(p.mL.elbow-p.mR.elbow) : null});
    if(t-this.lastSample>66){ this.timeline.push({t:(t-this.startT)/1000, a:ang}); this.lastSample=t; }
    const mv=this.mv, target=this.target; let repEvent=null, cue, sev='';
    // invert 동작(팔 뻗기)은 각도가 커질수록 목표에 가깝다 → 부호 k로 비교 방향을 뒤집는다
    const k=mv.invert?-1:1; const ge=(a,b)=>k*a>=k*b, lt=(a,b)=>k*a<k*b, le=(a,b)=>k*a<=k*b;
    if(this.phase==='idle'){ if(ge(ang,mv.stand)) this.phase='up'; cue=mv.live.ready; }
    else if(this.phase==='up'){ if(lt(ang,mv.descend)){ this.phase='down'; this.cur={start:t, min:ang, snap, reached:false, bottomT:(t-this.startT)/1000}; } cue=mv.live.descending; }
    if(this.phase==='down'){
      const c=this.cur; if(lt(ang,c.min)){ c.min=ang; c.snap=snap; c.bottomT=(t-this.startT)/1000; } if(le(ang,target)) c.reached=true;
      if(ge(ang,mv.stand)){
        const dur=(t-c.start)/1000; const r=this.score(c,dur);
        if(r){ this.reps.push(r); repEvent=r; this.goodStreak= r.issues.length?0:this.goodStreak+1; } else { this.partial++; repEvent={partial:true}; }
        this.phase='up'; this.cur=null;
        cue= r? (r.issues.length? `${r.issues[0].label} — ${r.fix}` : `${mv.good[this.reps.length%mv.good.length]}! ${this.reps.length}회`) : mv.live.partial;
        sev= r? (r.issues.length? (r.score>=80?'warn':'bad') : 'good') : 'bad';
      } else {
        const liveIssue = this.liveCheck(snap);
        if(liveIssue){ cue=liveIssue.cue; sev='bad'; }
        else if(c.reached){ cue=mv.live.reached; sev='good'; }
        else if(le(ang,target+k*15)){ cue=mv.live.nearly; sev='warn'; }
        else cue=mv.live.shallow;
      }
    }
    return this.out(ang, snap[mv.trunkMetric||'trunkLean'], cue, sev, repEvent, p, side);
  }
  liveCheck(snap){ for(const ch of this.mv.checks){ if(!ch.live) continue; if(ch.view==='frontal' && !snap.frontal) continue; const v=snap[ch.metric]; if(v==null) continue; if(hitCheck(ch,v,this.target)){ const code= ch.variant? ch.variant(snap) : ch.code; return this.mv.feedback[code]||this.mv.feedback[ch.code]; } } return null; }
  score(c,dur){
    const mv=this.mv, target=this.target; const short=(mv.invert?-1:1)*(c.min-target); // 목표에 못 미친 각도(양수면 부족)
    if(short>mv.countTol) return null;
    const issues=[]; let pen=0, fix='';
    if(short>0){ const p= short<=15?15:30; pen+=p; issues.push({code:'depth',label:mv.feedback.depth.label,sev:p>15?'bad':'warn'}); fix=mv.feedback.depth.fix; }
    for(const ch of mv.checks){ if(ch.view==='frontal' && !c.snap.frontal) continue; const v=c.snap[ch.metric]; if(v==null) continue; if(hitCheck(ch,v,target)){ const code= ch.variant? ch.variant(c.snap) : ch.code; const fb=mv.feedback[code]||mv.feedback[ch.code]; pen+=ch.pen; issues.push({code,label:fb.label,sev:'bad'}); fix=fix||fb.fix; } }
    if(dur<mv.minTempo){ pen+=10; issues.push({code:'tempo',label:mv.feedback.tempo.label,sev:'warn'}); fix=fix||mv.feedback.tempo.fix; }
    return {n:this.reps.length+1, min:c.min, trunk:c.snap[mv.trunkMetric||'trunkLean'], dur, score:Math.max(40,100-pen), issues, fix, bottomT:c.bottomT};
  }
  out(angle,trunk,cue,sev,repEvent,p,side){ return {angle,trunk,cue,sev,repEvent,phase:this.phase,count:this.reps.length,goal:this.goal,pose:p,side,done: this.goal!=null && this.reps.length>=this.goal}; }
  summary(){
    const reps=this.reps, mv=this.mv; if(!reps.length) return null;
    const avg=(a)=>a.reduce((s,v)=>s+v,0)/a.length; const score=Math.round(avg(reps.map(r=>r.score)));
    const counts={}; reps.forEach(r=>r.issues.forEach(i=>{counts[i.code]=(counts[i.code]||0)+1;})); const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    return {type:'rep', movement:mv.id, movementName:mv.name, score, grade:gradeOf(score), count:reps.length, partial:this.partial, depth:avg(reps.map(r=>r.min)), tempo:avg(reps.map(r=>r.dur)),
      topIssue: top?{code:top[0],label:mv.feedback[top[0]].label,n:top[1]}:null, reps, timeline:this.timeline, target:this.target, angleLabel:mv.angleLabel, invert:!!mv.invert, next:mv.next||'', depthLabel:mv.feedback.depth.label, fb:mv.custom? mv.feedback : null,
      tiles:[['인정 횟수',`${reps.length}`],[mv.invert?'평균 최고 각도':'평균 최저 각도',`${avg(reps.map(r=>r.min)).toFixed(0)}°`],['평균 템포',`${avg(reps.map(r=>r.dur)).toFixed(1)}초/회`],['가장 흔한 문제', top?`${mv.feedback[top[0]].label} (${top[1]}회)`:'없음']],
      items:reps.map(r=>({cols:[`${r.n}`,`${r.min.toFixed(0)}°`,r.trunk==null?'—':`${r.trunk.toFixed(0)}°`,`${r.dur.toFixed(1)}초`], issues:r.issues, score:r.score})), itemHead:['회차',mv.angleLabel.replace(' 각도','각'),mv.trunkLabel?mv.trunkLabel.replace(' 기울기',''):'상체','시간'],
      chart:{yLabel:mv.angleLabel, y0:40, y1:185, target:this.target, points:reps.map(r=>({t:r.bottomT,a:r.min,score:r.score,n:r.n,issues:r.issues.length}))}};
  }
}
export function gradeOf(score){ return score>=90?'A · 우수':score>=80?'B · 양호':score>=70?'C · 보통':'D · 집중 지도'; }

/* ===== 유지 동작 (플랭크) ===== */
export class HoldAnalyzer {
  constructor(mv, opts={}){ this.mv=mv; this.duration= opts.goal??opts.duration??mv.duration; this.reset(); }
  reset(){ this.state='wait'; this.waitSince=null; this.holdStart=null; this.held=0; this.good=0; this.lastT=null; this.badSince=null; this.timeline=[]; this.lastSample=0; this.startT=null; this.segments=[]; this.curSeg=null; this.noPerson=true; this.lastSeen=null; this.lostSince=null; this.announced=new Set(); }
  update(lm,W,H,t){
    if(this.startT==null) this.startT=t; const mv=this.mv;
    const base={count:Math.floor(this.held), goal:this.duration, phase:this.state, done:false, repEvent:null};
    if(!(lm&&lm.length>=33)){ this.noPerson=true; return this.lost(t,base); }
    const p=analyzePose(lm,W,H); const vl=p.vis(p.L,['sho','hip','ank']), vr=p.vis(p.R,['sho','hip','ank']);
    if(Math.max(vl,vr)<0.5){ this.noPerson=true; return this.lost(t,base,p); }
    this.noPerson=false; this.lastSeen=t; this.lostSince=null;
    const m= vl>=vr?p.mL:p.mR; const dev=Math.abs(m.bodyDev); const horizontal = m.trunkLean>55; // 몸통이 수평에 가까움
    const inPosition = horizontal && dev<35;
    if(t-this.lastSample>100){ this.timeline.push({t:(t-this.startT)/1000, a:dev}); this.lastSample=t; }
    if(this.state==='wait'){
      if(inPosition){ if(!this.waitSince) this.waitSince=t; if(t-this.waitSince>800){ this.state='hold'; this.holdStart=t; this.lastT=t; } } else this.waitSince=null;
      return Object.assign(base,{angle:dev, trunk:null, cue: inPosition?'좋아요, 그대로':mv.live.ready, sev: inPosition?'good':'', pose:p});
    }
    if(this.state==='hold'){
      const dt=(t-this.lastT)/1000; this.lastT=t; this.held+=dt;
      const ok = dev<=mv.tol && inPosition; if(ok) this.good+=dt;
      const code = ok? 'ok' : (!horizontal? 'lost' : (m.hipAbove?'pike':'sag'));
      if(!this.curSeg || this.curSeg.code!==code){ if(this.curSeg) this.curSeg.end=this.held; this.curSeg={code, start:this.held, end:this.held}; this.segments.push(this.curSeg); } else this.curSeg.end=this.held;
      let cue, sev, repEvent=null;
      if(ok){ this.badSince=null; const sec=Math.floor(this.held); cue=`${mv.live.hold} · ${sec}초`; sev='good'; if(sec>0 && sec%10===0 && !this.announced.has(sec)){ this.announced.add(sec); repEvent={mark:sec, say:`${sec}초`}; } }
      else { if(!this.badSince) this.badSince=t; const fb=mv.feedback[code]; cue=fb.cue; sev='bad'; if(t-this.badSince>1200){ repEvent={issue:code, say:fb.cue}; this.badSince=t; } }
      if(this.held>=this.duration){ this.state='done'; if(this.curSeg) this.curSeg.end=this.held; return Object.assign(base,{count:Math.floor(this.held), angle:dev, trunk:null, cue:mv.live.done, sev:'good', done:true, repEvent:{say:mv.live.done}, pose:p}); }
      return Object.assign(base,{count:Math.floor(this.held), angle:dev, trunk:null, cue, sev, repEvent, pose:p});
    }
    return Object.assign(base,{angle:dev,trunk:null,cue:mv.live.done,sev:'good',done:true,pose:p});
  }
  lost(t,base,p){ if(this.state==='hold'){ if(!this.lostSince) this.lostSince=t; if(t-this.lostSince>3000){ this.state='done'; return Object.assign(base,{angle:null,trunk:null,cue:'자세가 풀려 종료합니다',sev:'bad',done:true,pose:p}); } return Object.assign(base,{angle:null,trunk:null,cue:this.mv.feedback.lost.cue,sev:'bad',pose:p}); } return Object.assign(base,{angle:null,trunk:null,cue:'몸 전체가 보이게 자세를 잡으세요',sev:'',pose:p}); }
  summary(){
    if(this.held<1) return null; const mv=this.mv; const pct=this.good/this.held; const score=Math.round(clamp(pct*100,0,100));
    const bad=this.segments.filter(s=>s.code!=='ok'); const counts={}; bad.forEach(s=>{counts[s.code]=(counts[s.code]||0)+(s.end-s.start);}); const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    return {type:'hold', movement:mv.id, movementName:mv.name, score, grade:gradeOf(score), count:Math.round(this.held), goal:this.duration, goodTime:this.good, held:this.held,
      topIssue: top?{code:top[0],label:mv.feedback[top[0]].label,n:Math.round(top[1])}:null, segments:this.segments, timeline:this.timeline, target:mv.tol, angleLabel:mv.angleLabel,
      tiles:[['유지 시간',`${this.held.toFixed(0)}초 / ${this.duration}초`],['바른 자세 시간',`${this.good.toFixed(0)}초 (${Math.round(pct*100)}%)`],['자세 이탈 횟수',`${bad.length}회`],['가장 흔한 문제', top?`${mv.feedback[top[0]].label} ${Math.round(top[1])}초`:'없음']],
      items:this.segments.map((s,i)=>({cols:[`${i+1}`,`${s.start.toFixed(0)}~${s.end.toFixed(0)}초`,`${(s.end-s.start).toFixed(1)}초`], issues: s.code==='ok'?[]:[{code:s.code,label:mv.feedback[s.code].label,sev:'bad'}], score: s.code==='ok'?100:50})), itemHead:['구간','시간','길이'],
      chart:{yLabel:'일직선 오차(°)', y0:0, y1:45, target:mv.tol, points:[]}};
  }
}

/* ===== 압박 속도 (가슴압박) ===== */
export class RateAnalyzer {
  constructor(mv, opts={}){ this.mv=mv; this.goal= opts.goal??mv.count; this.reset(); }
  reset(){ this.comps=[]; this.y=null; this.vel=0; this.dir=0; this.lastPeakY=null; this.lastPeakT=null; this.minY=null; this.maxY=null; this.timeline=[]; this.lastSample=0; this.startT=null; this.noPerson=true; this.lastSeen=null; this.lastCompT=null; this.pauses=0; this.pauseWarned=false; this.lastAnnounce=0; this.snap=null; }
  rate(){ const c=this.comps; if(c.length<3) return null; const n=Math.min(6,c.length-1); const dt=(c[c.length-1].t-c[c.length-1-n].t)/n; return dt>0? 60/dt : null; }
  update(lm,W,H,t){
    if(this.startT==null) this.startT=t; const mv=this.mv;
    const base={count:this.comps.length, goal:this.goal, phase:'go', done:false, repEvent:null, angle:this.rate()};
    if(!(lm&&lm.length>=33)){ this.noPerson=true; return Object.assign(base,{trunk:null,cue:mv.live.ready,sev:''}); }
    const p=analyzePose(lm,W,H); const vl=p.vis(p.L,['sho','elb','wri']), vr=p.vis(p.R,['sho','elb','wri']);
    if(Math.max(vl,vr)<0.5){ this.noPerson=true; return Object.assign(base,{trunk:null,cue:'상체와 팔이 보이게 해 주세요',sev:'',pose:p}); }
    this.noPerson=false; this.lastSeen=t;
    const m= vl>=vr?p.mL:p.mR; const S= vl>=vr?p.L:p.R;
    const y = (S.sho.y)/p.torso; // 어깨 높이(몸통 길이 기준 정규화)
    const sy = this.y==null? y : this.y*0.4+y*0.6; const v = sy-(this.y??sy); this.y=sy; this.snap={elbow:m.elbow, armVertical:m.armVertical};
    // 피크 탐지: 내려가다(y 증가) 올라오기(y 감소) 시작하는 지점 = 압박 최저점
    const amp=0.045; if(this.minY==null||sy<this.minY) this.minY=sy; if(this.maxY==null||sy>this.maxY) this.maxY=sy;
    let repEvent=null;
    if(v>0.002) { if(this.dir<=0){ this.dir=1; this.topY=sy; } }
    else if(v<-0.002){ if(this.dir>=0){ // 방향 전환: 최저점
        if(this.topY!=null && sy-this.topY>amp && (!this.lastCompT || t-this.lastCompT>250)){
          const comp={n:this.comps.length+1, t:(t-this.startT)/1000, elbow:m.elbow, armVertical:m.armVertical, amp:sy-this.topY, issues:[]};
          for(const ch of mv.checks){ const val=comp[ch.metric]; if((ch.op==='>'&&val>ch.value)||(ch.op==='<'&&val<ch.value)) comp.issues.push({code:ch.code,label:mv.feedback[ch.code].label,sev:'bad'}); }
          if(this.lastCompT && t-this.lastCompT>2500){ this.pauses++; }
          this.comps.push(comp); this.lastCompT=t; repEvent={comp};
        }
        this.dir=-1; } }
    const r=this.rate(); if(t-this.lastSample>100){ this.timeline.push({t:(t-this.startT)/1000, a:r??0}); this.lastSample=t; }
    let cue, sev='';
    const n=this.comps.length;
    if(n===0){ cue=mv.live.ready; }
    else if(this.lastCompT && t-this.lastCompT>2500){ cue=mv.feedback.pause.cue; sev='bad'; if(!this.pauseWarned){ repEvent=repEvent||{say:mv.feedback.pause.cue}; this.pauseWarned=true; } }
    else { this.pauseWarned=false;
      if(m.elbow<160){ cue=mv.feedback.elbow.cue; sev='bad'; }
      else if(m.armVertical>20){ cue=mv.feedback.vertical.cue; sev='bad'; }
      else if(r!=null && r<mv.rateMin){ cue=`${mv.feedback.slow.cue} · ${r.toFixed(0)}/분`; sev='warn'; }
      else if(r!=null && r>mv.rateMax){ cue=`${mv.feedback.fast.cue} · ${r.toFixed(0)}/분`; sev='warn'; }
      else if(r!=null){ cue=`${mv.good[0]} · ${r.toFixed(0)}/분`; sev='good'; }
      else cue='계속 압박하세요';
    }
    if(repEvent && repEvent.comp){ const c=repEvent.comp; if(c.n%10===0) repEvent.say=`${c.n}`; else if(c.issues.length && t-this.lastAnnounce>3000){ repEvent.say=mv.feedback[c.issues[0].code].cue; this.lastAnnounce=t; } else if(r!=null && (r<mv.rateMin||r>mv.rateMax) && t-this.lastAnnounce>4000){ repEvent.say= r<mv.rateMin? mv.feedback.slow.cue : mv.feedback.fast.cue; this.lastAnnounce=t; } }
    const done = n>=this.goal;
    return Object.assign(base,{count:n, angle:r, trunk:m.elbow, cue: done?'압박 완료':cue, sev: done?'good':sev, repEvent, done, pose:p, side: vl>=vr?'L':'R'});
  }
  summary(){
    const c=this.comps, mv=this.mv; if(c.length<3) return null;
    const rates=[]; for(let i=1;i<c.length;i++){ const dt=c[i].t-c[i-1].t; if(dt>0 && dt<2.5) rates.push(60/dt); }
    const avg=(a)=>a.length? a.reduce((s,v)=>s+v,0)/a.length : 0; const avgRate=avg(rates);
    const inRange=rates.filter(r=>r>=mv.rateMin&&r<=mv.rateMax).length/(rates.length||1);
    const elbowOk=c.filter(x=>x.elbow>=160).length/c.length, vertOk=c.filter(x=>x.armVertical<=20).length/c.length;
    const score=Math.round(clamp(100 - (1-inRange)*40 - (1-elbowOk)*25 - (1-vertOk)*20 - this.pauses*5, 0, 100));
    const counts={}; c.forEach(x=>x.issues.forEach(i=>{counts[i.code]=(counts[i.code]||0)+1;})); if(inRange<0.6) counts[avgRate<mv.rateMin?'slow':'fast']=Math.round((1-inRange)*c.length); if(this.pauses) counts.pause=this.pauses;
    const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    const blocks=[]; for(let i=0;i<c.length;i+=10){ const b=c.slice(i,i+10); const br=[]; for(let k=Math.max(1,i);k<Math.min(c.length,i+10);k++){ const dt=c[k].t-c[k-1].t; if(dt>0&&dt<2.5) br.push(60/dt); } const eo=b.filter(x=>x.elbow>=160).length/b.length, vo=b.filter(x=>x.armVertical<=20).length/b.length; const rr=avg(br); const iss=[]; if(br.length&&(rr<mv.rateMin)) iss.push({code:'slow',label:mv.feedback.slow.label,sev:'warn'}); if(br.length&&rr>mv.rateMax) iss.push({code:'fast',label:mv.feedback.fast.label,sev:'warn'}); if(eo<0.7) iss.push({code:'elbow',label:mv.feedback.elbow.label,sev:'bad'}); if(vo<0.7) iss.push({code:'vertical',label:mv.feedback.vertical.label,sev:'bad'}); blocks.push({cols:[`${i+1}~${i+b.length}회`, br.length?`${rr.toFixed(0)}/분`:'—', `${Math.round(eo*100)}%`, `${Math.round(vo*100)}%`], issues:iss, score: iss.length? (iss.some(x=>x.sev==='bad')?60:80):100}); }
    return {type:'rate', movement:mv.id, movementName:mv.name, score, grade:gradeOf(score), count:c.length, goal:this.goal, avgRate, inRange, elbowOk, vertOk, pauses:this.pauses,
      topIssue: top?{code:top[0],label:mv.feedback[top[0]].label,n:top[1]}:null, comps:c, timeline:this.timeline, target:null, angleLabel:mv.angleLabel,
      tiles:[['압박 횟수',`${c.length}회`],['평균 속도',`${avgRate.toFixed(0)}/분`],['적정 속도 비율',`${Math.round(inRange*100)}%`],['팔꿈치 폄 · 어깨 수직',`${Math.round(elbowOk*100)}% · ${Math.round(vertOk*100)}%`]],
      items:blocks, itemHead:['구간','속도','팔꿈치 폄','어깨 수직'],
      chart:{yLabel:'압박 속도(회/분)', y0:0, y1:160, band:[mv.rateMin,mv.rateMax], points:[]}};
  }
}

/* ===== 절차 (여러 단계) ===== */
export class ProcedureRunner {
  constructor(mv, opts={}){ this.mv=mv; const cycles=opts.cycles??mv.cycles??1; this.steps=[]; mv.steps.forEach(s=>{ if(!s.cycle) this.steps.push(Object.assign({},s)); });
    // 주기 단계(압박/호흡)는 cycles만큼 반복, 비주기 단계 중 'aed'는 마지막
    const cyc=mv.steps.filter(s=>s.cycle); const pre=this.steps.filter(s=>s.id!=='aed'), post=this.steps.filter(s=>s.id==='aed'); this.steps=[...pre]; for(let i=0;i<cycles;i++){ cyc.forEach(s=>this.steps.push(Object.assign({},s,{name:`${s.name} (${i+1}/${cycles})`}))); } this.steps.push(...post);
    this.i=-1; this.results=[]; this.sub=null; this.stepStart=null; this.done=false; this.startT=null; this.handsSince=null; this.pending=null; this.timeline=[]; }
  current(){ return this.steps[this.i]; }
  start(t){ this.startT=t; this.advance(t); }
  advance(t){
    const s=this.current(); if(s){ const dur=(t-this.stepStart)/1000; const res={id:s.id, name:s.name, type:s.type, duration:dur, check:s.check||'', done:true}; if(this.sub){ res.summary=this.sub.summary(); res.count=this.sub.comps?this.sub.comps.length:undefined; if(res.summary&&res.summary.timeline){ const off=(this.stepStart-this.startT)/1000; res.summary.timeline.forEach(p=>this.timeline.push({t:p.t+off,a:p.a})); } } this.results.push(res); }
    this.i++; this.sub=null; this.handsSince=null; this.stepStart=t;
    if(this.i>=this.steps.length){ this.done=true; this.pending={say:'절차 완료, 수고했어요'}; return; }
    const n=this.current(); if(n.type==='movement'){ this.sub=new RateAnalyzer(MOVEMENTS[n.movement],{goal:n.count}); this.pending={say:`${n.name.replace(/ \(\d+\/\d+\)/,'')}. ${MOVEMENTS[n.movement].live.ready}`, step:n}; }
    else this.pending={say:`${n.name}. ${n.instruction}`, step:n};
  }
  update(lm,W,H,t){
    if(this.startT==null) this.start(t);
    const s=this.current(); const pend=this.pending; this.pending=null;
    const base={stepIndex:this.i, stepTotal:this.steps.length, step:s, announce:pend, goal:this.steps.length, done:this.done};
    if(this.done) return Object.assign(base,{count:this.steps.length, angle:null, trunk:null, cue:'절차 완료', sev:'good', repEvent:null, phase:'done'});
    const elapsed=(t-this.stepStart)/1000;
    const takePending=()=>{ const a=this.pending; this.pending=null; return a; };
    if(s.type==='movement'){
      const out=this.sub.update(lm,W,H,t);
      if(out.done || (s.maxDuration && elapsed>s.maxDuration)){ this.advance(t); return Object.assign(base,out,{count:this.i, goal:this.steps.length, done:this.done, cue:'다음 단계로', sev:'good', announce:takePending(), phase:'step'}); }
      return Object.assign(base,out,{count:this.i+1, goal:this.steps.length, done:false, phase:'step', subCount:out.count, subGoal:out.goal, cue:`${out.count}/${out.goal} · ${out.cue}`});
    }
    // 수동 단계: 시간 경과 또는 두 손 머리 위
    let p=null; if(lm&&lm.length>=33){ p=analyzePose(lm,W,H); if(p.handsUp){ if(!this.handsSince) this.handsSince=t; else if(t-this.handsSince>1000){ this.advance(t); return Object.assign(base,{count:this.i, done:this.done, angle:null, trunk:null, cue:'다음 단계로', sev:'good', repEvent:null, announce:takePending(), pose:p, phase:'step'}); } } else this.handsSince=null; }
    if(elapsed>=s.duration){ this.advance(t); return Object.assign(base,{count:this.i, done:this.done, angle:null, trunk:null, cue:'다음 단계로', sev:'good', repEvent:null, announce:takePending(), pose:p, phase:'step'}); }
    const left=Math.ceil(s.duration-elapsed);
    return Object.assign(base,{count:this.i+1, angle:null, trunk:null, cue:`${s.name} · ${left}초 (끝났으면 두 손을 머리 위로)`, sev:'', repEvent:null, pose:p, phase:'step'});
  }
  summary(){
    if(!this.results.length) return null; const mv=this.mv;
    const mov=this.results.filter(r=>r.type==='movement'&&r.summary); const avg=(a)=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
    const aiScore= mov.length? Math.round(avg(mov.map(r=>r.summary.score))) : null; const score= aiScore??100;
    const manual=this.results.filter(r=>r.type!=='movement');
    const counts={}; mov.forEach(r=>{ if(r.summary.topIssue) counts[r.summary.topIssue.label]=(counts[r.summary.topIssue.label]||0)+r.summary.topIssue.n; }); const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    const totalComp=mov.reduce((s,r)=>s+(r.summary.count||0),0);
    return {type:'procedure', movement:mv.id, movementName:mv.name, score, grade:gradeOf(score), count:this.results.length, goal:this.steps.length, completed:this.done, aiScore, steps:this.results,
      topIssue: top?{code:'',label:top[0],n:top[1]}:null, timeline:this.timeline, target:null, angleLabel:'압박 속도(회/분)',
      tiles:[['완료 단계',`${this.results.length} / ${this.steps.length}`],['가슴압박 합계',`${totalComp}회`],['압박 AI 점수', aiScore==null?'—':`${aiScore}점`],['교수 확인 단계',`${manual.length}개`]],
      items:this.results.map((r,i)=>({cols:[`${i+1}`, r.name, `${r.duration.toFixed(0)}초`, r.type==='movement'? (r.summary?`${r.summary.count}회 · ${r.summary.avgRate.toFixed(0)}/분`:'측정 부족') : '교수 확인'], issues: r.summary&&r.summary.topIssue? [{code:'',label:r.summary.topIssue.label,sev:'warn'}] : [], score: r.summary? r.summary.score : null, manual: r.type!=='movement', check:r.check})), itemHead:['순서','단계','소요','AI 측정'],
      chart:{yLabel:'압박 속도(회/분)', y0:0, y1:160, band:[100,120], points:[]}};
  }
}

/* ===== 모범 자세 따라 하기: 자세 특징 → 모범(여러 번 찍은 평균) → 비슷한 정도 =====
 * 관절 각도 10개로 자세를 나타낸다. 모범을 여러 번 찍으면 각도마다 평균과 허용 범위를 기억하고,
 * 학생 자세가 허용 범위를 벗어난 만큼 점수를 깎는다. 가장 많이 벗어난 부위를 말로 알려 준다.
 * 각도는 화면(2D) 기준이므로 모범과 학생은 같은 방향에서 찍어야 한다. 좌우가 뒤집힌 자세는 자동으로 맞춰 본다.
 */
const signedAt=(a,b,c)=>deg(Math.atan2((a.x-b.x)*(c.y-b.y)-(a.y-b.y)*(c.x-b.x), (a.x-b.x)*(c.x-b.x)+(a.y-b.y)*(c.y-b.y))); // b에서 본 a→c 회전각(−180~180)
const fromDown=(a,b)=>deg(Math.atan2(b.x-a.x, b.y-a.y));   // a→b 방향: 아래 0°, 화면 오른쪽 +90°, 위 ±180°
const fromUp=(a,b)=>deg(Math.atan2(b.x-a.x, -(b.y-a.y)));  // a→b 방향: 위 0°, 화면 오른쪽 +90°
export const circDiff=(a,b)=>((a-b+540)%360)-180;
const circMean=(arr)=>{ let s=0,c=0; for(const a of arr){ s+=Math.sin(a*Math.PI/180); c+=Math.cos(a*Math.PI/180); } return deg(Math.atan2(s,c)); };
export const FEATURES={
  elbL:{label:'왼쪽 팔꿈치', group:'arms', kind:'joint', obj:'왼쪽 팔꿈치를', seg:[[11,13],[13,15]]},
  elbR:{label:'오른쪽 팔꿈치', group:'arms', kind:'joint', obj:'오른쪽 팔꿈치를', seg:[[12,14],[14,16]]},
  armL:{label:'왼팔', group:'arms', kind:'raise', obj:'왼팔을', seg:[[11,13]]},
  armR:{label:'오른팔', group:'arms', kind:'raise', obj:'오른팔을', seg:[[12,14]]},
  trunk:{label:'상체', group:'body', kind:'lean', obj:'상체를', seg:[[11,23],[12,24]]},
  head:{label:'고개', group:'body', kind:'lean', obj:'고개를', seg:[]},
  hipL:{label:'왼쪽 엉덩이', group:'legs', kind:'hip', obj:'왼쪽 엉덩이를', seg:[[23,25]]},
  hipR:{label:'오른쪽 엉덩이', group:'legs', kind:'hip', obj:'오른쪽 엉덩이를', seg:[[24,26]]},
  kneeL:{label:'왼쪽 무릎', group:'legs', kind:'joint', obj:'왼쪽 무릎을', seg:[[25,27]]},
  kneeR:{label:'오른쪽 무릎', group:'legs', kind:'joint', obj:'오른쪽 무릎을', seg:[[26,28]]},
};
export const FEATURE_GROUPS={arms:'팔·어깨', body:'상체·고개', legs:'다리'};
const SWAP={elbL:'elbR',elbR:'elbL',armL:'armR',armR:'armL',hipL:'hipR',hipR:'hipL',kneeL:'kneeR',kneeR:'kneeL',trunk:'trunk',head:'head'};
export const SK_IDX=[0,11,12,13,14,15,16,23,24,25,26,27,28]; // 모범 윤곽(점선)을 그릴 때 쓰는 관절 13개

/** 한 프레임의 자세 특징. {키:{a:각도, v:보이는 정도}} */
export function poseFeatures(p){
  const f={}; const put=(k,a,v)=>{ f[k]={a,v}; };
  for(const [s,S] of [['L',p.L],['R',p.R]]){
    put('elb'+s, signedAt(S.sho,S.elb,S.wri), Math.min(S.sho.v,S.elb.v,S.wri.v));
    put('arm'+s, fromDown(S.sho,S.elb), Math.min(S.sho.v,S.elb.v));
    put('hip'+s, signedAt(S.sho,S.hip,S.knee), Math.min(S.sho.v,S.hip.v,S.knee.v));
    put('knee'+s, signedAt(S.hip,S.knee,S.ank), Math.min(S.hip.v,S.knee.v,S.ank.v));
  }
  put('trunk', fromUp(p.hipMid,p.shoMid), Math.min(p.hipMid.v,p.shoMid.v));
  put('head', fromUp(p.shoMid,p.nose), Math.min(p.shoMid.v,p.nose.v));
  return f;
}
/** 한 프레임 → 표본(특징 + 관절 좌표). 모범을 만들 때 쓴다. */
export function poseSample(lm,W,H){ const p=analyzePose(lm,W,H); return { f:poseFeatures(p), pts:SK_IDX.map(i=>[lm[i].x*W, lm[i].y*H, lm[i].visibility==null?1:lm[i].visibility]), ratio:dist(p.L.sho,p.R.sho)/p.torso }; }
/** 가만히 있는 동안의 여러 프레임을 하나의 표본으로 평균 */
export function mergeSamples(list){ if(!list.length) return null; const n=list.length; const f={}; for(const k of Object.keys(FEATURES)){ const vs=list.map(s=>s.f[k]); f[k]={a:circMean(vs.map(x=>x.a)), v:vs.reduce((s,x)=>s+x.v,0)/n}; } const pts=list[0].pts.map((_,j)=>[0,1,2].map(d=>list.reduce((s,x)=>s+x.pts[j][d],0)/n)); return {f, pts, ratio:list.reduce((s,x)=>s+x.ratio,0)/n}; }
function normPts(s,an){ const P=s.pts; const sho=[(P[1][0]+P[2][0])/2,(P[1][1]+P[2][1])/2], hip=[(P[7][0]+P[8][0])/2,(P[7][1]+P[8][1])/2]; const o= an==='sho'?sho:hip; const u= (an==='sho'? Math.hypot(P[1][0]-P[2][0],P[1][1]-P[2][1]) : Math.hypot(sho[0]-hip[0],sho[1]-hip[1]))||1; return P.map(q=>[(q[0]-o[0])/u,(q[1]-o[1])/u,q[2]]); }
/** 표본 여러 개 → 모범. f:{키:[평균각, 허용범위]}, sk: 윤곽 좌표(×100), an: 윤곽 기준점(정면이면 어깨, 옆모습이면 엉덩이), sd: 표본끼리의 평균 차이(°) */
export function buildPoseTemplate(samples, opts={}){
  const n=samples.length; if(!n) return null; const tolBase=opts.tol??12;
  const an= samples.filter(s=>s.ratio>0.45).length*2>=n ? 'sho':'hip';
  const f={}; let sdSum=0, sdN=0;
  for(const k of Object.keys(FEATURES)){ const vals=samples.map(s=>s.f[k]).filter(x=>x&&x.v>=0.5); if(vals.length<Math.max(1,Math.ceil(n*0.6))) continue; const m=circMean(vals.map(x=>x.a)); const sd=Math.sqrt(vals.reduce((s,x)=>s+circDiff(x.a,m)**2,0)/vals.length); sdSum+=sd; sdN++; f[k]=[Math.round(m), Math.round(clamp(Math.max(tolBase,2*sd),tolBase,35))]; }
  if(Object.keys(f).length<3) return null;
  const sk=SK_IDX.map((_,j)=>{ let x=0,y=0,v=0; for(const s of samples){ const q=normPts(s,an); x+=q[j][0]; y+=q[j][1]; v+=q[j][2]; } return [Math.round(x/n*100),Math.round(y/n*100),Math.round(v/n*10)]; });
  return {v:1, n, an, f, sk, sd: sdN? +(sdSum/sdN).toFixed(1):0};
}
/** 모범과 현재 자세 비교. sim: 0~100, per: 부위별 차이, worst: 가장 많이 벗어난 부위. 좌우가 뒤집힌 자세도 함께 견줘 더 비슷한 쪽을 쓴다. */
export function comparePose(tpl, feats, opts={}){
  const keys=Object.keys(tpl.f).filter(k=>!opts.use||opts.use.includes(FEATURES[k].group)); const scale=opts.tolScale??1;
  const run=(mir)=>{ let sum=0,n=0,miss=0; const per={}; let worst=null;
    for(const k of keys){ const sk= mir?SWAP[k]:k; const s=feats[sk]; if(!s||s.v<0.4){ miss++; continue; } const sa= mir?-s.a:s.a; const [m,tol]=tpl.f[k]; const d=Math.abs(circDiff(sa,m)); const ex=Math.max(0,d-tol*scale); const sc=clamp(100-ex*2.5,0,100);
      const flip= Math.sign(sa)!==Math.sign(m) && Math.abs(sa)>25 && Math.abs(m)>25 && Math.abs(sa)<155 && Math.abs(m)<155 && Math.abs(Math.abs(sa)-Math.abs(m))<=tol*scale;
      per[sk]={d, ok:ex===0, sc, dir: Math.abs(sa)<Math.abs(m)?-1:1, flip, tk:k}; sum+=sc; n++; if(ex>0&&(!worst||ex>worst.ex)) worst={k:sk,ex,d}; }
    // 전체 평균만 쓰면 "다리·몸통은 같고 팔만 전혀 다른" 자세도 점수가 높게 나온다 → 가장 많이 틀린 세 부위의 평균을 절반 반영한다
    const low=Object.values(per).map(x=>x.sc).sort((a,b)=>a-b).slice(0,3); const lowAvg= low.length? low.reduce((a,b)=>a+b,0)/low.length : 0;
    return {sim:n? 0.5*(sum/n)+0.5*lowAvg : 0, n, miss, per, worst, mirrored:mir}; };
  const a=run(false); if(opts.mirror===false) return a; const b=run(true);
  return opts.preferMirror? (a.sim>b.sim+3? a:b) : (b.sim>a.sim+3? b:a);
}
/** "어느 부위를 어떻게" 한 줄 교정 문구. per: comparePose의 부위별 결과 */
export function featureCue(k, per){ const F=FEATURES[k]; if(!F||!per) return ''; if(per.flip) return `${F.label} 방향을 모범에 맞추세요`; const less=per.dir<0;
  if(F.kind==='joint') return `${F.obj} ${less?'더 펴세요':'더 굽히세요'}`;
  if(F.kind==='hip') return less? '허리와 엉덩이를 더 펴세요':'엉덩이를 더 접으세요';
  if(F.kind==='raise') return `${F.obj} ${less?'더 올리세요':'더 내리세요'}`;
  if(k==='trunk') return less? '상체를 더 기울이세요':'상체를 세우세요';
  return less? '고개를 더 숙이세요':'고개를 드세요'; }

/** 교수(또는 누구나)가 찍은 모범으로 만든 "따라 하기" 동작 */
export function matchMovement(def){
  const tpl=def.tpl; const use= def.use&&def.use.length? def.use : null; const hold=def.hold??2;
  const legs=['kneeL','kneeR','hipL','hipR'].some(k=>tpl.f[k]) && (!use||use.includes('legs'));
  const sk=tpl.sk; const handsUp= sk[5][2]>=5&&sk[6][2]>=5&&sk[5][1]<sk[0][1]&&sk[6][1]<sk[0][1];
  return { id:def.id, name:def.name, type:'match', category:'모범 따라 하기', custom:true, kind:'match', tpl, use, pass:def.pass??75, holdSec:hold, tolScale:def.tolScale??1, mirror:def.mirror!==false, count:def.count??3,
    view: legs?'full':'upper', noHandsEnd:handsUp, angleLabel:'모범과 비슷한 정도', unit:'%', trunkLabel:'가장 다른 부위', highlight:[], checks:[], feedback:{},
    phaseNames:{seek:'맞추는 중', hold:'유지 중', rest:'잠깐 풀기', done:'완료'},
    live:{ready:'모범 자세를 따라 해 보세요', seek:'점선(모범)에 몸을 맞춰 보세요', partial:'조금 더 유지하세요'}, good:['좋아요','똑같아요','바로 그 자세예요'],
    checkpoints:(def.checkpoints&&def.checkpoints.length)? def.checkpoints : ['화면의 점선(모범)에 내 몸을 맞추기','빨간색 부위부터 고치기',`초록색이 되면 그대로 ${hold}초 멈추기`],
    setup: def.setup || (legs? '모범을 찍은 방향과 같은 방향에서, 전신이 보이게 서 주세요.' : '모범을 찍은 방향과 같은 방향에서, 어깨와 양팔이 보이게 해 주세요.'),
    setupSay: legs? '전신이 보이게 서 주세요':'어깨와 양팔이 보이게 해 주세요' };
}

export class MatchAnalyzer {
  constructor(mv, opts={}){ this.mv=mv; this.tpl=mv.tpl; this.goal=opts.goal??mv.count??3; this.pass=mv.pass??75; this.holdSec=mv.holdSec??2; this.reset(); }
  reset(){ this.phase='seek'; this.reps=[]; this.partial=0; this.cur=null; this.sim=null; this.cmp=null; this.mir=false; this.timeline=[]; this.lastSample=0; this.startT=null; this.seekStart=null; this.restT=0; this.lowSince=null; this.lastHint=0; this.noPerson=true; this.lastSeen=null; this.goodStreak=0; this.mm=new MotionMeter(); }
  update(lm,W,H,t){
    if(this.startT==null) this.startT=t; if(this.seekStart==null) this.seekStart=t; const mv=this.mv;
    const out=(o)=>Object.assign({count:this.reps.length, goal:this.goal, phase:this.phase, done:false, repEvent:null, angle:this.sim, trunk:null, cmp:this.cmp, mirrored:this.mir, tpl:this.tpl}, o);
    if(!(lm&&lm.length>=33)){ this.noPerson=true; this.cmp=null; return out({cue:mv.live.ready, sev:''}); }
    const p=analyzePose(lm,W,H); const feats=poseFeatures(p);
    const cmp=comparePose(this.tpl,feats,{use:mv.use,tolScale:mv.tolScale,mirror:mv.mirror,preferMirror:this.mir});
    if(cmp.n===0||cmp.miss>cmp.n){ this.noPerson=true; this.cmp=null; return out({cue: mv.view==='upper'?'어깨와 양팔이 화면에 다 보이게 해 주세요':'몸 전체가 화면에 보이게 서 주세요', sev:'', pose:p}); }
    this.noPerson=false; this.lastSeen=t; this.mir=cmp.mirrored; this.cmp=cmp; const move=this.mm.update(lm,W,H);
    this.sim= this.sim==null? cmp.sim : this.sim*0.6+cmp.sim*0.4; const sim=this.sim;
    if(t-this.lastSample>100){ this.timeline.push({t:(t-this.startT)/1000, a:sim}); this.lastSample=t; }
    const worstCue= cmp.worst? featureCue(cmp.worst.k, cmp.per[cmp.worst.k]) : '';
    if(this.phase==='rest'){ if(sim<this.pass-15||t-this.restT>3000){ this.phase='seek'; this.seekStart=t; } return out({cue:'좋아요! 자세를 풀었다가 다시', sev:'good', pose:p}); }
    if(this.phase==='done') return out({cue:'완료', sev:'good', done:true, pose:p});
    if(this.phase==='seek'){
      if(sim>=this.pass){ this.phase='hold'; this.cur={t0:t, sims:[], per:{}, vals:{}, move:0, n:0, seek:(t-this.seekStart)/1000}; this.lowSince=null; }
      else { let repEvent=null; const far=sim<35; if(!far&&worstCue&&t-this.lastHint>3500&&t-this.seekStart>1500){ repEvent={say:worstCue, hint:true}; this.lastHint=t; }
        return out({cue: far||!worstCue? mv.live.seek : worstCue, sev: far?'':(sim>=this.pass-15?'warn':'bad'), repEvent, pose:p, hinted:true}); }
    }
    const c=this.cur; c.sims.push(cmp.sim); c.n++; c.move+=move; for(const [k,v] of Object.entries(cmp.per)){ (c.per[k]=c.per[k]||[]).push(v.d); (c.vals[k]=c.vals[k]||[]).push(feats[k].a); }
    if(sim<this.pass-8){ if(!this.lowSince) this.lowSince=t; if(t-this.lowSince>500){ this.phase='seek'; this.cur=null; this.partial++; return out({cue:`${this.holdSec}초 동안 그대로 있어야 인정돼요`, sev:'warn', repEvent:{partial:true}, pose:p}); } } else this.lowSince=null;
    const held=(t-c.t0)/1000;
    if(held>=this.holdSec){
      const avg=(a)=>a.reduce((s,v)=>s+v,0)/a.length; const simAvg=avg(c.sims);
      const tolOf=(k)=>((this.tpl.f[this.mir?SWAP[k]:k]||[0,12])[1])*(mv.tolScale||1);
      const off=Object.entries(c.per).map(([k,a])=>({k,d:avg(a)})).filter(x=>x.d>tolOf(x.k)).sort((a,b)=>(b.d-tolOf(b.k))-(a.d-tolOf(a.k))).slice(0,2);
      const vals={}; for(const [k,a] of Object.entries(c.vals)) vals[k]=circMean(a);
      const cueOf=(k)=>{ const tk=this.mir?SWAP[k]:k; const m=(this.tpl.f[tk]||[0])[0]; const sa=this.mir?-vals[k]:vals[k]; return featureCue(k,{dir:Math.abs(sa)<Math.abs(m)?-1:1, flip:false}); };
      const r={n:this.reps.length+1, sim:simAvg, score:Math.round(simAvg), issues:off.map(x=>({code:x.k,label:`${FEATURES[x.k].label} ${Math.round(x.d)}° 다름`,sev:x.d>tolOf(x.k)+15?'bad':'warn'})), worst:off[0]?off[0].k:null, fix:off[0]?cueOf(off[0].k):'', dur:c.seek, shake:c.move/c.n, vals, bottomT:(t-this.startT)/1000};
      this.reps.push(r); this.goodStreak= r.issues.length?0:this.goodStreak+1; this.cur=null; const done=this.reps.length>=this.goal; this.phase= done?'done':'rest'; this.restT=t;
      return out({count:this.reps.length, cue: r.issues.length? `${r.issues[0].label}` : `${mv.good[this.reps.length%mv.good.length]}! ${this.reps.length}회`, sev: r.issues.length?'warn':'good', repEvent:r, done, pose:p});
    }
    return out({cue:`좋아요, 그대로 · ${Math.max(1,Math.ceil(this.holdSec-held))}`, sev:'good', pose:p});
  }
  summary(){
    const reps=this.reps, mv=this.mv; if(!reps.length) return null; const avg=(a)=>a.reduce((s,v)=>s+v,0)/a.length; const score=Math.round(avg(reps.map(r=>r.score))); const sim=avg(reps.map(r=>r.sim));
    const counts={}; reps.forEach(r=>r.issues.forEach(i=>{counts[i.code]=(counts[i.code]||0)+1;})); const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    let cons=null; if(reps.length>=2){ const sds=Object.keys(reps[0].vals).map(k=>{ const a=reps.map(r=>r.vals[k]).filter(v=>v!=null); if(a.length<2) return null; const m=circMean(a); return Math.sqrt(a.reduce((s,v)=>s+circDiff(v,m)**2,0)/a.length); }).filter(v=>v!=null); cons= sds.length? avg(sds):null; }
    return {type:'match', movement:mv.id, movementName:mv.name, score, grade:gradeOf(score), count:reps.length, goal:this.goal, partial:this.partial, sim, consistency:cons, shake:avg(reps.map(r=>r.shake)),
      topIssue: top?{code:top[0],label:FEATURES[top[0]].label,n:top[1]}:null, reps, timeline:this.timeline, target:this.pass, unit:'%', angleLabel:mv.angleLabel,
      tiles:[['맞춘 횟수',`${reps.length}회`],['평균 비슷한 정도',`${Math.round(sim)}%`],['가장 자주 다른 부위', top?`${FEATURES[top[0]].label} (${top[1]}회)`:'없음'],['자세 일관성', cons==null?'—':`±${cons.toFixed(1)}°`]],
      items:reps.map(r=>({cols:[`${r.n}`,`${Math.round(r.sim)}%`, r.worst?FEATURES[r.worst].label:'—', `${r.dur.toFixed(1)}초`], issues:r.issues, score:r.score})), itemHead:['회차','비슷한 정도','가장 다른 부위','맞추는 데 걸린 시간'],
      chart:{yLabel:'모범과 비슷한 정도(%)', y0:0, y1:100, target:this.pass, points:reps.map(r=>({t:r.bottomT,a:r.sim,score:r.score,n:r.n,issues:r.issues.length}))}};
  }
}

/** 영상 속에서 "멈춘 자세"를 찾아 표본으로 뽑는다(모범 영상 올리기용). 0.7초 이상 가만히 있으면 한 장으로 친다. */
export class StillCapture {
  constructor(opts={}){ this.minMs=opts.minMs??700; this.thr=opts.thr??0.012; this.mm=new MotionMeter(); this.buf=[]; this.since=null; this.armed=true; this.movedSince=null; this.samples=[]; }
  update(lm,W,H,t){ if(!(lm&&lm.length>=33)){ this.buf=[]; this.since=null; this.mm.reset(); return null; } const move=this.mm.update(lm,W,H); const still=move<this.thr;
    if(!still){ this.buf=[]; this.since=null; if(this.movedSince==null) this.movedSince=t; if(t-this.movedSince>=300) this.armed=true; return null; } // 0.3초 이상 움직인 뒤에야 다음 자세를 받는다
    this.movedSince=null; if(!this.armed) return null; if(this.since==null) this.since=t; this.buf.push(poseSample(lm,W,H));
    if(t-this.since>=this.minMs&&this.buf.length>=4){ const s=mergeSamples(this.buf); this.samples.push(s); this.buf=[]; this.since=null; this.armed=false; return s; } return null; }
}

/* ===== 달리기 자세 (런닝머신 옆에서 촬영) =====
 * 발걸음: 두 발목의 앞뒤 간격이 가장 벌어지는 순간을 한 걸음으로 센다(좌우 발 표시가 바뀌어도 영향 없음).
 * 기준값(발걸음 수·상체 기울기·위아래 흔들림)은 일반적인 달리기 지도 기준을 따른 기본값이며, 동작 정의에서 바꿀 수 있다.
 */
export class GaitAnalyzer {
  constructor(mv, opts={}){ this.mv=mv; this.duration=opts.goal??mv.duration??30; this.reset(); }
  reset(){ this.steps=[]; this.s=null; this.dir=0; this.hi=null; this.lo=null; this.hiT=0; this.hiSnap=null; this.startT=null; this.t0=null; this.timeline=[]; this.lastSample=0; this.noPerson=true; this.lastSeen=null; this.lastStepT=null; this.hipMin=null; this.hipMax=null; this.legLen=null; this.lastAnnounce=0; this.marks=new Set(); }
  cadence(){ const s=this.steps; if(s.length<4) return null; const n=Math.min(8,s.length-1); const dt=(s[s.length-1].t-s[s.length-1-n].t)/n; return dt>0? 60/dt : null; }
  update(lm,W,H,t){
    if(this.startT==null) this.startT=t; const mv=this.mv; const el= this.t0==null?0:Math.max(0,(t-this.t0)/1000);
    const out=(o)=>Object.assign({count:Math.min(Math.floor(el),this.duration), goal:this.duration, phase:'go', done:false, repEvent:null, angle:this.cadence(), trunk:null}, o);
    if(!(lm&&lm.length>=33)){ this.noPerson=true; return out({cue:mv.live.ready, sev:''}); }
    const p=analyzePose(lm,W,H); const keys=['hip','knee','ank']; const vl=p.vis(p.L,keys), vr=p.vis(p.R,keys);
    if(Math.max(vl,vr)<0.5){ this.noPerson=true; return out({cue:'전신이 보이게 해 주세요', sev:'', pose:p}); }
    this.noPerson=false; this.lastSeen=t; const S= vl>=vr?p.L:p.R, m= vl>=vr?p.mL:p.mR;
    const facing=Math.sign((S.foot.x-S.heel.x)||1); const lean=fromUp(p.hipMid,p.shoMid)*facing; // 앞으로 기울면 +
    const leg=dist(S.hip,S.knee)+dist(S.knee,S.ank); this.legLen= this.legLen==null? leg : this.legLen*0.95+leg*0.05;
    const raw=Math.abs(p.L.ank.x-p.R.ank.x)/p.torso; this.s= this.s==null? raw : this.s*0.5+raw*0.5; const s=this.s;
    const hy=p.hipMid.y; if(this.hipMin==null||hy<this.hipMin) this.hipMin=hy; if(this.hipMax==null||hy>this.hipMax) this.hipMax=hy;
    const front= (p.L.ank.x-p.R.ank.x)*facing>0? {S:p.L,m:p.mL} : {S:p.R,m:p.mR};
    const snap={knee:front.m.knee, ahead:((front.S.ank.x-p.hipMid.x)*facing)/(this.legLen||1), lean, elbow:m.elbow};
    let repEvent=null;
    if(this.dir>=0){ if(this.hi==null||s>this.hi){ this.hi=s; this.hiT=t; this.hiSnap=snap; }
      if(this.hi-s>0.08){ if((this.lo==null||this.hi-this.lo>0.25)&&(!this.lastStepT||this.hiT-this.lastStepT>170)){
          if(this.t0==null) this.t0=this.hiT; const h=this.hiSnap;
          const st={n:this.steps.length+1, t:(this.hiT-this.t0)/1000, knee:h.knee, ahead:h.ahead, lean:h.lean, elbow:h.elbow, bounce:(this.hipMax-this.hipMin)/(this.legLen||1)*100, over:h.knee>=168&&h.ahead>0.45};
          this.steps.push(st); this.lastStepT=this.hiT; repEvent={step:st}; this.hipMin=hy; this.hipMax=hy; }
        this.dir=-1; this.lo=s; } }
    else { if(s<this.lo) this.lo=s; if(s-this.lo>0.08){ this.dir=1; this.hi=s; this.hiT=t; this.hiSnap=snap; } }
    const cad=this.cadence(); if(this.t0!=null&&t-this.lastSample>200){ this.timeline.push({t:el, a:cad??0}); this.lastSample=t; }
    const recent=this.steps.slice(-6); const avgOf=(k)=>recent.reduce((a,x)=>a+x[k],0)/(recent.length||1); let code=null;
    if(recent.length>=5){ const L=avgOf('lean'); if(L>mv.leanMax) code='lean'; else if(L<-3) code='back'; else if(recent.filter(x=>x.over).length>=3) code='over'; else if(avgOf('bounce')>mv.bounceMax) code='bounce'; else if(cad!=null&&cad<mv.rateMin) code='slow'; else if(avgOf('elbow')>130) code='arm'; }
    let cue, sev='';
    if(this.t0==null) cue=mv.live.ready;
    else if(this.lastStepT&&t-this.lastStepT>2500){ cue='계속 달려 주세요'; sev='warn'; }
    else if(code){ const fb=mv.feedback[code]; cue=`${fb.cue}${cad?` · ${cad.toFixed(0)}보/분`:''}`; sev=(code==='slow'||code==='arm')?'warn':'bad'; if(t-this.lastAnnounce>5000){ repEvent=Object.assign(repEvent||{},{say:fb.cue}); this.lastAnnounce=t; } }
    else if(cad!=null){ cue=`${mv.good[0]} · ${cad.toFixed(0)}보/분`; sev='good'; } else cue='좋아요, 계속 달리세요';
    const sec=Math.floor(el); if(sec>0&&sec%10===0&&sec<this.duration&&!this.marks.has(sec)){ this.marks.add(sec); repEvent=Object.assign(repEvent||{},{say:`${sec}초`, mark:sec}); }
    const done= this.t0!=null&&el>=this.duration;
    return out({angle:cad, trunk:lean, cue: done?'끝, 수고했어요':cue, sev: done?'good':sev, repEvent, done, pose:p, side: vl>=vr?'L':'R'});
  }
  summary(){
    const mv=this.mv; const st=this.steps.slice(2); if(st.length<8) return null; const avg=(a)=>a.length? a.reduce((s,v)=>s+v,0)/a.length : 0;
    const dur=this.steps[this.steps.length-1].t; const ints=[]; for(let i=1;i<this.steps.length;i++){ const dt=this.steps[i].t-this.steps[i-1].t; if(dt>0&&dt<1.5) ints.push(dt); } const cadence= ints.length? 60/avg(ints) : 0;
    const lean=avg(st.map(x=>x.lean)), bounce=avg(st.map(x=>x.bounce)), elbow=avg(st.map(x=>x.elbow)); const frac=(f)=>st.filter(f).length/st.length;
    const fr={lean:frac(x=>x.lean>mv.leanMax), back:frac(x=>x.lean<-3), over:frac(x=>x.over), bounce:frac(x=>x.bounce>mv.bounceMax), arm:frac(x=>x.elbow>130), slow: cadence<mv.rateMin?1:0};
    const score=Math.round(clamp(100-fr.lean*20-fr.back*20-fr.over*20-fr.bounce*15-fr.slow*15-fr.arm*10, 40, 100));
    const top=Object.entries(fr).filter(([k,v])=>v>=0.3).sort((a,b)=>b[1]-a[1])[0];
    const blocks=[]; for(let b=0;b*10<dur;b++){ const xs=st.filter(x=>x.t>=b*10&&x.t<(b+1)*10); if(xs.length<3) continue; const span=xs[xs.length-1].t-xs[0].t; const c= span>0? (xs.length-1)/span*60 : 0; const L=avg(xs.map(x=>x.lean)), B=avg(xs.map(x=>x.bounce)); const iss=[]; const add=(code,sev)=>iss.push({code,label:mv.feedback[code].label,sev});
      if(L>mv.leanMax) add('lean','bad'); else if(L<-3) add('back','bad'); if(xs.filter(x=>x.over).length/xs.length>=0.5) add('over','bad'); if(B>mv.bounceMax) add('bounce','warn'); if(c&&c<mv.rateMin) add('slow','warn');
      blocks.push({cols:[`${b*10}~${Math.min((b+1)*10,Math.round(dur))}초`,`${c.toFixed(0)}보/분`,`${L>=0?'앞':'뒤'} ${Math.abs(L).toFixed(0)}°`,`${B.toFixed(0)}%`], issues:iss, score: iss.length? (iss.some(x=>x.sev==='bad')?60:80) : 100}); }
    return {type:'gait', movement:mv.id, movementName:mv.name, score, grade:gradeOf(score), count:Math.round(dur), goal:this.duration, cadence, lean, bounce, elbow, steps:this.steps.length, rateMin:mv.rateMin, rateMax:mv.rateMax,
      topIssue: top?{code:top[0],label:mv.feedback[top[0]].label,n:Math.round(top[1]*100)}:null, timeline:this.timeline, target:null, angleLabel:mv.angleLabel,
      tiles:[['달린 시간',`${Math.round(dur)}초 · ${this.steps.length}걸음`],['발걸음 수',`${cadence.toFixed(0)}보/분`],['상체 기울기',`${lean>=0?'앞으로':'뒤로'} ${Math.abs(lean).toFixed(0)}°`],['위아래 흔들림',`다리 길이의 ${bounce.toFixed(0)}%`]],
      items:blocks, itemHead:['구간','발걸음','상체','흔들림'], chart:{yLabel:'발걸음 수(보/분)', y0:100, y1:230, band:[mv.rateMin,mv.rateMax], points:[]}};
  }
}

/** 동작 정의로 분석기 만들기 */
export function makeAnalyzer(mv, opts={}){
  if(mv.type==='hold') return new HoldAnalyzer(mv,opts);
  if(mv.type==='rate') return new RateAnalyzer(mv,opts);
  if(mv.type==='procedure') return new ProcedureRunner(mv,opts);
  if(mv.type==='match') return new MatchAnalyzer(mv,opts);
  if(mv.type==='gait') return new GaitAnalyzer(mv,opts);
  return new RepAnalyzer(mv,opts);
}

/** 규칙 기반 코치 코멘트 (외부 AI 없이). 반환값은 HTML이며, 바깥에서 온 글자(동작 이름·문구)는 모두 escH를 거친다. */
export function buildComment(s){
  const mv=MOVEMENTS[s.movement]||{feedback:s.fb||{}}; const ps=[]; const fbOf=(code)=>{ const f=(s.fb&&s.fb[code])||mv.feedback[code]; return f? {label:escH(f.label), tip:escH(f.tip)} : null; };
  if(s.type==='rep'){
    const reached=s.reps.filter(r=>s.invert? r.min>=s.target : r.min<=s.target).length; const al=escH(s.angleLabel);
    ps.push(`${s.count}회 중 ${reached}회가 목표(${al} ${s.target}° ${s.invert?'이상':'이하'})에 도달했습니다.${s.partial?` 목표에 한참 못 미쳐 횟수로 인정되지 않은 동작이 ${s.partial}회 있었습니다.`:''}`);
    const byCode={}; s.reps.forEach(r=>r.issues.forEach(i=>{(byCode[i.code]=byCode[i.code]||[]).push(r.n);}));
    Object.entries(byCode).sort((a,b)=>b[1].length-a[1].length).slice(0,2).forEach(([code,ns])=>{ const fb=fbOf(code); if(fb) ps.push(`${ns.length===s.count&&s.count>=4?'모든 ':ns.join('·')}회차에서 "${fb.label}"이(가) 나타났습니다. ${fb.tip}`); });
    if(!Object.keys(byCode).length) ps.push('모든 반복이 기준을 통과했습니다. '+(s.next? escH(s.next) : s.invert? '다음에는 횟수를 늘려 도전해 보세요.' : '다음에는 목표 깊이를 5° 낮추거나 횟수를 늘려 도전해 보세요.'));
  } else if(s.type==='hold'){
    ps.push(`${s.goal}초 목표 중 ${s.held.toFixed(0)}초를 유지했고, 그중 ${s.goodTime.toFixed(0)}초(${Math.round(s.goodTime/s.held*100)}%)가 바른 자세였습니다.`);
    if(s.topIssue){ const fb=fbOf(s.topIssue.code); if(fb) ps.push(`가장 오래 나타난 문제는 "${fb.label}"(${s.topIssue.n}초)입니다. ${fb.tip}`); } else ps.push('자세 이탈 없이 유지했습니다. 다음에는 시간을 10초 늘려 보세요.');
  } else if(s.type==='rate'){
    ps.push(`${s.count}회를 평균 분당 ${s.avgRate.toFixed(0)}회로 압박했고, 적정 속도(100~120/분) 비율은 ${Math.round(s.inRange*100)}%였습니다. 팔꿈치를 편 비율 ${Math.round(s.elbowOk*100)}%, 어깨가 손 위에 있던 비율 ${Math.round(s.vertOk*100)}%입니다.${s.pauses?` 2.5초 이상 중단이 ${s.pauses}회 있었습니다.`:''}`);
    if(s.topIssue){ const fb=fbOf(s.topIssue.code); if(fb) ps.push(`"${fb.label}"이(가) 가장 자주 나타났습니다. ${fb.tip}`); }
    ps.push('압박 깊이(5cm)는 카메라로 측정하지 않으므로 마네킹 표시등이나 교수자 확인으로 평가합니다.');
  } else if(s.type==='procedure'){
    ps.push(`${s.goal}단계 중 ${s.count}단계를 ${s.completed?'모두 ':''}수행했습니다.${s.aiScore!=null?` 가슴압박 단계의 AI 점수는 ${s.aiScore}점입니다.`:''}`);
    const comp=s.steps.filter(r=>r.summary); comp.forEach(r=>{ const su=r.summary; ps.push(`${escH(r.name)}: ${su.count}회, 평균 ${su.avgRate.toFixed(0)}/분, 적정 속도 ${Math.round(su.inRange*100)}%${su.topIssue?`, 주의: ${escH(su.topIssue.label)}`:''}.`); });
    ps.push('반응 확인·신고·호흡 확인·기도 개방·AED는 카메라로 판정하지 않는 단계로, 시험에서는 교수자가 체크리스트로 확인합니다.');
  } else if(s.type==='match'){
    ps.push(`모범 자세를 ${s.count}회 맞췄고, 모범과 비슷한 정도는 평균 ${Math.round(s.sim)}%입니다(${s.target}% 이상이면 인정).${s.partial?` 자세가 금방 풀려 인정되지 않은 시도가 ${s.partial}회 있었습니다.`:''}`);
    if(s.topIssue){ const k=s.topIssue.code; const ds=s.reps.map(r=>r.issues.find(i=>i.code===k)).filter(Boolean); ps.push(`가장 자주 달랐던 부위는 "${escH(s.topIssue.label)}"입니다(${s.count}회 중 ${s.topIssue.n}회). 화면의 점선에 이 부위부터 맞추면 점수가 가장 빨리 오릅니다.`); }
    else ps.push('모든 부위가 모범의 허용 범위 안에 들어왔습니다.');
    if(s.consistency!=null) ps.push(`자세 일관성은 ±${s.consistency.toFixed(1)}°입니다. 매번 같은 자세가 나올수록 이 숫자가 작아집니다${s.consistency<=4?' — 아주 고르게 반복했습니다.':s.consistency<=8?'.':' — 회차마다 자세가 달라지고 있으니 한 동작씩 천천히 반복해 보세요.'}`);
  } else if(s.type==='gait'){
    ps.push(`${s.count}초 동안 ${s.steps}걸음, 평균 분당 ${s.cadence.toFixed(0)}보로 달렸습니다(기준 ${s.rateMin}~${s.rateMax}보). 상체는 ${s.lean>=0?'앞으로':'뒤로'} 평균 ${Math.abs(s.lean).toFixed(0)}° 기울었고, 위아래 흔들림은 다리 길이의 ${s.bounce.toFixed(0)}%였습니다.`);
    if(s.topIssue){ const fb=fbOf(s.topIssue.code); if(fb) ps.push(`가장 자주 나타난 문제는 "${fb.label}"입니다. ${fb.tip}`); } else ps.push('기준을 벗어난 항목이 없었습니다. 같은 자세로 시간을 조금씩 늘려 보세요.');
    ps.push('폰 카메라 한 대로 본 추정값입니다. 통증이 있거나 정밀한 분석이 필요하면 전문가의 측정을 받으세요.');
  }
  return ps.map(p=>`<p>${p}</p>`).join('');
}

/** 교수가 학생에게 보내는 답장의 기본 문구 (내장 규칙, 외부 AI 없이). r: 제출 기록, mv: 동작 정의(없으면 내장 동작에서 찾음) */
export function buildReply(r, mv, opts={}){
  mv = mv || MOVEMENTS[r.movement] || null; const name=r.name||'학생'; const score=Math.round(+r.score||0);
  const unit= (r.kind==='hold'||r.kind==='gait')?'초':r.kind==='procedure'?'단계':'회';
  if(opts.hideScore) return `${name} 학생, ${r.movementName||'실기'} 시험 영상이 정상적으로 접수되었습니다. 결과는 채점이 끝난 뒤 안내하겠습니다.`;
  const ps=[`${name} 학생, ${r.movementName||'동작'} ${r.count??''}${unit} 기록을 확인했습니다. 점수는 ${score}점입니다.`];
  const fb= mv&&r.topIssue? Object.values(mv.feedback||{}).find(f=>f&&f.label===r.topIssue) : null;
  if(fb) ps.push(`가장 자주 나온 문제는 "${fb.label}"입니다. ${fb.tip}`);
  else if(r.topIssue) ps.push(`가장 자주 나온 문제는 "${r.topIssue}"입니다. 이 부분부터 고쳐 봅시다.`);
  else ps.push('기준을 벗어난 동작이 없었습니다.');
  ps.push(score>=90? '자세가 안정적입니다. 다음에는 횟수를 늘리거나 속도를 조금 늦춰 정확도를 유지해 보세요.'
    : score>=70? '한 가지만 고치면 됩니다. 위 내용을 생각하면서 한 세트 더 해 보고 다시 제출해 주세요.'
    : '급하게 횟수를 채우기보다 정확한 자세 3회를 먼저 만들어 봅시다. 다음 수업 때 한 번 더 같이 확인하겠습니다.');
  return ps.join('\n');
}

/* ===== 움직임 감지 (무궁화 꽃이 피었습니다 등) ===== */
export class MotionMeter {
  constructor(){ this.prev=null; this.value=0; this.acc=0; }
  reset(){ this.prev=null; this.value=0; this.acc=0; }
  /** 한 프레임의 움직임량(몸통 길이 대비). 전신 주요 관절 12개 평균 이동. */
  update(lm,W,H){
    if(!(lm&&lm.length>=33)){ this.prev=null; return 0; }
    const P=(i)=>({x:lm[i].x*W,y:lm[i].y*H});
    const torso=Math.hypot(P(11).x-P(23).x,P(11).y-P(23).y)||1;
    const keys=[0,11,12,13,14,15,16,23,24,25,26,27,28];
    const cur=keys.map(P);
    let m=0; if(this.prev){ for(let i=0;i<keys.length;i++){ m+=Math.hypot(cur[i].x-this.prev[i].x, cur[i].y-this.prev[i].y); } m=m/keys.length/torso; }
    this.prev=cur; this.value=this.value*0.5+m*0.5; return this.value;
  }
}
/** 여러 사람 좌표를 화면 왼쪽→오른쪽 순으로 정렬 (mirrored면 반대) */
export function sortPoses(poses, mirrored){ const arr=(poses||[]).filter(p=>p&&p.length>=33).map(p=>({p, x:(p[23].x+p[24].x)/2})); arr.sort((a,b)=>a.x-b.x); if(mirrored) arr.reverse(); return arr.map(a=>a.p); }
