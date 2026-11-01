const $=s=>document.querySelector(s);
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const empty='Not reported';
const S={data:null, theme:localStorage.getItem('antsu-theme')||'night', navOpen:false, motion:localStorage.getItem('antsu-motion')!=='paused', showActors:localStorage.getItem('antsu-actors')!=='hidden', preview:{}, tab:{}, profileData:{}, sprites:{}, refreshError:false, lastSnapshot:'', auth:false, loginRequired:false, busy:false, message:''};
const MACHINE_IDS=['mac01','mac02','bbm'];
const DEMO_STATUS=['working','resting','ceased'];
const SECTION_LABELS={building:'TOWER OVERVIEW',machines:'MACHINE FLOOR',agents:'AGENT DOSSIER',profiles:'MEMORY ARCHIVE',characters:'CHARACTER STUDIO'};
const STATUS_LABEL={working:'Working',resting:'Resting',ceased:'Ceased',communicating:'Communicating',unknown:'Unknown'};
const ANIMATION_STATES=['working','resting','ceased','unknown'];
// Collectors may still report communication; it has no separate animated pose.
const poseState=st=>st==='communicating'?'unknown':st;
const ACTION={
  gibreal01:{working:'Standing · holographic command screen',resting:'Cola + movie · heart icon',ceased:'Seated · head lowered',communicating:'No separate animation; neutral still pose.'},
  gibreal02:{working:'Pad in hand · adjusting glasses',resting:'Seated · reading holo screen',ceased:'Standing · bowed back · unlit eyes',communicating:'No separate animation; neutral still pose.'},
  gibreal03:{working:'Neural cable · holographic screen',resting:'Checking server infrastructure',ceased:'Kneeling · head lowered',communicating:'No separate animation; neutral still pose.'},
  muv01:{working:'Terminal · glowing halo · anger icon',resting:'Window call · ellipsis icon',ceased:'Asleep · ZZZ',communicating:'No separate animation; neutral still pose.'},
  gibreal04:{working:'Operating terminal · halo',resting:'Resting on the left office floor',ceased:'Seated · head lowered',communicating:'No separate animation; neutral still pose.'},
  gibreal05:{working:'Struggling at terminal · halo',resting:'On leader desk · heart icon',ceased:'Lying on floor',communicating:'No separate animation; neutral still pose.'},
  bbmango01:{working:'Carrying large box · sweat icon',resting:'Office chair · relaxed blinking',ceased:'Burned out · ghost icon',communicating:'No separate animation; neutral still pose.'},
  bbmango02:{working:'Checking paper files',resting:'Bored · gazing outside',ceased:'Face-down · glasses fallen',communicating:'No separate animation; neutral still pose.'},
  bbmango03:{working:'Facing holographic screen · drawing with stylus',resting:'Office chair · tablet · heart icon',ceased:'Office chair · eyes closed · purple forehead · ω smile and connected blood trickle',communicating:'No separate animation; neutral still pose.'}
};
const symbols={working:'✦',resting:'♡',ceased:'◌',communicating:'⇄',unknown:'·'};
const actorProps={working:'⌘',resting:'♡',ceased:'·',communicating:'↗',unknown:'?'};
const themeStorage=v=>{S.theme=v;localStorage.setItem('antsu-theme',v);document.body.dataset.sky=v;render();};
const fmt=(v,fallback=empty)=>{
  if(v===null||v===undefined||v==='')return fallback;
  if(Array.isArray(v))return v.length?escapeHTML(v.map(x=>typeof x==='object'?JSON.stringify(x):x).join(' · ')):'None';
  if(typeof v==='object')return escapeHTML(JSON.stringify(v));
  return escapeHTML(String(v));
};
const machine=id=>S.data.machines.find(m=>m.id===id);
const agent=id=>S.data.agents.find(a=>a.id===id);
const agentsOf=id=>S.data.agents.filter(a=>a.machine===id);
const demoStatus=a=>{const idx=S.data.agents.filter(x=>x.machine===a.machine).findIndex(x=>x.id===a.id);return DEMO_STATUS[idx%3];};
const agentStatus=a=>a.source!=='demo' ? a.status : (S.preview[a.id]||demoStatus(a));
const statusTag=(a)=>{const st=agentStatus(a);return `<span class="status status-${st}"><span class="status-led"></span>${STATUS_LABEL[st]}${a.source==='live'?'':a.source==='stale'?' · stale':' · preview'}</span>`;};
const navTo=path=>{location.hash=path;S.navOpen=false;window.scrollTo({top:0,behavior:'instant'});render();};
const route=()=>{const s=(location.hash||'#/building').slice(1).split('/').filter(Boolean);return {kind:s[0]||'building',id:s[1]||''};};
const toplink=(label,href)=>`<a class="crumb-link" href="#${href}">${escapeHTML(label)}</a>`;
const normLine=v=>v===undefined||v===null||v===''?'—':fmt(v);

const localAsset=path=>typeof path==='string'&&/^\/assets\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.includes('..');
const assetURL=path=>path.startsWith('/')?'.'+path:path;
function avatar(a,classes='nav-avatar'){
 const icon=S.sprites?.[a.id]?.icon;
 return `<span class="${classes} avatar-${a.machine} ${localAsset(icon)?'has-portrait':''}">${localAsset(icon)?`<img class="ui-portrait" src="${escapeHTML(assetURL(icon))}" alt="" loading="eager">`:escapeHTML(a.name.slice(-2))}</span>`;
}
function haloFigure(halo,index){
 const p=halo?.positions?.[index];
 if(!p||!localAsset(halo.src)||!Array.isArray(halo.crop)||halo.crop.length!==4)return '';
 if(![p.x,p.y,halo.width,halo.height,halo.imageWidth,halo.imageHeight,...halo.crop].every(Number.isFinite)||halo.width<=0||halo.height<=0)return '';
 return `<svg class="animation-halo" data-halo="${escapeHTML(halo.variant)}" x="${p.x}" y="${p.y}" width="${halo.width}" height="${halo.height}" viewBox="${halo.crop.join(' ')}" overflow="hidden" aria-hidden="true"><image href="${escapeHTML(assetURL(halo.src))}" width="${halo.imageWidth}" height="${halo.imageHeight}"/></svg>`;
}
function gibreal05Heart(p){
 return `<g class="resting-heart" transform="translate(${p.x+111} ${p.y+12})" aria-hidden="true"><path d="M0 4H4V0H10V4H14V0H20V4H24V12H20V16H16V20H12V24H8V20H4V16H0Z" fill="#e981a5" stroke="#6b344f" stroke-width="2"/><path d="M4 5H9V8H4Z" fill="#ffe1e9"/></g>`;
}
function muv01Cue(st,p){
 if(st==='working')return `<g class="muv-anger" transform="translate(${p.x+112} ${p.y+13})" fill="none" stroke="#ec7968" stroke-width="4" aria-hidden="true"><path d="M0 0H7V7M14 0H21V7M0 14H7V21M14 21V14H21"/></g>`;
 if(st==='resting')return `<g class="muv-ellipsis" transform="translate(${p.x+112} ${p.y+18})" fill="#e8f3fa" stroke="#354956" stroke-width="1" aria-hidden="true"><rect width="5" height="5"/><rect x="9" width="5" height="5"/><rect x="18" width="5" height="5"/></g>`;
 if(st==='ceased')return '<g class="muv-sleep" fill="none" stroke="#c8e9ff" stroke-width="6" stroke-linejoin="round" aria-hidden="true"><path d="M650 125H680L650 155H680M690 78H730L690 118H730M735 20H785L735 70H785"/></g>';
 return '';
}
function atlasFigure(a,st,sprite){
 const at=sprite.atlas;
 if(!at||!Array.isArray(at.frames)||![1,4,8].includes(at.frames.length))return '';
 const numbers=[at.width,at.height,at.canvasWidth,at.canvasHeight];
 if(numbers.some(n=>!Number.isFinite(n)||n<=0||n>8192))return '';
 const valid=at.frames.every(f=>[f.x,f.y,f.width,f.height,f.offsetX??0,f.offsetY??0].every(Number.isFinite)&&f.x>=0&&f.y>=0&&f.width>0&&f.height>0&&f.x+f.width<=at.width&&f.y+f.height<=at.height);
 if(!valid)return '';
 const frames=at.frames, fps=Math.max(1,Math.min(12,Number(sprite.fps)||3)),duration=frames.length/fps;
 // Individual frame viewports preserve alpha and avoid editing or resampling the source art.
 return `<svg class="actor-atlas ${frames.length===1||sprite.still?'atlas-static':'atlas-animated'} atlas-count-${frames.length} ${S.motion?'':'motion-paused'}" width="${at.canvasWidth}" height="${at.canvasHeight}" viewBox="0 0 ${at.canvasWidth} ${at.canvasHeight}" role="img" aria-label="${escapeHTML(a.name)} ${escapeHTML(st)} animation" style="--atlas-duration:${duration}s;--atlas-aspect:${at.canvasWidth}/${at.canvasHeight};--canvas-width:${at.canvasWidth}px;--canvas-height:${at.canvasHeight}px">
 ${frames.map((f,i)=>`<g class="atlas-frame atlas-frame-${i}" style="--frame-delay:${i===0?0:-(frames.length-i)/fps}s"><g${sprite.flipX===true?` transform="translate(${at.canvasWidth} 0) scale(-1 1)"`:''}><svg x="${f.offsetX||0}" y="${f.offsetY||0}" width="${f.width}" height="${f.height}" viewBox="${f.x} ${f.y} ${f.width} ${f.height}" overflow="hidden"><image href="${escapeHTML(assetURL(sprite.src))}" width="${at.width}" height="${at.height}"/></svg></g>${haloFigure(sprite.halo,i)}${a.id==='gibreal05'&&st==='resting'?gibreal05Heart(sprite.halo.positions[i]):''}${a.id==='muv01'?muv01Cue(st,sprite.halo?.positions[i]):''}</g>`).join('')}</svg>`;
}

