/* ZeroU Live Console mini-dashboard — IIFE, no deps.
   Architecture surface: project → session → agent → checkpoint.
   Loop ≈ 50s: differ scan → 3 fixes (one fail/NEED_HUMAN, two merged) → user rewind. */
(function(){
'use strict';

const DATA={
  project:'agent-game-platform',sessionId:'#4',branch:'main',
  presetName:'saas-web',presetTotal:28,presetStart:8,
  needHumanStart:23,gapsQueuedStart:14,costStart:4.24,clockStart:'42:11',
  // seed checkpoints + commits from prior session (no fly-in)
  seedCheckpoints:[
    {sha:'53df272',tier:'t0',label:'baseline · pre-loop'},
    {sha:'3d2ad5f',tier:'t1',label:'docs scaffolding'},
  ],
  seedCommits:[{sha:'53df272',msg:'baseline'},{sha:'3d2ad5f',msg:'docs scaffold'}],
  prUrl:'github.com/anzy-renlab-ai/agent-game-platform/pull/6',
};

let mount=document.getElementById('zerou-console')||document.querySelector('[data-zerou-console]');
if(!mount){console.warn('[zerou-console] no mount found');return;}

// Auto-inject CSS, resolved relative to this script's URL
if(!document.querySelector('link[data-zerou-console-css]')){
  let href='mini-dashboard/mini-dashboard.css';
  document.querySelectorAll('script[src]').forEach(s=>{
    if(/mini-dashboard\.js(\?|$)/.test(s.src)) href=s.src.replace(/mini-dashboard\.js(\?.*)?$/,'mini-dashboard.css');
  });
  const link=document.createElement('link');
  link.rel='stylesheet';link.href=href;link.setAttribute('data-zerou-console-css','');
  document.head.appendChild(link);
}

// 6 agents · role · default thought
const AGENTS=[
  ['differ','scan','idle'],
  ['implementer','write','idle'],
  ['alignment','haiku','idle'],
  ['behavioral','sonnet','idle'],
  ['adversarial','attack','idle'],
  ['done-check','vision','idle'],
];
const NODES=[['static','static'],['alignment','align'],['behavioral','behav'],['adversarial','adver']];

mount.className='zu-console';
mount.setAttribute('role','region');
mount.setAttribute('aria-label','ZeroU live console — project / session / agent / checkpoint');
const M='zu-mono',G='zu-gold',MT='zu-mint';

mount.innerHTML=
// breadcrumb: project → session → state
`<nav class="zu-crumbs" aria-label="hierarchy">`+
`<span class="zu-crumb zu-crumb-project"><span class="zu-crumb-icon">▢</span><span data-zu="crumbProject">${DATA.project}</span></span>`+
`<span class="zu-crumb-arrow">›</span>`+
`<span class="zu-crumb zu-crumb-session"><span class="zu-crumb-icon">◐</span>session <span class="${M}">${DATA.sessionId}</span></span>`+
`<span class="zu-crumb-arrow">›</span>`+
`<span class="zu-crumb zu-crumb-state" data-zu="crumbState"><span class="zu-crumb-state-dot"></span><span data-zu="crumbStateLabel">LOOPING</span></span>`+
`<span class="zu-crumb-arrow zu-hide-sm">·</span>`+
`<span class="zu-crumb-stat zu-hide-sm ${M}"><span class="zu-crumb-label">cost</span>$<span data-zu="crumbCost">${DATA.costStart.toFixed(2)}</span></span>`+
`<span class="zu-crumb-arrow zu-hide-sm">·</span>`+
`<span class="zu-crumb-stat zu-hide-sm ${M}"><span class="zu-crumb-label">elapsed</span><span data-zu="crumbClock">${DATA.clockStart}</span></span>`+
`</nav>`+
// topbar: brand + dense stats + badges
`<header class="zu-topbar"><div class="zu-topbar-left">`+
`<span class="zu-mark"></span><span class="zu-brand">ZEROU</span>`+
`<span class="zu-sep">·</span><span class="zu-meta"><span class="zu-meta-lbl">preset</span><span class="${M} ${G}" data-zu="topPresetDone">${DATA.presetStart}</span><span class="${M}">/${DATA.presetTotal}</span></span>`+
`<span class="zu-sep">·</span><span class="zu-meta"><span class="zu-meta-lbl">gaps queued</span><span class="${M}" data-zu="topGaps">${DATA.gapsQueuedStart}</span></span>`+
`<span class="zu-sep zu-hide-sm">·</span><span class="zu-meta zu-hide-sm"><span class="zu-meta-lbl">branch</span><span class="${M}">${DATA.branch}</span></span>`+
`</div><div class="zu-topbar-right">`+
`<span class="zu-badge zu-badge-need" data-zu="needHumanBadge"><span class="zu-badge-dot"></span>NEED_HUMAN <span class="${M}" data-zu="needHumanCount">${DATA.needHumanStart}</span></span>`+
`<span class="zu-badge zu-badge-pr" data-zu="prBadge" hidden>✓ PR #6 opened</span>`+
`</div></header>`+
// preset bar
`<div class="zu-preset"><span class="zu-preset-label">preset <span class="${M}">${DATA.presetName}</span></span>`+
`<div class="zu-preset-bar"><div class="zu-preset-fill" data-zu="presetFill" style="--pct:${(DATA.presetStart/DATA.presetTotal)*100}%"></div><div class="zu-preset-ticks"></div></div>`+
`<span class="zu-preset-count"><span class="${M} ${G}" data-zu="presetDone">${DATA.presetStart}</span><span class="zu-preset-slash">/</span><span class="${M}">${DATA.presetTotal}</span></span></div>`+
// body — 4 columns
`<div class="zu-body">`+
// col 1 agents
`<section class="zu-col zu-col-agents"><h3 class="zu-col-h">AGENTS<span class="zu-col-h-tag">6 roles</span></h3><ul class="zu-agents">`+
AGENTS.map(([n,r])=>`<li class="zu-agent" data-agent="${n}"><span class="zu-agent-dot"></span><div class="zu-agent-body"><div class="zu-agent-line1"><span class="zu-agent-name">${n}</span><span class="zu-agent-role">${r}</span></div><div class="zu-agent-thought" data-thought>idle</div></div></li>`).join('')+
`</ul></section>`+
// col 2 pipeline
`<section class="zu-col zu-col-pipeline"><h3 class="zu-col-h">PIPELINE<span class="zu-col-h-tag">current fix</span></h3>`+
`<div class="zu-fix" data-zu="fixBox"><div class="zu-fix-head"><span class="zu-fix-slug">fix/<span data-zu="fixName">—</span></span><span class="zu-fix-attempt">attempt <span class="${M}" data-zu="fixAttempt">—</span></span></div><div class="zu-fix-status" data-zu="fixStatus">idle · waiting for differ</div></div>`+
`<ol class="zu-pipe">`+
NODES.map(([n,l],i)=>`<li class="zu-pipe-node" data-node="${n}"><span class="zu-pipe-dot"></span><span class="zu-pipe-name">${l}</span><span class="zu-pipe-verdict" data-verdict>—</span></li>${i<3?'<li class="zu-pipe-edge"></li>':''}`).join('')+
`</ol><div class="zu-retry" data-zu="retry" hidden><span class="zu-retry-icon">↻</span> retry · <span class="${M}" data-zu="retryNum">—</span>/3</div></section>`+
// col 3 commits
`<section class="zu-col zu-col-commits"><h3 class="zu-col-h">COMMITS<span class="zu-col-h-tag">→ main</span></h3><ul class="zu-commits" data-zu="commits" aria-live="polite"></ul><div class="zu-commits-empty">no merges yet · waiting…</div></section>`+
// col 4 checkpoints — NEW
`<section class="zu-col zu-col-checkpoints"><h3 class="zu-col-h">CHECKPOINTS<span class="zu-col-h-tag">T0 T1 T2</span></h3><ul class="zu-ckpts" data-zu="ckpts" aria-live="polite"></ul><div class="zu-ckpts-empty">no checkpoints yet</div><div class="zu-rewind-banner" data-zu="rewindBanner" hidden>↶ rewinding to <span class="${M}" data-zu="rewindTarget">—</span></div></section>`+
`</div>`+
// log
`<section class="zu-log"><header class="zu-log-head"><span class="zu-log-h">LOG STREAM</span><span class="zu-log-cursor">●</span><span class="zu-log-clock" data-zu="clock">${DATA.clockStart}</span></header><ol class="zu-log-list" data-zu="logList" aria-live="polite"></ol></section>`;

const Q=s=>mount.querySelector(s),QA=s=>mount.querySelectorAll(s);
const el={
  crumbState:Q('[data-zu="crumbState"]'),
  crumbStateLabel:Q('[data-zu="crumbStateLabel"]'),
  crumbCost:Q('[data-zu="crumbCost"]'),
  crumbClock:Q('[data-zu="crumbClock"]'),
  topPresetDone:Q('[data-zu="topPresetDone"]'),
  topGaps:Q('[data-zu="topGaps"]'),
  presetFill:Q('[data-zu="presetFill"]'),
  presetDone:Q('[data-zu="presetDone"]'),
  needHumanCount:Q('[data-zu="needHumanCount"]'),
  needHumanBadge:Q('[data-zu="needHumanBadge"]'),
  prBadge:Q('[data-zu="prBadge"]'),
  fixBox:Q('[data-zu="fixBox"]'),
  fixName:Q('[data-zu="fixName"]'),
  fixAttempt:Q('[data-zu="fixAttempt"]'),
  fixStatus:Q('[data-zu="fixStatus"]'),
  retry:Q('[data-zu="retry"]'),
  retryNum:Q('[data-zu="retryNum"]'),
  commits:Q('[data-zu="commits"]'),
  ckpts:Q('[data-zu="ckpts"]'),
  rewindBanner:Q('[data-zu="rewindBanner"]'),
  rewindTarget:Q('[data-zu="rewindTarget"]'),
  logList:Q('[data-zu="logList"]'),
  clock:Q('[data-zu="clock"]'),
};

// state
const state={
  clockSec:42*60+11,  // start at 42:11
  preset:DATA.presetStart,
  need:DATA.needHumanStart,
  gaps:DATA.gapsQueuedStart,
  cost:DATA.costStart,
  costTickStep:0.003, // per-second drift while LOOPING
  loopState:'LOOPING',
  t:[],iv:[],
};
const pad=n=>String(n).padStart(2,'0');
const fmtClock=()=>{const T=state.clockSec;return `${pad(Math.floor(T/60))}:${pad(T%60)}`;};
const fmtLog=()=>{const T=state.clockSec;return `${pad(Math.floor(T/3600)%24||(Math.floor(T/60)<60?0:Math.floor(T/3600))) }:${pad(Math.floor(T/60)%60)}:${pad(T%60)}`;};
// log timestamps use HH:MM:SS-ish — keep simple MM:SS for clarity
const fmtLogTs=()=>{const T=state.clockSec;return `${pad(Math.floor(T/60))}:${pad(T%60)}`;};

function tick(){
  state.clockSec+=1;
  el.clock.textContent=fmtClock();
  el.crumbClock.textContent=fmtClock();
  if(state.loopState==='LOOPING'){
    state.cost+=state.costTickStep;
    el.crumbCost.textContent=state.cost.toFixed(2);
  }
}

// agents — extended state machine
function setAgent(name,s,thought){
  const n=Q(`.zu-agent[data-agent="${name}"]`);if(!n)return;
  n.classList.remove('is-working','is-passing','is-done','is-blocked');
  if(s&&s!=='idle') n.classList.add('is-'+s);
  if(thought!==undefined){
    const t=n.querySelector('[data-thought]');
    if(t) t.textContent=thought;
  }
}
function resetAgents(){
  QA('.zu-agent').forEach(n=>{
    n.classList.remove('is-working','is-passing','is-done','is-blocked');
    const t=n.querySelector('[data-thought]');if(t) t.textContent='idle';
  });
}
function setPipe(name,s,v){const n=Q(`.zu-pipe-node[data-node="${name}"]`);if(!n)return;n.classList.remove('is-working','is-pass','is-fail','is-skip');if(s)n.classList.add('is-'+s);if(v!=null)n.querySelector('[data-verdict]').textContent=v;}
function setEdge(i,s){const e=QA('.zu-pipe-edge')[i];if(!e)return;e.classList.remove('is-pass','is-fail');if(s)e.classList.add('is-'+s);}
function resetPipe(){['static','alignment','behavioral','adversarial'].forEach(n=>setPipe(n,null,'—'));[0,1,2].forEach(i=>setEdge(i,null));}
function setFix(n,a,st,cls){el.fixName.textContent=n;el.fixAttempt.textContent=a;el.fixStatus.textContent=st;el.fixBox.classList.remove('is-failing','is-merged');if(cls)el.fixBox.classList.add('is-'+cls);}
function clearFix(){el.fixName.textContent='—';el.fixAttempt.textContent='—';el.fixStatus.textContent='idle · waiting for differ';el.fixBox.classList.remove('is-failing','is-merged');}
function showRetry(n){el.retry.hidden=false;el.retryNum.textContent=n;}
function hideRetry(){el.retry.hidden=true;}

function setPreset(d){
  state.preset=d;
  el.presetDone.textContent=d;
  el.topPresetDone.textContent=d;
  el.presetFill.style.setProperty('--pct',(d/DATA.presetTotal)*100+'%');
}
function bumpPreset(){setPreset(state.preset+1);}
function unbumpPreset(){setPreset(Math.max(0,state.preset-1));}
function setNeed(n){state.need=n;el.needHumanCount.textContent=n;el.needHumanBadge.classList.add('zu-flash');setTimeout(()=>el.needHumanBadge.classList.remove('zu-flash'),500);}
function bumpNeed(){setNeed(state.need+1);}
function setGaps(n){state.gaps=n;el.topGaps.textContent=n;}
function bumpGapsDown(){setGaps(Math.max(0,state.gaps-1));}
function setLoopState(s){
  state.loopState=s;
  el.crumbStateLabel.textContent=s==='LOOPING'?'▶ LOOPING':s==='REWIND'?'↶ REWIND':s;
  el.crumbState.classList.remove('is-rewind');
  if(s==='REWIND') el.crumbState.classList.add('is-rewind');
}

function pushCommit(sha,msg){
  const li=document.createElement('li');li.className='zu-commit';li.dataset.sha=sha;
  li.innerHTML=`<span class="zu-commit-arrow">▸</span><span class="zu-commit-sha">${sha}</span><span class="zu-commit-msg">${msg}</span>`;
  el.commits.insertBefore(li,el.commits.firstChild);
  const all=el.commits.querySelectorAll('.zu-commit');
  if(all.length>4) all[all.length-1].remove();
}
function rewindLastCommit(){
  const first=el.commits.querySelector('.zu-commit:not(.is-rewound)');
  if(first) first.classList.add('is-rewound');
}
function clearCommits(){el.commits.innerHTML='';}

function pushCheckpoint(sha,tier,label){
  const li=document.createElement('li');li.className='zu-ckpt is-'+tier;li.dataset.sha=sha;
  li.innerHTML=
    `<span class="zu-ckpt-dot"></span>`+
    `<div class="zu-ckpt-body">`+
      `<div class="zu-ckpt-line1"><span class="zu-ckpt-sha">${sha}</span><span class="zu-ckpt-tier">${tier.toUpperCase()}</span></div>`+
      `<div class="zu-ckpt-label">${label}</div>`+
    `</div>`+
    `<span class="zu-ckpt-rewind">↶ rewind</span>`;
  el.ckpts.insertBefore(li,el.ckpts.firstChild);
  const all=el.ckpts.querySelectorAll('.zu-ckpt');
  if(all.length>4) all[all.length-1].remove();
}
function highlightCheckpoint(sha){
  QA('.zu-ckpt').forEach(c=>c.classList.remove('is-target','is-hover'));
  const n=Q(`.zu-ckpt[data-sha="${sha}"]`);
  if(n){n.classList.add('is-target','is-hover');}
}
function clearCheckpointHighlight(){
  QA('.zu-ckpt').forEach(c=>c.classList.remove('is-target','is-hover'));
}
function clearCheckpoints(){el.ckpts.innerHTML='';}
function showRewindBanner(sha){el.rewindTarget.textContent=sha;el.rewindBanner.hidden=false;}
function hideRewindBanner(){el.rewindBanner.hidden=true;}

function showPR(){el.prBadge.hidden=false;el.prBadge.classList.add('zu-flash');setTimeout(()=>el.prBadge.classList.remove('zu-flash'),500);}
function hidePR(){el.prBadge.hidden=true;el.prBadge.classList.remove('zu-flash');}

function log(msg,kind){
  const li=document.createElement('li');li.className='zu-log-line';
  if(kind) li.classList.add('is-'+kind);
  li.innerHTML=`<span class="zu-log-time">${fmtLogTs()}</span><span class="zu-log-msg">${msg}</span>`;
  el.logList.appendChild(li);
  const all=el.logList.querySelectorAll('.zu-log-line');
  all.forEach((line,i)=>{
    line.classList.remove('is-fade','is-ghost');
    const fe=all.length-1-i;
    if(fe===2) line.classList.add('is-fade');
    if(fe===3) line.classList.add('is-ghost');
    if(fe>3) line.remove();
  });
}
function clearLog(){el.logList.innerHTML='';}

function at(ms,fn){const id=setTimeout(()=>{state.t=state.t.filter(x=>x!==id);try{fn();}catch(e){console.error('[zerou]',e);}},ms);state.t.push(id);}
function clearAll(){state.t.forEach(clearTimeout);state.t=[];state.iv.forEach(clearInterval);state.iv=[];}

// ===== loop (≈ 52s) =====
// 0-3s   differ scans
// 3-12s  fix #27 docs-changelog · attempt 1 · all pass → MERGED → T1 checkpoint
// 12-22s fix #28 auth-csrf · attempt 2 · alignment FAIL → NEED_HUMAN +1
// 22-34s fix #29 readme-expansion · attempt 3 · all pass → MERGED → T1 checkpoint + PR #6
// 34-42s done-check pondering · prior session state shown
// 42-50s user clicks ↶ rewind to b1f2c91 (which is the 5aedd6e checkpoint) — REWIND animation
// 50-52s reset back to LOOPING

function cycle(){
  resetAgents();resetPipe();clearFix();hideRetry();hidePR();clearLog();clearCommits();clearCheckpoints();hideRewindBanner();clearCheckpointHighlight();
  setLoopState('LOOPING');
  setPreset(DATA.presetStart);
  setNeed(DATA.needHumanStart);
  setGaps(DATA.gapsQueuedStart);
  state.cost=DATA.costStart;el.crumbCost.textContent=state.cost.toFixed(2);
  state.clockSec=42*60+11;el.clock.textContent=fmtClock();el.crumbClock.textContent=fmtClock();

  // seed prior commits + checkpoints (no fly-in)
  DATA.seedCommits.forEach(c=>{
    const li=document.createElement('li');li.className='zu-commit';li.style.animation='none';li.dataset.sha=c.sha;
    li.innerHTML=`<span class="zu-commit-arrow">▸</span><span class="zu-commit-sha">${c.sha}</span><span class="zu-commit-msg">${c.msg}</span>`;
    el.commits.appendChild(li);
  });
  DATA.seedCheckpoints.forEach(c=>{
    const li=document.createElement('li');li.className='zu-ckpt is-'+c.tier;li.style.animation='none';li.dataset.sha=c.sha;
    li.innerHTML=
      `<span class="zu-ckpt-dot"></span>`+
      `<div class="zu-ckpt-body">`+
        `<div class="zu-ckpt-line1"><span class="zu-ckpt-sha">${c.sha}</span><span class="zu-ckpt-tier">${c.tier.toUpperCase()}</span></div>`+
        `<div class="zu-ckpt-label">${c.label}</div>`+
      `</div>`+
      `<span class="zu-ckpt-rewind">↶ rewind</span>`;
    el.ckpts.appendChild(li);
  });

  state.iv.push(setInterval(tick,1000));

  log('session #4 · resumed · 8/28 preset · gaps queued 14');

  // ====== Phase 1: differ scan (0-3s) ======
  at(900,()=>{setAgent('differ','working','scanning preset 28 items');log('differ scanning repo + vision');});
  at(2400,()=>{log('differ found 28 gaps · 14 queued · 4 complex','event');setAgent('differ','done','28 gaps · 4 complex');});

  // ====== Phase 2: fix #27 docs-changelog · attempt 1 · all pass (3-12s) ======
  at(3200,()=>{
    setFix('docs-changelog',1,'implementer writing CHANGELOG.md…');
    setAgent('implementer','working','writing CHANGELOG.md');
    log('fix #27 · docs-changelog · attempt 1');
    bumpGapsDown();
  });
  at(4400,()=>{setAgent('implementer','passing','diff ready · 42 LOC');setPipe('static','working','…');setFix('docs-changelog',1,'static gate · tsc + tests');});
  at(5500,()=>{
    setPipe('static','pass','PASS');setEdge(0,'pass');
    log('static gate · 41 tests · PASS','pass');
    setPipe('alignment','working','…');
    setAgent('alignment','working','haiku probe · scope check');
  });
  at(6800,()=>{
    setPipe('alignment','pass','0.98');setEdge(1,'pass');
    log('alignment · 0.98 · PASS','pass');
    setAgent('alignment','done','0.98 · scope ok');
    setPipe('behavioral','working','…');
    setAgent('behavioral','working','sonnet deep review');
    setFix('docs-changelog',1,'behavioral · sonnet deep review');
  });
  at(8100,()=>{
    setPipe('behavioral','pass','APPROVE');setEdge(2,'pass');
    log('behavioral · APPROVE · 88% conf','pass');
    setAgent('behavioral','done','APPROVE · 88% conf');
    setPipe('adversarial','skip','SKIP');
    log('adversarial · SKIP · low sensitivity');
    setAgent('implementer','done','merged · 42 LOC');
    setFix('docs-changelog',1,'MERGED · 5aedd6e → main','merged');
  });
  at(9300,()=>{
    pushCommit('5aedd6e','docs+');
    pushCheckpoint('5aedd6e','t1','docs-changelog · merged');
    log('MERGED · 5aedd6e · checkpoint T1 created','merge');
    bumpPreset();
  });

  // ====== Phase 3: fix #28 auth-csrf · attempt 2 · alignment FAIL (12-22s) ======
  at(11000,()=>{
    resetPipe();resetAgents();
    setFix('auth-csrf',2,'implementer writing diff…');
    setAgent('implementer','working','patching CSRF middleware');
    log('fix #28 · auth-csrf · attempt 2');
    bumpGapsDown();
  });
  at(12800,()=>{setAgent('implementer','passing','diff ready · 87 LOC');setPipe('static','working','…');setFix('auth-csrf',2,'static gate · tsc + tests');});
  at(14000,()=>{
    setPipe('static','pass','PASS');setEdge(0,'pass');
    log('static gate · 0 errors · PASS','pass');
    setPipe('alignment','working','…');
    setAgent('alignment','working','haiku probe · scope drift?');
    setFix('auth-csrf',2,'alignment · haiku quick-check');
  });
  at(15600,()=>{
    setPipe('alignment','fail','0.55');setEdge(1,'fail');
    log('alignment · 0.55 · FAIL · scope creep','fail');
    setAgent('alignment','done','0.55 · scope creep');
    setAgent('implementer','blocked','attempt 2/3 rejected');
    setFix('auth-csrf',2,'FAIL · score below 0.7','failing');
    showRetry(2);
  });
  at(17400,()=>{
    bumpNeed();
    log('gap escalated · NEED_HUMAN +1','event');
    setAgent('implementer','blocked','escalated → NEED_HUMAN');
  });

  // ====== Phase 4: fix #29 readme-expansion · attempt 3 · all pass + PR (22-34s) ======
  at(19400,()=>{
    resetPipe();resetAgents();hideRetry();
    setFix('readme-expansion',3,'implementer attempt 3…');
    setAgent('implementer','working','expanding setup + deploy');
    log('fix #29 · readme-expansion · attempt 3');
    showRetry(3);
    bumpGapsDown();
  });
  at(21200,()=>{setAgent('implementer','passing','diff ready · 134 LOC');setPipe('static','pass','PASS');setEdge(0,'pass');log('static gate · PASS','pass');});
  at(22300,()=>{
    setPipe('alignment','pass','0.91');setEdge(1,'pass');
    log('alignment · 0.91 · PASS','pass');
    setAgent('alignment','done','0.91 · on target');
    setPipe('behavioral','working','…');
    setAgent('behavioral','working','sonnet · checking section flow');
  });
  at(23700,()=>{
    setPipe('behavioral','pass','APPROVE');setEdge(2,'pass');
    log('behavioral · APPROVE · 82% conf','pass');
    setAgent('behavioral','done','APPROVE · 82% conf');
    setPipe('adversarial','skip','SKIP');
    setAgent('implementer','done','merged on 3rd try');
    setFix('readme-expansion',3,'MERGED · 4b58841 → main','merged');
    hideRetry();
  });
  at(24800,()=>{
    pushCommit('4b58841','readme');
    pushCheckpoint('4b58841','t1','readme-expansion · merged');
    log('MERGED · 4b58841 · checkpoint T1 created','merge');
    bumpPreset();
  });
  at(26000,()=>{showPR();log('PR #6 opened · '+DATA.prUrl,'event');});

  // ====== Phase 5: done-check pondering (28-34s) ======
  at(28200,()=>{
    resetPipe();resetAgents();
    setAgent('done-check','working','vision verdict · 10/28 preset');
    clearFix();el.fixStatus.textContent='preset '+state.preset+'/'+DATA.presetTotal+' · 24 NEED_HUMAN · still LOOPING';
    log('done-check · vision verdict pending · '+state.preset+'/'+DATA.presetTotal,'event');
  });
  at(30000,()=>{
    setAgent('done-check','done','not done · keep looping');
    log('done-check · NOT_DONE · session continues','event');
  });

  // ====== Phase 6: user clicks ↶ rewind (34-46s) ======
  at(32500,()=>{
    log('user · hover checkpoint 5aedd6e','event');
    highlightCheckpoint('5aedd6e');
  });
  at(34500,()=>{
    log('user · ↶ rewind to 5aedd6e','rewind');
    showRewindBanner('5aedd6e');
    setLoopState('REWIND');
  });
  at(36200,()=>{
    rewindLastCommit();
    unbumpPreset();
    log('worktree · reset to 5aedd6e · 1 commit reverted','rewind');
  });
  at(38000,()=>{
    log('worktree · clean · resuming loop','event');
    hideRewindBanner();
    clearCheckpointHighlight();
    setLoopState('LOOPING');
  });
  at(40000,()=>{
    log('session #4 · ready · waiting for differ','event');
  });

  // ====== restart loop ======
  at(43000,()=>{clearAll();cycle();});
}

// IntersectionObserver — only run while visible
let running=false;
const start=()=>{if(running)return;running=true;cycle();};
const stop=()=>{running=false;clearAll();};

if('IntersectionObserver' in window){
  new IntersectionObserver(es=>es.forEach(e=>{e.isIntersecting?start():stop();}),{threshold:0.15}).observe(mount);
}else{
  start();
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){stop();}
  else{
    const r=mount.getBoundingClientRect();
    if(r.top<window.innerHeight&&r.bottom>0)start();
  }
});

})();