function sidebar(){
  const cur=route();
  return `<aside aria-label="Main navigation" class="sidebar ${S.navOpen?'opened':''}">
    <a class="brand" href="#/building"><div class="brand-glyph">A<span>▟</span></div><div><b>ANTSU</b><small>MULTI-AGENT OPERATIONS</small></div></a>
    <div class="side-label">WORKSPACE</div>
    <a class="side-item ${cur.kind==='building'?'active':''}" href="#/building"><span class="ico">▦</span>Headquarters <span class="side-key">01</span></a>
    <div class="side-label extra">MACHINES <span>03</span></div>
    ${S.data.machines.map(m=>`<a class="side-item ${cur.kind==='machines'&&cur.id===m.id?'active':''}" href="#/machines/${m.id}"><span class="ico">${m.id==='bbm'?'▥':'▣'}</span>${escapeHTML(m.name)} <span class="tiny-floor">F${String(m.floor).padStart(2,'0')}</span></a>`).join('')}
    <div class="side-label extra">AGENTS <span>09</span></div>
    <label class="agent-search"><span>⌕</span><input id="agent-search" type="search" placeholder="Find an agent…" aria-label="Find an agent"></label><div class="agent-nav">${S.data.agents.map(a=>`<a class="side-item small ${cur.kind==='agents'&&cur.id===a.id?'active':''}" href="#/agents/${a.id}">${avatar(a)}<span>${escapeHTML(a.name)}</span>${a.isMain?'<span class="main-dot">●</span>':''}</a>`).join('')}</div>
    <div class="side-bottom"><div class="side-label">PIXEL WORLD / SKY</div><div class="theme-buttons"><button class="${S.theme==='day'?'chosen':''}" data-theme="day" aria-pressed="${S.theme==='day'}">☀ DAY</button><button class="${S.theme==='night'?'chosen':''}" data-theme="night" aria-pressed="${S.theme==='night'}">☾ NIGHT</button></div><small class="side-foot">ANTSU-UI01 <span>A/2 + BBMango02</span></small></div>
  </aside>`;
}
function header(){
  const r=route();const name=r.kind==='building'?'Building / all floors':r.kind==='machines'?`${machine(r.id)?.name||'Unknown'} / room`:r.kind==='agents'?`${agent(r.id)?.name||'Unknown'} / profile`:r.kind==='characters'?`${agent(r.id)?.name||'Unknown'} / animations`:`${agent(r.id)?.name||'Unknown'} / memory`;
  return `<header class="topbar"><button class="mobile-menu" id="menu-toggle" aria-label="Toggle navigation" aria-expanded="${S.navOpen}">☰</button><div class="breadcrumbs">${toplink('ANTSU','/building')}<span>/</span>${escapeHTML(SECTION_LABELS[r.kind]||'UNKNOWN')}<span>/</span><b>${escapeHTML(name)}</b></div><div class="top-actions"><span class="live-chip"><i class="live-dot"></i>${S.data.liveMachines} / 3 CONNECTED</span><span class="top-date" id="clock">--:--:-- JST</span>${S.loginRequired?'<button class="logout" id="logout" title="Sign out">↪</button>':''}</div></header>`;
}
function statbar(){return `<div class="statbar">
  <div><span>NETWORK</span><b>${S.data.liveMachines?`${S.data.liveMachines} CONNECTED`:'AWAITING REPORTS / OFFLINE'}</b></div>
  <div><span>MACHINES</span><b>03 <small>REGISTERED</small></b></div>
  <div><span>AGENTS</span><b>09 <small>REGISTERED</small></b></div>
  <div><span>SKY SIMULATION</span><b>${S.theme.toUpperCase()} MODE</b></div>
</div>`;}
function machineFacts(m){const t=m.telemetry||{};return `<div class="fact-rows">
  ${[['OpenClaw',t.openclawVersion],['Local LLM',t.localLLM],['Safety',t.safety],['Remote',t.remote],['Other AI',t.otherAI],['Cloud',t.cloud],['Tailscale',t.tailscale],['Memory',t.memorySystem],['Other plugins',t.otherPlugins]].map(([k,v])=>`<div><span>${escapeHTML(k)}</span><b>${fmt(v)}</b></div>`).join('')}
  </div>`;}
// Artwork landmarks are normalized coordinates shared by both day/night images.
// The painted facade is illustrative; roster floor numbers remain authoritative.
const BUILDING_LANDMARKS={mac01:{x:43.6,y:42.1},mac02:{x:57.2,y:26.3},bbm:{x:57.2,y:77.1}};
function tower(){
 return `<section class="world pixel-world ${S.theme} ${S.motion?'':'motion-paused'}" data-total-floors="${S.data.building.floors}" aria-label="ANTSU 51-floor headquarters, ${S.theme} pixel-art city">
  <img class="building-pixel-art" src="${assetURL(`/assets/scenes/building-pixel-${S.theme}-v1.png`)}" alt="ANTSU headquarters in a detailed pixel-art city, ${S.theme==='night'?'glowing windows, two moons and a planetary halo':'sunlit rooftops and distant spacecraft'}" width="1448" height="1086" fetchpriority="high">
  <div class="pixel-ambience" aria-hidden="true"><i class="roof-beacon"></i><i class="pixel-shuttle"></i><i class="water-glint glint-one"></i><i class="water-glint glint-two"></i><i class="water-glint glint-three"></i></div>
  ${S.data.machines.map(m=>{const pin=BUILDING_LANDMARKS[m.id];return `<a class="floor-marker marker-${m.id}" style="--pin-x:${pin.x}%;--pin-y:${pin.y}%" href="#/machines/${m.id}" aria-label="Open ${escapeHTML(m.name)} floor ${m.floor}"><span class="marker-node"></span><span class="marker-label"><small>F${String(m.floor).padStart(2,'0')} / ${escapeHTML(m.wing)}</small><b>${escapeHTML(m.name)} <em>↗</em></b></span><div class="marker-pop"><b>${escapeHTML(m.name)} / ${escapeHTML(m.label)}</b><span>${m.connection==='online'?'● ONLINE':m.connection==='offline'?'◌ OFFLINE':'◇ PREVIEW — NOT CONNECTED'}</span><span>${m.agents.map(id=>escapeHTML(agent(id).name)).join(' · ')}</span>${machineFacts(m)}<small>ENTER FLOOR ↗</small></div></a>`;}).join('')}
  <span class="art-caption">ANTSU DISTRICT <b>BUILDING ART / 01</b></span>
 </section>`;
}
function buildingPage(){
  return `<div class="page page-building"><div class="page-eyebrow"><span class="eyebrow-dot"></span> OPERATIONS / OVERVIEW</div><div class="page-title-row"><div><h1>Your agents. <span>One world.</span></h1><p>Welcome to ANTSU. A little city for everything your agents do.</p></div><div class="world-switch"><button data-theme="day" class="${S.theme==='day'?'chosen':''}" aria-pressed="${S.theme==='day'}">☀ Day</button><button data-theme="night" class="${S.theme==='night'?'chosen':''}" aria-pressed="${S.theme==='night'}">☾ Night</button></div></div>
  ${statbar()}<div class="building-layout"><div class="tower-panel"><div class="panel-title"><span>THE NEIGHBORHOOD</span><button class="motion-toggle" id="motion-toggle" aria-pressed="${S.motion}" aria-label="Ambient animation">${S.motion?'Ⅱ Pause motion':'▷ Play motion'}</button></div>${tower()}</div>
  <div class="tower-aside"><div class="panel-title"><span>FLOOR DIRECTORY</span><span class="muted">03 ROOMS</span></div>
    ${S.data.machines.map(m=>`<a href="#/machines/${m.id}" class="floor-card ${m.id}"><div class="floor-meta"><span>FLOOR ${String(m.floor).padStart(2,'0')} / ${escapeHTML(m.wing)}</span><span class="conn ${m.connection}">${m.connection==='online'?'● LIVE':m.connection==='offline'?'◌ OFFLINE':'◇ PREVIEW'}</span></div><h3>${escapeHTML(m.name)} <span>↗</span></h3><p>${escapeHTML(m.label)}</p><div class="mini-agents">${agentsOf(m.id).map(a=>`${avatar(a,'mini-avatar')}`).join('')}<small>${m.agents.length} AGENTS</small></div></a>`).join('')}
    <div class="info-box"><strong>A WORLD READY TO CONNECT</strong><p>Explore all three rooms now. Connect a collector on each Mac when you’re ready to bring the building to life.</p><a href="#/machines/mac01">ENTER MAC01 ↗</a></div>
  </div></div></div>`;
}
function actorFigure(a,st){
 st=poseState(st);
 const sprite=S.sprites?.[a.id]?.[st];
 const path=typeof sprite==='string'?sprite:sprite?.src;
 const valid=localAsset(path);
 if(valid){
  if(sprite.atlas){const figure=atlasFigure(a,st,sprite);if(figure)return figure;}
  if(typeof sprite==='object'&&Number.isInteger(sprite.frames)&&sprite.frames>1&&sprite.frames<=64){
   const frames=sprite.frames, fps=Math.max(1,Math.min(30,Number(sprite.fps)||6));
   return `<span role="img" aria-label="${escapeHTML(a.name)} ${escapeHTML(st)}" class="actor-sheet" style="--sheet:url('${assetURL(path)}');--frames:${frames};--last-frame:${(frames-1)*112}px;--duration:${frames/fps}s"></span>`;
  }
  return `<img class="actor-sprite" src="${escapeHTML(assetURL(path))}" alt="${escapeHTML(a.name)} ${escapeHTML(st)} sprite">`;
 }
 return `<div class="actor-figure actor-${a.id} state-${st}" aria-hidden="true"><span class="actor-halo"></span><span class="actor-head"></span><span class="actor-body"></span><span class="actor-arm arm-left"></span><span class="actor-arm arm-right"></span><span class="actor-leg leg-left"></span><span class="actor-leg leg-right"></span><span class="actor-prop">${actorProps[st]}</span></div>`;
}
const ROOM_SLOTS={
 server:[{x:24,y:79},{x:50,y:70},{x:79,y:79}],
 office:[{x:50,y:59},{x:24,y:83},{x:78,y:83}],
 mango:[{x:24,y:51},{x:50,y:51},{x:77,y:51}]
};
// Coordinates follow the 1536×1024 room artwork, with feet as the anchor.
// These floor rectangles exclude furniture. Inset sampling also reserves a
// footprint around the shoes, so a sprite cannot land at a desk/chair edge.
const BBM_FLOOR_AREAS=[
 {id:'front-floor',left:30,right:61,top:84,bottom:94,width:21},
 {id:'rear-aisle',left:29,right:44,top:45.8,bottom:49.5,width:16}
];
const BBM_CHAIR={x:23.8,y:44.35,width:17.5,mode:'seated',area:'assigned-chair'};
const BBM03_FLOOR_AREAS=[
 {id:'front-right-floor',left:70,right:89,top:84,bottom:94,width:21},
 {id:'right-aisle',left:57,right:72,top:45.8,bottom:49.5,width:16}
];
function mangoChair(id,st){
 return id==='bbmango03'?{x:77.1,y:43.4,width:17.5,mode:'seated',area:'assigned-chair'}:{...BBM_CHAIR};
}
// BBMango02 uses the middle rear chair. Hip placement is shared by room and studio.
function bbmango02Chair(){
 const at=S.sprites.bbmango02.working.atlas,width=18,scale=1536*width/100/at.canvasWidth;
 const hip={x:160,y:260};
 return {x:(780+(at.canvasWidth/2-hip.x)*scale)/15.36,y:(388+(at.canvasHeight*.97-hip.y)*scale)/10.24,width,mode:'seated',area:'mango-center-chair'};
}
const GIBREAL01_CHAIR={x:21.4,y:62.6,width:16,mode:'seated',area:'mac01-left-chair'};
// Match the head scale at each camera depth; seat the pelvis on the center cushion.
const GIBREAL02_WORKING_WIDTH=21*128/147;
const GIBREAL02_REST_WIDTH=1.05*1.05*1.05*16*128/147;
const GIBREAL02_REST_SCALE=1536*GIBREAL02_REST_WIDTH/100/344;
const GIBREAL02_CHAIR={x:(768+(172-163)*GIBREAL02_REST_SCALE)/1536*100,y:(565+(344*.97-252)*GIBREAL02_REST_SCALE)/1024*100,width:GIBREAL02_REST_WIDTH,mode:'seated',area:'mac01-center-chair'};
// Normalize character scale by head width in the source art, excluding
// long hair, halo, props and the different standing/seated silhouettes.
const GIBREAL_HEAD_WIDTH={gibreal01Working:128,gibreal03Working:128,gibreal03Resting:120,gibreal03Ceased:300};
const GIBREAL01_WORKING_WIDTH=21;
// The standing source pose is compressed relative to the seated source.
// Give it a taller display scale while keeping the feet anchored in place.
const GIBREAL03_REST_RATIO=0.9*1.35*GIBREAL_HEAD_WIDTH.gibreal03Working/GIBREAL_HEAD_WIDTH.gibreal03Resting;
const GIBREAL03_CEASED_RATIO=0.9*GIBREAL_HEAD_WIDTH.gibreal01Working/GIBREAL_HEAD_WIDTH.gibreal03Ceased;
const GIBREAL03_CHAIR_WIDTH=16;
const GIBREAL03_CHAIR_SCALE=1536*GIBREAL03_CHAIR_WIDTH/100/360;
const GIBREAL03_CHAIR={x:(1229-40*GIBREAL03_CHAIR_SCALE)/1536*100,y:(560+(360*.97-278)*GIBREAL03_CHAIR_SCALE)/1024*100,width:GIBREAL03_CHAIR_WIDTH,mode:'seated',area:'mac01-right-chair'};
// All coordinates use the room's native 1536 x 1024 artwork. The sprite's
// seated hip (220, 278) meets the chair cushion at approximately (1229, 560).
function gibreal03Connection(){
 const seat=GIBREAL03_CHAIR,at=S.sprites.gibreal03?.working?.atlas;
 if(!at)return '';
 const width=1536*seat.width/100,scale=width/at.canvasWidth;
 const x=1536*seat.x/100-width/2,y=1024*seat.y/100-at.canvasHeight*scale*.97;
 // Start underneath the existing cable tip in every frame; the other end
 // terminates in a visible socket on the right-hand server rack.
 const tipX=x+300*scale,tipY=y+220*scale;
 const wire=`M ${tipX} ${tipY} L 1320 ${tipY} Q 1350 ${tipY} 1350 553 L 1350 572 Q 1350 592 1370 592 L 1390 592 Q 1410 592 1410 572 L 1410 488 Q 1410 468 1430 468 L 1450 468`;
 return `<g class="neural-server-connection" data-server-port="1450,468" fill="none" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="${wire}" stroke="#080e1d" stroke-width="12"/><path d="${wire}" stroke="#34495d" stroke-width="7"/><path d="${wire}" stroke="#56849c" stroke-width="2"/><rect x="1438" y="454" width="25" height="28" rx="3" fill="#101b2b" stroke="#728b9b" stroke-width="3"/><rect x="1443" y="461" width="16" height="14" fill="#48cce7" stroke="#152b42" stroke-width="3"/><path d="M 1428 468 L 1447 468" stroke="#263e50" stroke-width="9"/><path d="M 1435 465 L 1442 465" stroke="#a2f6ff" stroke-width="3"/></g>`;
}
const roomPositions=new Map();
// Static poses share the approved action sprites' compact body proportions.
// Hip anchors keep all eight seated frames attached to the actual furniture.
function gibreal05Seat(width,hipX,hipY,roomX,roomY,area){
 const scale=1536*width/100/344;
 return {x:(roomX+(172-hipX)*scale)/15.36,y:(roomY+(344*.97-hipY)*scale)/10.24,width,mode:'seated',area};
}
const GIBREAL05_CHAIR=gibreal05Seat(18,210,260,1320,690,'mac02-right-chair');
const GIBREAL05_DESK=gibreal05Seat(17,172,250,930,390,'mac02-leader-desk');
const MUV01_CHAIR_SCALE=1536*.17/887;
const MUV01_CHAIR={x:(768+(887/2-530)*MUV01_CHAIR_SCALE)/15.36,y:(346+(887*.97-630)*MUV01_CHAIR_SCALE)/10.24,width:17,mode:'seated',area:'mac02-leader-chair'};
function muv01DeskForeground(key){
 // Only the central desk/monitor covers the leader. The right desk edge stays
 // clear for GibReaL05's independently rendered resting pose.
 return `<defs><clipPath id="leader-desk-${key}"><path d="M640 380H667V304H744V347H792V380H840V480H640Z"/></clipPath></defs><g clip-path="url(#leader-desk-${key})"><image href="${assetURL('/assets/scenes/room-office-pixel-v1.png')}" width="1536" height="1024"/></g>`;
}
const GIBREAL04_STATIC_WIDTH=18.5;
const GIBREAL04_CHAIR_SCALE=1536*GIBREAL04_STATIC_WIDTH/100/887;
const GIBREAL04_CHAIR={x:(213+(887/2-610)*GIBREAL04_CHAIR_SCALE)/1536*100,y:(690+(887*.97-646)*GIBREAL04_CHAIR_SCALE)/1024*100,width:GIBREAL04_STATIC_WIDTH,mode:'seated',area:'mac02-left-chair'};
const GIBREAL04_REST_AREA={left:22,right:40,top:83,bottom:94};
const GIBREAL_FLOOR_AREAS=[
 {id:'mac01-left-aisle',left:18,right:39,top:70,bottom:94},
 {id:'mac01-center-aisle',left:42,right:66,top:70,bottom:94}
];
function gibrealStandingPlacement(a,st,random){
 const previous=roomPositions.get(a.id);
 if(previous?.state===st&&previous.mode==='standing')return previous;
 const other=roomPositions.get(a.id==='gibreal01'?'gibreal02':'gibreal01');
 // Reserve both horizontal space for heads/props and a distinct camera depth.
 const clear=p=>other?.mode!=='standing'||(Math.abs(p.x-other.x)>=18&&Math.abs(p.y-other.y)>=6);
 let position;
 for(let attempt=0;attempt<24;attempt++){
  const area=GIBREAL_FLOOR_AREAS[Math.min(1,Math.floor(random()*2))];
  const candidate={x:area.left+4+random()*(area.right-area.left-8),y:area.top+1.2+random()*(area.bottom-area.top-2.4),area:area.id};
  if(clear(candidate)){position=candidate;break;}
 }
 // A bounded fallback also handles deterministic/random sources at an edge.
 if(!position)for(const x of [24,33,48,60]){
  for(const y of [71.2,82,92.8])if(clear({x,y})){
   position={x,y,area:x<40?'mac01-left-aisle':'mac01-center-aisle'};break;
  }
  if(position)break;
 }
 const baseWidth=a.id==='gibreal01'?GIBREAL01_WORKING_WIDTH:st==='working'?GIBREAL02_WORKING_WIDTH:GIBREAL02_WORKING_WIDTH*1200/344*147/453;
 const depthScale=.9+(position.y-70)/24*.2;
 const result={...position,width:baseWidth*depthScale,mode:'standing',state:st};
 roomPositions.set(a.id,result);
 return result;
}
function roomPlacement(m,a,index,st,random=Math.random){
 if(a.id==='bbmango02'&&m.room==='mango'){
  if(st==='working')return bbmango02Chair();
  if(st==='resting')return {x:60.5,y:46,width:18,mode:'standing',area:'mango-window-aisle'};
  if(st==='ceased')return {x:57,y:95,width:30,mode:'ground',area:'mango-front-center-floor'};
  return {x:50.5,y:49,width:23,mode:'standing',area:'mango-middle-aisle'};
 }
 if(a.id==='muv01'&&m.room==='office'){
  if(st==='ceased')return {...MUV01_CHAIR};
  if(st==='resting')return {x:31,y:42,width:15.5,mode:'standing',area:'mac02-window'};
  if(st==='working')return {x:75,y:49,width:18,mode:'standing',area:'mac02-right-of-leader-desk'};
  return {x:49,y:67,width:21,mode:'standing',area:'mac02-command-floor'};
 }
 if(a.id==='gibreal05'&&m.room==='office'){
  if(st==='working')return {...GIBREAL05_CHAIR};
  if(st==='resting')return {...GIBREAL05_DESK};
  return {x:73,y:90,width:24,mode:st==='ceased'?'ground':'standing',area:'mac02-right-open-floor'};
 }
 if(a.id==='gibreal04'&&m.room==='office'){
  const previous=roomPositions.get(a.id);
  if(previous?.state===st)return previous;
  let position;
  if(st==='resting'){
   const area=GIBREAL04_REST_AREA;
   position={x:area.left+random()*(area.right-area.left),y:area.top+random()*(area.bottom-area.top),width:20,mode:'standing',area:'mac02-left-open-floor'};
  }else if(st==='ceased')position={...GIBREAL04_CHAIR};
  else position={x:26,y:78,width:st==='working'?20:GIBREAL04_STATIC_WIDTH,mode:'standing',area:'mac02-left-terminal'};
  const result={...position,state:st};
  roomPositions.set(a.id,result);
  return result;
 }
 if(['gibreal01','gibreal02'].includes(a.id)&&m.room==='server'){
  const seated=st==='resting'||(a.id==='gibreal01'&&st==='ceased');
  if(seated){
   const seat=a.id==='gibreal01'?GIBREAL01_CHAIR:GIBREAL02_CHAIR;
   roomPositions.set(a.id,{...seat,state:st});
   return {...seat};
  }
  return gibrealStandingPlacement(a,st,random);
 }
 if(a.id==='gibreal03'&&m.room==='server'){
  if(st==='working')return {...GIBREAL03_CHAIR};
  if(st==='resting')return {x:87,y:69,width:GIBREAL03_CHAIR_WIDTH*GIBREAL03_REST_RATIO,mode:'standing',area:'mac01-right-rack'};
  return {x:77,y:84,width:st==='ceased'?GIBREAL01_WORKING_WIDTH*1000/344*GIBREAL03_CEASED_RATIO:21,mode:st==='ceased'?'ground':'standing',area:'mac01-front-right-floor'};
 }
 if(!['bbmango01','bbmango03'].includes(a.id)||m.room!=='mango')return {...ROOM_SLOTS[m.room][index],mode:'fixed'};
 const seated=st==='resting'||st==='ceased';
 const previous=roomPositions.get(a.id);
 const archiveState=poseState(agentStatus(agent('bbmango02')));
 const blocked=previous?.mode==='standing'&&((a.id==='bbmango03'&&archiveState==='resting'&&previous.area==='right-aisle')||(a.id==='bbmango01'&&archiveState==='ceased'&&previous.area==='front-floor'&&previous.x>41));
 if(previous?.state===st&&!blocked)return previous;
 let position;
 if(seated)position=mangoChair(a.id,st);
 else{
  // Reserve BBMango02's window aisle and the floor around her fallen glasses.
  const areas=(a.id==='bbmango03'?BBM03_FLOOR_AREAS:BBM_FLOOR_AREAS)
   .filter(area=>!(a.id==='bbmango03'&&archiveState==='resting'&&area.id==='right-aisle'))
   .map(area=>a.id==='bbmango01'&&archiveState==='ceased'&&area.id==='front-floor'?{...area,right:45}:area);
  const area=areas[Math.floor(random()*areas.length)];
  const insetX=4,insetY=1.2;
  position={x:area.left+insetX+random()*(area.right-area.left-2*insetX),
   y:area.top+insetY+random()*(area.bottom-area.top-2*insetY),
   width:area.width*(a.id==='bbmango03'&&st==='working'?360/320:1),mode:'standing',area:area.id};
 }
 const result={...position,state:st};
 roomPositions.set(a.id,result);
 return result;
}
const ROOM_EFFECTS={
 server:'<i class="rack-led rack-led-a"></i><i class="rack-led rack-led-b"></i><i class="hologram-sweep"></i><i class="console-cursor"></i>',
 office:'<i class="terminal-light terminal-left"></i><i class="terminal-light terminal-right"></i><i class="window-dust dust-a"></i><i class="window-dust dust-b"></i><i class="window-dust dust-c"></i>',
 mango:'<i class="window-dust dust-a"></i><i class="window-dust dust-b"></i><i class="window-dust dust-c"></i><i class="mango-terminal"></i>'
};
function roomScene(m){
 return `<div class="room-scene pixel-room room-${m.room} ${S.motion?'':'motion-paused'} ${S.showActors?'':'actors-hidden'}"><img class="room-art" src="${assetURL(`/assets/scenes/room-${m.room}-pixel-v1.png`)}" alt="${escapeHTML(m.label)}: ${m.room==='server'?'blue circuit lighting, server racks and three consoles':m.room==='office'?'warm white office, three desks, cabinets and panoramic window':'mango walls, wooden floor, five desks and plants'}" width="1536" height="1024">
 <div class="room-ambience" aria-hidden="true">${ROOM_EFFECTS[m.room]}</div>
 ${m.id==='mac01'&&agentStatus(agent('gibreal03'))==='working'?`<svg class="room-neural-link" viewBox="0 0 1536 1024" aria-hidden="true">${gibreal03Connection()}</svg>`:''}
 ${agentsOf(m.id).map((a,i)=>{const st=agentStatus(a),slot=roomPlacement(m,a,i,st),placed=slot.mode!=='fixed';const caption=`<b>${escapeHTML(a.name)}</b><small>${STATUS_LABEL[st].toUpperCase()} · ${a.source==='live'?'LIVE':a.source==='stale'?'STALE':'PREVIEW'}</small>`;return `<a href="#/agents/${a.id}" class="scene-agent scene-agent-${i+1} scene-${poseState(st)} ${S.sprites?.[a.id]?.[poseState(st)]?'custom-agent':'prototype-agent'} ${placed?`placed-agent ${slot.mode}-agent`:''}" style="--agent-x:${slot.x}%;--agent-y:${slot.y}%;${placed?`--actor-width:${slot.width}cqw;`:''}" data-placement="${slot.area||'fixed'}" aria-label="Open ${escapeHTML(a.name)} dossier">${S.sprites?.[a.id]?.[poseState(st)]?'':`<div class="agent-signal">${symbols[st]}</div>`}${actorFigure(a,st)}${placed?`<span class="agent-caption">${caption}</span>`:caption}</a>`;}).join('')}
 ${m.id==='mac02'&&agentStatus(agent('muv01'))==='ceased'?`<svg class="room-leader-foreground" viewBox="0 0 1536 1024" aria-hidden="true">${muv01DeskForeground('room')}</svg>`:''}
 <div class="scene-overlay">F${String(m.floor).padStart(2,'0')} / ${escapeHTML(m.name.toUpperCase())}<span>${agentsOf(m.id).length} AGENT AVATARS</span></div></div>`;
}
function roomPage(m){
 const a=agentsOf(m.id);return `<div class="page room-page"><div class="page-eyebrow">02 / FLOOR ${String(m.floor).padStart(2,'0')} / ${escapeHTML(m.name.toUpperCase())}</div><div class="page-title-row"><div><h1>${escapeHTML(m.name)} <span>· ${escapeHTML(m.label)}</span></h1><p>A pixel-art workspace for ${a.length} agents. Select an agent to open their dossier.</p></div><span class="pill-outline">${m.connection==='online'?'● NODE CONNECTED':m.connection==='offline'?'◌ NODE OFFLINE':'◇ PREVIEW ENVIRONMENT'}</span></div>
 <div class="room-grid"><div class="room-main"><div class="panel-title"><span>◈ ${escapeHTML(m.name.toUpperCase())} / PIXEL ROOM</span><div class="scene-tools"><button class="motion-toggle" id="actors-toggle" aria-pressed="${S.showActors}" aria-label="Character avatars">${S.showActors?'Hide avatars':'Show avatars'}</button><button class="motion-toggle" id="motion-toggle" aria-pressed="${S.motion}" aria-label="Ambient animation">${S.motion?'Ⅱ Pause motion':'▷ Play motion'}</button></div></div>${roomScene(m)}<div class="room-caption">Original room art · Ambient effects are decorative · All nine agent avatars have custom sprites and portraits.</div></div>
 <div class="machine-side"><div class="panel-title"><span>▣ MACHINE STATUS</span><span class="conn ${m.connection}">${m.connection.toUpperCase()}</span></div><div class="machine-details">${machineFacts(m)}<div class="machine-metrics"><div><span>HOST</span><b>${fmt(m.telemetry.hostname)}</b></div><div><span>MEMORY USED</span><b>${m.telemetry.memoryUsedPercent===undefined?'—':`${fmt(m.telemetry.memoryUsedPercent)}%`}</b></div><div><span>LAST CONTACT</span><b>${m.lastSeen?new Date(m.lastSeen).toLocaleTimeString('en-GB',{timeZone:'Asia/Tokyo'})+' JST':'NEVER'}</b></div></div></div></div></div>
 <div class="section-heading"><div><h2>Room personnel</h2><p>Choose a status in preview mode to inspect the future animation mapping.</p></div></div>
 <div class="personnel-grid">${a.map(x=>`<div class="personnel-card"><div class="personnel-heading"><a href="#/agents/${x.id}">${avatar(x,'p-avatar')}<span><b>${escapeHTML(x.name)}</b><small>${escapeHTML(x.position)}</small></span></a>${statusTag(x)}</div><p>${escapeHTML(ACTION[x.id]?.[agentStatus(x)]||'No scene mapping')}</p>${S.sprites?.[x.id]?.icon?`<a class="sprite-studio-link" href="#/characters/${x.id}">View animation study ↗</a>`:''}<div class="state-controls" role="group" aria-label="Preview ${escapeHTML(x.name)} state">${ANIMATION_STATES.map(st=>`<button data-preview-id="${x.id}" data-preview-status="${st}" ${x.source!=='demo'?'disabled title="Status controlled by collector"':''} aria-pressed="${agentStatus(x)===st}" class="${agentStatus(x)===st?'selected':''}">${escapeHTML(st)}</button>`).join('')}</div></div>`).join('')}</div></div>`;
}
const chips=v=>Array.isArray(v)?v.length?v.map(t=>`<span class="square-chip">${fmt(typeof t==='object'?JSON.stringify(t):t)}</span>`).join(''):'<span class="placeholder">None reported</span>':`<span class="placeholder">Awaiting collector data</span>`;
const panel=(title,icon,contents,extra='')=>`<section class="detail-panel"><div class="detail-panel-heading"><span>${icon} ${escapeHTML(title)}</span>${extra}</div><div class="detail-panel-body">${contents}</div></section>`;
function fieldRows(rows){return `<div class="detail-rows">${rows.map(([l,v])=>`<div><span>${escapeHTML(l)}</span><strong>${fmt(v)}</strong></div>`).join('')}</div>`;}
function agentPage(a){
 const m=machine(a.machine),st=agentStatus(a); const sessions=Array.isArray(a.sessions)?a.sessions:[];
 return `<div class="page agent-page"><div class="page-eyebrow">03 / INDIVIDUAL AGENT RECORD</div><div class="agent-hero"><div><span class="minor-serial">ANTSU / ${escapeHTML(m.name.toUpperCase())} / F${m.floor}</span><h1>${escapeHTML(a.name)}</h1><p>${escapeHTML(a.duty||'Duty not configured')}</p><div class="hero-tags">${statusTag(a)}<span class="square-chip">${escapeHTML(m.name)}</span>${a.isMain?'<span class="square-chip highlight">MAIN AGENT</span>':''}${S.sprites?.[a.id]?.icon?`<a class="square-chip" href="#/characters/${a.id}">ANIMATION STUDIO ↗</a>`:''}</div></div><div class="hero-avatar ${localAsset(S.sprites?.[a.id]?.icon)?'portrait-hero':''}"><span>${S.sprites?.[a.id]?.icon?'AGENT PORTRAIT':'AGENT FIGURE'}</span>${localAsset(S.sprites?.[a.id]?.icon)?avatar(a,'hero-portrait'):actorFigure(a,st)}<small>${S.sprites?.[a.id]?.icon?'PIXEL ART / STUDY 01':'PROTOTYPE / REPLACEABLE'}</small></div></div>
 <div class="agent-section-title"><h2>Current sessions</h2><span class="muted">${sessions.length} REPORTED</span></div><div class="sessions-row">${sessions.length?sessions.slice(0,16).map((s,i)=>`<div class="session-tile"><span>SESSION ${String(i+1).padStart(2,'0')}</span><b>${fmt(s.label||s.id||s)}</b><small>${fmt(s.status,'Active / unknown')}</small></div>`).join(''):'<div class="session-tile empty-session"><span>NO LIVE SESSION FEED</span><b>◇</b><small>Ready for event adapter</small></div>'}</div>
 <div class="detail-grid">
 ${panel('Current job / responsibility','◈',fieldRows([['Current job',a.currentJob],['Duty',a.duty],['Role',a.position],['Activity',st],['Status detail',a.statusDetail]]))}
 ${panel('Sandbox settings','▧',fieldRows([['Folder access',a.sandbox?.folders],['Mode',a.sandbox?.mode],['Workspace',a.sandbox?.workspace]]))}
 ${panel('Authorities','◇',chips(a.authorities))}
 ${panel('Skills & skill packages','⬡',`<h4>SKILLS</h4><div class="chip-wrap">${chips(a.skills)}</div><h4>PACKAGES</h4><div class="chip-wrap">${chips(a.skillPackages)}</div>`)}
 ${panel('Plugins & capabilities','▣',`<h4>PLUGINS</h4><div class="chip-wrap">${chips(a.plugins)}</div><h4>CAPABILITIES</h4><div class="chip-wrap">${chips(a.capabilities)}</div>`)}
 ${panel('Available LLM models','◉',`<div class="chip-wrap">${chips(a.models)}</div>`)}
 ${panel('Heartbeats & cron missions','◷',`<h4>HEARTBEATS</h4><div class="chip-wrap">${chips(a.heartbeats)}</div><h4>CRON TASKS</h4><div class="chip-wrap">${chips(a.cron)}</div>`)}
 ${panel('User information & channels','⇄',fieldRows([['User info',a.userInfo],['Channels',a.channels]]))}
 ${panel('Memory & characteristics','✧',`<p class="detail-note">Read-only SOUL.md, AGENTS.md, local memory, and optional MemOS. Sensitive content is never collected by default.</p><a class="action-link" href="#/profiles/${a.id}">OPEN MEMORY ARCHIVE <span>↗</span></a>`,'<span class="muted">PAGE 5</span>')}
 </div></div>`;
}
function profilePage(a){
 const tabs=['SOUL.md','AGENTS.md','MEMORY.md','MemOS'];const tab=S.tab[a.id]||tabs[0];
 const cloud=typeof loadProfile==='function',profile=S.profileData[a.id],entry=tab==='MemOS'?profile?.memOS:profile?.documents?.[tab];
 const hasDoc=entry?.state==='available'||(!cloud&&(tab==='MemOS'?a.memOS!=null:typeof a.docs?.[tab]==='string'));
 const content=cloud?(entry?.state==='available'?entry.text:entry?.state==='oversize'?'Source exceeds the configured upload limit.':entry?.state==='missing'?'Source file not found.':entry?.state==='unavailable'?'Source is not connected or cannot be read.':profile?.error||'Enter the separate profile access key to load this archive.'):(tab==='MemOS'?(a.memOS==null?'MemOS adapter not connected.':typeof a.memOS==='string'?a.memOS:JSON.stringify(a.memOS,null,2)):(a.docs?.[tab]??'Document not available in this local preview.'));
 return `<div class="page memory-page"><div class="page-eyebrow">05 / CHARACTERISTICS & MEMORY</div><div class="page-title-row"><div><h1>${escapeHTML(a.name)} <span>· Memory archive</span></h1><p>Read-only source documents. Nothing on this page edits the agent.</p></div><a class="pill-outline" href="#/agents/${a.id}">← RETURN TO DOSSIER</a></div>
 <div class="memory-panel"><div class="memory-meta"><span>ARCHIVE / ${escapeHTML(a.id.toUpperCase())}</span><span class="conn ${hasDoc?'online':'demo'}">${hasDoc?'● DOCUMENT LOADED':'◇ NOT CONNECTED'}</span></div>${cloud&&!profile?.documents?`<form id="profile-key-form" data-agent-id="${a.id}"><label>PROFILE ACCESS KEY <input type="password" name="profileKey" autocomplete="off" required></label><button type="submit">LOAD ARCHIVE</button></form>`:''}<div class="memory-tabs">${tabs.map(t=>`<button class="${tab===t?'active':''}" data-memory-tab="${escapeHTML(t)}" data-agent-id="${a.id}">${escapeHTML(t)}</button>`).join('')}</div><pre class="memory-content" id="memory-content">${escapeHTML(content)}</pre></div>
 <div class="info-box memory-warning"><strong>DATA ACCESS POLICY</strong><p>Only explicitly configured agent files are synchronized. The profile requires a separate access key; MemOS remains unavailable until its read-only adapter is connected. Do not place credentials in profile source files.</p></div></div>`;
}
function characterStage(a,st){
 if(a.id==='bbmango02'){
  const slot=roomPlacement(machine(a.machine),a,1,st),at=S.sprites[a.id][st].atlas;
  const scale=1536*slot.width/100/at.canvasWidth,x=slot.x*15.36-at.canvasWidth*scale/2,y=slot.y*10.24-at.canvasHeight*scale*.97;
  const view=st==='working'?'565 140 430 420':st==='resting'?'730 135 470 420':st==='ceased'?'590 550 600 470':'540 160 470 420';
  return `<div class="animation-stage seat-preview"><svg class="seat-preview-scene" viewBox="${view}" role="img" aria-label="BBMango02 ${st} in the Mango office"><image href="${assetURL('/assets/scenes/room-mango-pixel-v1.png')}" width="1536" height="1024"/><g transform="translate(${x} ${y}) scale(${scale})">${actorFigure(a,st)}</g></svg></div>`;
 }
 if(a.id==='muv01'&&['resting','ceased'].includes(st)){
  const slot=roomPlacement({room:'office'},a,0,st),at=S.sprites.muv01[st].atlas;
  const scale=1536*slot.width/100/at.canvasWidth,x=slot.x*15.36-at.canvasWidth*scale/2,y=slot.y*10.24-at.canvasHeight*scale*.97;
  return `<div class="animation-stage seat-preview"><svg class="seat-preview-scene" viewBox="${st==='resting'?'300 110 440 400':'540 110 440 400'}" role="img" aria-label="Muv01 ${st==='resting'?'calling by the Mac02 window':'sleeping in the Mac02 leader chair'}"><image href="${assetURL('/assets/scenes/room-office-pixel-v1.png')}" width="1536" height="1024"/><g transform="translate(${x} ${y}) scale(${scale})">${actorFigure(a,st)}</g>${st==='ceased'?muv01DeskForeground('studio'):''}</svg></div>`;
 }
 if(a.id==='gibreal05'&&['working','resting'].includes(st)){
  const slot=st==='working'?GIBREAL05_CHAIR:GIBREAL05_DESK,at=S.sprites.gibreal05[st].atlas;
  const scale=1536*slot.width/100/at.canvasWidth,x=slot.x*15.36-at.canvasWidth*scale/2,y=slot.y*10.24-at.canvasHeight*scale*.97;
  return `<div class="animation-stage seat-preview"><svg class="seat-preview-scene" viewBox="${st==='working'?'1035 400 500 440':'650 120 500 440'}" role="img" aria-label="GibReaL05 ${st==='working'?'working on the Mac02 right chair':'resting on the Mac02 leader desk'}"><image href="${assetURL('/assets/scenes/room-office-pixel-v1.png')}" width="1536" height="1024"/><g transform="translate(${x} ${y}) scale(${scale})">${actorFigure(a,st)}</g></svg></div>`;
 }
 if(a.id==='gibreal04'&&st==='ceased'){
  const slot=GIBREAL04_CHAIR,at=S.sprites.gibreal04[st].atlas;
  const scale=1536*slot.width/100/at.canvasWidth,x=slot.x*15.36-at.canvasWidth*scale/2,y=slot.y*10.24-at.canvasHeight*scale*.97;
  return `<div class="animation-stage seat-preview"><svg class="seat-preview-scene" viewBox="20 420 510 440" role="img" aria-label="GibReaL04 seated with her head lowered in Mac02"><image href="${assetURL('/assets/scenes/room-office-pixel-v1.png')}" width="1536" height="1024"/><g transform="translate(${x} ${y}) scale(${scale})">${actorFigure(a,st)}</g></svg></div>`;
 }
 if(a.id==='gibreal03'&&st==='resting'){
  // Same camera viewport, with the full standing pose visibly taller.
  const scale=GIBREAL03_CHAIR_SCALE*GIBREAL03_REST_RATIO;
  return `<div class="animation-stage"><svg class="pose-preview-scene matched-working-view" viewBox="0 0 505 445" role="img" aria-label="GibReaL03 resting standing pose"><g transform="translate(${252.5-180*scale} ${390-335*scale}) scale(${scale})">${actorFigure(a,st)}</g></svg></div>`;
 }
 if(a.id==='gibreal03'&&st==='ceased'){
  // Same 208px / 344-unit studio viewport as GibReaL01 working.
  const scale=GIBREAL03_CEASED_RATIO;
  return `<div class="animation-stage"><svg class="pose-preview-scene matched-gibreal01-view" viewBox="0 0 344 344" role="img" aria-label="GibReaL03 ceased at GibReaL01 working character scale"><g transform="translate(${172-510*scale} ${330-940*scale}) scale(${scale})">${actorFigure(a,st)}</g></svg></div>`;
 }
 const neural=a.id==='gibreal03'&&st==='working';
 const research=a.id==='gibreal02'&&st==='resting';
 if(!research&&!neural&&(!['bbmango03','gibreal01'].includes(a.id)||!['resting','ceased'].includes(st)))return `<div class="animation-stage">${actorFigure(a,st)}</div>`;
 const server=a.id==='gibreal01'||neural||research;
 const seat=research?GIBREAL02_CHAIR:neural?GIBREAL03_CHAIR:server?GIBREAL01_CHAIR:mangoChair(a.id,st),at=S.sprites[a.id][st].atlas;
 const width=1536*seat.width/100,scale=width/at.canvasWidth;
 const x=1536*seat.x/100-width/2,y=1024*seat.y/100-at.canvasHeight*scale*.97;
 return `<div class="animation-stage seat-preview"><svg class="seat-preview-scene" viewBox="${research?'550 300 440 420':neural?'995 255 505 445':server?'100 300 440 420':'980 140 410 420'}" role="img" aria-label="${escapeHTML(a.name)} ${st} on her office chair"><image href="${assetURL(`/assets/scenes/room-${server?'server':'mango'}-pixel-v1.png`)}" width="1536" height="1024"/>${neural?gibreal03Connection():''}<g transform="translate(${x} ${y}) scale(${scale})">${actorFigure(a,st)}</g></svg></div>`;
}
function characterPage(a){
 const states=ANIMATION_STATES;
 return `<div class="page character-page"><div class="page-eyebrow">CHARACTER ART / STUDY 01</div><div class="page-title-row"><div><h1>${escapeHTML(a.name)} <span>· Animation studio</span></h1><p>Reference-based pixel art · Eight-frame action loops · Preview only</p></div><a class="pill-outline" href="#/machines/${a.machine}">← BACK TO ROOM</a></div>
 <div class="character-toolbar"><div><strong>${escapeHTML(S.sprites[a.id].label||a.name)}</strong><p>${escapeHTML(S.sprites[a.id].description||'Reference-based pixel character.')}</p></div><button class="motion-toggle" id="motion-toggle" aria-pressed="${S.motion}" aria-label="Ambient animation">${S.motion?'Ⅱ Pause animation':'▷ Play animation'}</button></div>
 <section class="icon-preview"><div><h2>UI portrait</h2><p>Sidebar · Floor directory · Personnel card · Agent dossier</p></div><div class="icon-sizes">${[24,32,64,96].map(size=>`<div>${avatar(a,'sample-icon icon-'+size)}<small>${size} PX</small></div>`).join('')}</div></section>
 <div class="animation-grid">${states.map(st=>`<section class="animation-card"><div class="animation-card-title"><h2>${st==='unknown'?'Idle / unknown':STATUS_LABEL[st]}</h2><span>${S.sprites[a.id][st].still||S.sprites[a.id][st].atlas?.frames.length===1?'STATIC':S.sprites[a.id][st].fps+' FPS'}</span></div>${characterStage(a,st)}<p>${escapeHTML(ACTION[a.id]?.[st]||'Neutral idle')}</p></section>`).join('')}</div>
 <p class="art-study-note">These are art previews, not live activity. The room uses the reported agent state. Unknown activity keeps a neutral, still pose.</p></div>`;
}
function notFound(){return `<div class="page"><h1>Lost in the tower.</h1><p>That floor isn't registered.</p><a class="action-link" href="#/building">BACK TO HEADQUARTERS ↗</a></div>`;}
function render(){
 if(!S.auth) return loginPage();
 if(!S.data)return;
 document.body.dataset.sky=S.theme;
 const r=route(); let content='';
 if(r.kind==='building')content=buildingPage();
 else if(r.kind==='machines')content=machine(r.id)?roomPage(machine(r.id)):notFound();
 else if(r.kind==='agents')content=agent(r.id)?agentPage(agent(r.id)):notFound();
 else if(r.kind==='characters')content=agent(r.id)&&S.sprites?.[r.id]?.icon?characterPage(agent(r.id)):notFound();
 else if(r.kind==='profiles')content=agent(r.id)?profilePage(agent(r.id)):notFound();
 else content=notFound();
 const focused=document.activeElement;const focusKey=focused?.dataset;
 $('#app').innerHTML=`<a class="skip-link" href="#main-content">Skip to content</a><div class="app-shell">${sidebar()}<div class="main-shell">${header()}<main id="main-content"><div class="hosted-preview-banner" role="status">CLOUD STATUS · THREE INDEPENDENT MACS</div>${S.refreshError?'<div class="connection-warning" role="status">Connection interrupted. Showing the last received snapshot.</div>':''}${content}</main><footer>ANTSU CONTROL INTERFACE <span>3 MACHINES / 9 AGENTS / 1 WORLD</span><span>A/2 + BBMango02</span></footer></div></div>`;
 $('#menu-toggle')?.addEventListener('click',()=>{S.navOpen=!S.navOpen;render()});
 document.querySelectorAll('[data-theme]').forEach(el=>el.addEventListener('click',()=>themeStorage(el.dataset.theme)));
 document.querySelectorAll('[data-preview-id]').forEach(el=>el.addEventListener('click',()=>{S.preview[el.dataset.previewId]=el.dataset.previewStatus;render()}));
 document.querySelectorAll('[data-memory-tab]').forEach(el=>el.addEventListener('click',()=>{S.tab[el.dataset.agentId]=el.dataset.memoryTab;render()}));
 $('#profile-key-form')?.addEventListener('submit',e=>{e.preventDefault();if(typeof setProfileKey==='function')setProfileKey(String(new FormData(e.target).get('profileKey')||''),e.target.dataset.agentId)});
 $('#actors-toggle')?.addEventListener('click',()=>{S.showActors=!S.showActors;localStorage.setItem('antsu-actors',S.showActors?'shown':'hidden');render();$('#actors-toggle')?.focus()});
 $('#motion-toggle')?.addEventListener('click',()=>{S.motion=!S.motion;localStorage.setItem('antsu-motion',S.motion?'playing':'paused');render();$('#motion-toggle')?.focus()});
 $('#logout')?.addEventListener('click',()=>cloudLogout());
 $('#agent-search')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.agent-nav a').forEach(a=>{a.hidden=!a.textContent.toLowerCase().includes(q)});});
 document.querySelectorAll('img.actor-sprite').forEach(img=>img.addEventListener('error',()=>{img.replaceWith(Object.assign(document.createElement('span'),{className:'sprite-missing',textContent:'SPRITE UNAVAILABLE'}));},{once:true}));
 document.querySelectorAll('.sidebar a').forEach(a=>a.addEventListener('click',()=>{S.navOpen=false;document.querySelector('.sidebar')?.classList.remove('opened')}));
 document.querySelector('.skip-link')?.addEventListener('click',e=>{e.preventDefault();const main=$('main');main.tabIndex=-1;main.focus()});
 if(focusKey?.previewId)document.querySelector(`[data-preview-id="${focusKey.previewId}"][data-preview-status="${focusKey.previewStatus}"]`)?.focus();
 if(focusKey?.memoryTab)document.querySelector(`[data-memory-tab="${focusKey.memoryTab}"]`)?.focus();
 tickClock();
 if(r.kind==='profiles'&&typeof loadProfile==='function'&&typeof profileViewerKey==='string'&&profileViewerKey&&!S.profileData[r.id])void loadProfile(r.id);
}
function tickClock(){const el=$('#clock');if(el)el.textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())+' JST';}
const API_ORIGIN="https://antsu-api.antsu-cloud-api.workers.dev";
// Included only in the GitHub Pages cloud build. API_ORIGIN contains no secret.
let viewerKey = '';
let profileViewerKey = '';
const profileLoading = new Set();
let cloudInitialized = false;
function cloudLogout() {
 viewerKey='';profileViewerKey='';S.profileData={};S.auth=false;S.data=null;S.lastSnapshot='';S.message='';S.refreshError=false;
 try{sessionStorage.removeItem('antsu-viewer-key');sessionStorage.removeItem('antsu-profile-key')}catch{}
 loginPage();
}
function setProfileKey(key,id){profileViewerKey=key.trim();S.profileData={};try{sessionStorage.setItem('antsu-profile-key',profileViewerKey)}catch{}if(profileViewerKey)void loadProfile(id);}
async function loadProfile(id){
 if(!profileViewerKey||profileLoading.has(id)||S.profileData[id])return;
 profileLoading.add(id);const key=profileViewerKey;
 try{
  const response=await fetch(API_ORIGIN+'/api/profiles/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+key},cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(10000)});
  if(key!==profileViewerKey)return;
  if(response.status===401){profileViewerKey='';try{sessionStorage.removeItem('antsu-profile-key')}catch{}S.profileData[id]={error:'Profile key not accepted.'};}
  else if(!response.ok)S.profileData[id]={error:'Profile service unavailable.'};
  else S.profileData[id]=await response.json();
 }catch{if(key===profileViewerKey)S.profileData[id]={error:'Could not load profile.'};}
 finally{profileLoading.delete(id);if(S.auth&&route().kind==='profiles'&&route().id===id)render();}
}
function loginPage(){
 document.body.dataset.sky=S.theme;
 $('#app').innerHTML=`<div class="login-wrap"><div class="login-card"><div class="login-glyph">A▟</div><span class="page-eyebrow">SECURE ACCESS / ANTSU NETWORK</span><h1>Enter the tower.</h1><p>Enter your read-only dashboard access key. Your three Macs report independently to the cloud.</p><form id="login-form"><label>VIEWER ACCESS KEY<input type="password" name="password" autocomplete="current-password" placeholder="Dashboard access key" required></label><button type="submit">OPEN DASHBOARD ↗</button><span class="login-error" role="status">${escapeHTML(S.message)}</span></form></div></div>`;
 $('#login-form').addEventListener('submit',async e=>{
  e.preventDefault();if(S.busy)return;
  viewerKey=String(new FormData(e.target).get('password')||'').trim();
  S.message='';await loadState();
 });
}
async function loadState(){
 if(S.busy||!viewerKey)return;S.busy=true;const requestKey=viewerKey;
 try{
  const response=await fetch(API_ORIGIN+'/api/state',{headers:{Authorization:'Bearer '+requestKey},cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(10000)});
  if(requestKey!==viewerKey)return;
  if(response.status===401){cloudLogout();S.message='Access key not accepted. Use the viewer key, not a collector key.';loginPage();return;}
  if(!response.ok)throw Error('API unavailable');
  const next=await response.json();if(requestKey!==viewerKey)return;
  const snapshot=JSON.stringify({...next,serverTime:undefined});
  const changed=snapshot!==S.lastSnapshot||S.refreshError||!S.auth;
  S.data=next;S.lastSnapshot=snapshot;S.auth=true;S.refreshError=false;S.message='';
  try{sessionStorage.setItem('antsu-viewer-key',viewerKey)}catch{}
  if(changed)render();
 }catch{
  if(requestKey!==viewerKey)return;
  if(S.data){
   S.refreshError=true;S.data={...S.data,liveMachines:0,machines:S.data.machines.map(m=>({...m,connection:'offline'})),agents:S.data.agents.map(a=>({...a,status:'unknown',source:'stale'}))};render();
  }else{S.message='Cannot reach the status service. Please retry.';loginPage();}
 }finally{S.busy=false;}
}
async function init(){
 if(cloudInitialized)return;cloudInitialized=true;
 const responses=await Promise.all(['./sprite-manifest.json','./action-manifest.json'].map(url=>fetch(url)));
 if(responses.some(r=>!r.ok))throw Error('Artwork manifests could not be loaded');
 const [sprites,actions]=await Promise.all(responses.map(r=>r.json()));S.sprites=sprites;Object.assign(ACTION,actions);S.loginRequired=true;
 try{viewerKey=sessionStorage.getItem('antsu-viewer-key')||'';profileViewerKey=sessionStorage.getItem('antsu-profile-key')||''}catch{}
 if(viewerKey)await loadState();else loginPage();
 setInterval(()=>{if(S.auth&&!document.hidden)loadState()},15000);setInterval(tickClock,1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.auth)loadState()});
}

window.addEventListener('hashchange',()=>{S.navOpen=false;render();window.scrollTo(0,0)});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.navOpen){S.navOpen=false;render();$('#menu-toggle')?.focus();}});
init().catch(e=>{$('#app').textContent='ANTSU initialization failed: '+e.message});
