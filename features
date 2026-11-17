/* features.js: статусы, оценки, постеры, рулетка, темы, эффекты, PWA */
const ST={want:'🕒 Хочу',watching:'▶️ Смотрю',done:'✅ Посмотрел',dropped:'❌ Брошено',later:'⏸ Отложено'};
const EP=['anime','series'];
let ME=localStorage.getItem('wl_me')||'',curStatus='all';
const FX=()=>C.fx||(C.fx={type:'none',n:60,speed:1,trail:false,sound:false});
const sOf=i=>i.status||(i.done?'done':'want');
const $=id=>document.getElementById(id);
function ensureMe(){if(!ME){ME=(prompt('Как тебя зовут? (для оценок и пометки «кто добавил»)')||'').trim()||'Я';localStorage.setItem('wl_me',ME);}}

/* ===== обёртки над app.js ===== */
const _init=initApp;initApp=async function(){ensureMe();await _init();if($('meName'))$('meName').textContent=ME;};
const _load=loadAllItems;loadAllItems=async function(){
  try{await _load();localStorage.setItem('wl_cache',JSON.stringify(items));}
  catch(e){const c=localStorage.getItem('wl_cache');if(c){items=JSON.parse(c);setSyncState('error','офлайн');return;}throw e;}
};

/* ===== карточки ===== */
function render(){
  renderTabs();
  const list=$('list'),all=Object.values(items);
  let arr=all.filter(i=>i.cat===currentTab);
  if(curStatus!=='all')arr=arr.filter(i=>sOf(i)===curStatus);
  else if(currentFilter==='done')arr=arr.filter(i=>sOf(i)==='done');
  else if(currentFilter==='todo')arr=arr.filter(i=>sOf(i)!=='done');
  if(searchQuery)arr=arr.filter(i=>(i.title+' '+(i.note||'')+' '+(i.tags||'')).toLowerCase().includes(searchQuery));
  arr=sortItems(arr);
  getAllCats().forEach(c=>{const n=all.filter(i=>i.cat===c.id&&sOf(i)!=='done').length,el=$('badge-'+c.id);if(el){el.textContent=n;el.classList.toggle('show',n>0);}});
  const cat=all.filter(i=>i.cat===currentTab),d=cat.filter(i=>sOf(i)==='done').length;
  [['stat-total',cat.length],['stat-done',d],['stat-left',cat.length-d]].forEach(([id,v])=>{const e=$(id);if(e)e.textContent=v;});
  if(!arr.length){list.innerHTML='<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📂</div><p>Пусто. Нажми <strong>+</strong></p></div>';return;}
  const ic=C.icons||{};
  list.innerHTML=arr.map(i=>{
    const st=sOf(i),rs=Object.entries(i.ratings||{}).filter(([,v])=>v>0).map(([k,v])=>esc(k)+' '+v).join(' · ');
    const prog=(st==='watching'&&EP.includes(i.cat))?`<span>S${i.season||1} · ${i.episode||0}${i.total?'/'+i.total:''}<button class="pp" onclick="bump('${i.id}')">+1</button></span>`:'';
    const tags=(i.tags||'').split(',').map(t=>t.trim()).filter(Boolean).map(t=>`<span class="tg">${esc(t)}</span>`).join('');
    return `<div class="item st-${st}">
      ${i.poster?`<img class="poster" loading="lazy" src="${esc(i.poster)}" onerror="this.remove()">`:''}
      <div class="check" onclick="toggleDone('${i.id}')">${st==='done'?(ic.check?`<img src="${ic.check}">`:'✓'):''}</div>
      <div class="item-body"><div class="item-title">${esc(i.title)}</div>
        ${i.note?`<div class="item-meta">${esc(i.note)}</div>`:''}
        <div class="chips"><span class="stb" onclick="cycleStatus('${i.id}')">${ST[st]}</span>${prog}${rs?`<span class="rt">⭐ ${rs}</span>`:''}${i.added_by?`<span>+${esc(i.added_by)}</span>`:''}</div>
        ${tags?`<div class="chips">${tags}</div>`:''}
        ${i.link?`<a href="${esc(i.link)}" target="_blank" style="font-size:11px;color:var(--accent2);text-decoration:none">🔗 Открыть</a>`:''}
      </div>
      <div class="item-actions"><button class="btn-icon" onclick="editItem('${i.id}')">${ic.edit?`<img src="${ic.edit}">`:'✏️'}</button><button class="btn-icon del" onclick="deleteItem('${i.id}')">${ic.del?`<img src="${ic.del}">`:'🗑️'}</button></div></div>`;
  }).join('');
  if(C.rgb.text&&rgbRaf)document.querySelectorAll('.item-title').forEach(el=>el.style.color=`hsl(${rgbHue},${C.rgb.sat}%,${C.rgb.light}%)`);
}
async function setStatus(id,st){const i=items[id];if(!i)return;items[id]={...i,status:st,done:st==='done'};render();beep();try{await upsertItem(items[id]);}catch(e){setSyncState('error','ошибка');}}
async function toggleDone(id){const i=items[id];if(i)setStatus(id,sOf(i)==='done'?'want':'done');}
function cycleStatus(id){const k=Object.keys(ST);setStatus(id,k[(k.indexOf(sOf(items[id]))+1)%k.length]);}
async function bump(id){const i=items[id];items[id]={...i,episode:(i.episode||0)+1};render();beep();try{await upsertItem(items[id]);}catch(e){}}

/* ===== форма ===== */
function fillForm(i){
  const v=(id,x)=>$(id).value=x??'';
  $('modalTitle').textContent=i.id?'Редактировать':'Добавить';
  v('inputTitle',i.title);v('inputNote',i.note);v('inputLink',i.link);
  rebuildCatSelect();$('inputCat').value=i.cat||currentTab;
  v('fStatus',sOf(i));v('fSeason',i.season||'');v('fEpisode',i.episode||'');v('fTotal',i.total||'');
  v('fRating',(i.ratings||{})[ME]||'');v('fTags',i.tags);v('fPoster',i.poster);
  $('overlay').classList.add('open');setTimeout(()=>$('inputTitle').focus(),80);
}
function openModal(){editingId=null;fillForm({});}
function editItem(id){const i=items[id];if(!i)return;editingId=id;fillForm(i);}
async function findPoster(q){try{const r=await fetch('https://api.jikan.moe/v4/anime?limit=1&q='+encodeURIComponent(q));const d=await r.json();return d.data?.[0]?.images?.jpg?.image_url||'';}catch(e){return'';}}
async function saveItem(){
  const title=$('inputTitle').value.trim();if(!title){$('inputTitle').focus();return;}
  const old=editingId?items[editingId]:null,st=$('fStatus').value,rate=parseFloat($('fRating').value)||0,cat=$('inputCat').value||currentTab;
  const ratings={...(old&&old.ratings||{})};if(rate>0)ratings[ME]=rate;else delete ratings[ME];
  const btn=$('saveBtn');btn.disabled=true;btn.textContent='Сохраняем...';
  let poster=$('fPoster').value.trim();
  if(!poster&&cat==='anime')poster=await findPoster(title);
  const base=old||{id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),ts:Date.now(),added_by:ME};
  const item={...base,cat,title,note:$('inputNote').value.trim(),link:$('inputLink').value.trim(),status:st,done:st==='done',
    season:+$('fSeason').value||0,episode:+$('fEpisode').value||0,total:+$('fTotal').value||0,ratings,tags:$('fTags').value.trim(),poster};
  items[item.id]=item;render();closeModal();
  try{await upsertItem(item);setSyncState('live','сохранено');}catch(e){setSyncState('error','ошибка сохранения');}
  btn.disabled=false;btn.textContent='Сохранить';
}
async function deleteItem(id){
  const i=items[id];if(!i)return;delete items[id];render();
  try{await deleteItemDb(id);}catch(e){}
  toast('Удалено: '+i.title,async()=>{items[id]=i;render();try{await upsertItem(i);}catch(e){}});
}
function toast(msg,undo){
  const t=$('toast');t.innerHTML=`<span>${esc(msg)}</span>${undo?'<button>Отменить</button>':''}`;t.classList.add('show');
  if(undo)t.querySelector('button').onclick=()=>{undo();t.classList.remove('show');};
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),6000);
}

/* ===== рулетка ===== */
function roulette(){
  const all=$('rouAll').checked,t=$('rouTitle');
  const pool=Object.values(items).filter(i=>sOf(i)==='want'&&(all||i.cat===currentTab));
  $('rou').classList.add('open');t.classList.remove('win');
  if(!pool.length){t.textContent='В «Хочу» пусто';return;}
  let n=0;clearInterval(roulette._t);
  roulette._t=setInterval(()=>{t.textContent=pool[Math.floor(Math.random()*pool.length)].title;if(++n>22){clearInterval(roulette._t);t.classList.add('win');beep();}},90);
}

/* ===== темы ===== */
const THEMES={
 'Базовая':{accent:CD.accent,pageBgColor:CD.pageBgColor,cardBgColor:CD.cardBgColor,cardTextColor:CD.cardTextColor,cardMetaColor:CD.cardMetaColor,borderColorRaw:CD.borderColorRaw,borderWidth:1,borderOpacity:100,borderRadius:12,headerColor:CD.headerColor,font:'Inter',fx:{type:'none'}},
 'Неон':{accent:'#00f0ff',pageBgColor:'#05000f',cardBgColor:'#12002b',cardTextColor:'#e0faff',borderColorRaw:'#ff00e6',borderWidth:2,borderOpacity:90,headerColor:'#0a0020',font:'Russo One',fx:{type:'stars'}},
 'Сакура':{accent:'#ff7eb6',pageBgColor:'#1a0f14',cardBgColor:'#2a1520',cardTextColor:'#ffe6ef',cardMetaColor:'#d9a3b8',borderColorRaw:'#ff9ec7',borderWidth:1,headerColor:'#2a1520',font:'Comfortaa',fx:{type:'sakura'}},
 'Терминал':{accent:'#22ff66',pageBgColor:'#000000',cardBgColor:'#001a08',cardTextColor:'#22ff66',cardMetaColor:'#14a040',borderColorRaw:'#22ff66',borderRadius:2,headerColor:'#001206',font:'Fira Code',fx:{type:'none'}},
 'Пиксель':{accent:'#f59e0b',pageBgColor:'#1b1033',cardBgColor:'#2b1b52',cardTextColor:'#fff3c4',borderColorRaw:'#f59e0b',borderWidth:3,borderRadius:0,headerColor:'#241446',font:'Press Start 2P',fx:{type:'snow'}}
};
const userThemes=()=>JSON.parse(localStorage.getItem('wl_themes')||'{}');
function applyTheme(n){
  const p=THEMES[n]||userThemes()[n];if(!p)return;
  const {fx,...rest}=p;Object.assign(C,rest);if(fx)Object.assign(FX(),fx);
  saveCustom();applyCustom();syncControls();fxSync();fxStart();
}
function saveTheme(){
  const n=(prompt('Название темы?')||'').trim();if(!n)return;
  const {bg,icons,customCats,rgb,...p}=C;p.fx={...FX()};
  const u=userThemes();u[n]=p;localStorage.setItem('wl_themes',JSON.stringify(u));renderThemes();toast('Тема «'+n+'» сохранена');
}
function renderThemes(){
  $('themeList').innerHTML=[...Object.keys(THEMES),...Object.keys(userThemes())].map(n=>`<button class="upload-btn" onclick='applyTheme(${JSON.stringify(n)})'>${esc(n)}</button>`).join('');
}

/* ===== эффекты ===== */
let fxRaf=0,P=[],cv,cx,trail=[],au;
function setFx(k,v){FX()[k]=v;saveCustom();fxStart();}
function fxSync(){const f=FX();$('fxType').value=f.type;$('fxN').value=f.n;$('fxS').value=f.speed;$('fxTrail').checked=!!f.trail;$('fxSound').checked=!!f.sound;}
function mk(init){const W=cv.width,H=cv.height;return{x:Math.random()*W,y:init||['stars','fireflies'].includes(FX().type)?Math.random()*H:(FX().type==='hearts'?H+20:-20),r:2+Math.random()*4,v:.5+Math.random(),ph:Math.random()*6.28};}
function fxStart(){
  cancelAnimationFrame(fxRaf);cv=$('fxCanvas');cx=cv.getContext('2d');cv.width=innerWidth;cv.height=innerHeight;P=[];
  const f=FX();cx.clearRect(0,0,cv.width,cv.height);
  if(matchMedia('(prefers-reduced-motion:reduce)').matches||(f.type==='none'&&!f.trail))return;
  if(f.type!=='none')for(let i=0;i<f.n;i++)P.push(mk(true));
  (function loop(){
    fxRaf=requestAnimationFrame(loop);if(document.hidden)return;
    const W=cv.width,H=cv.height,s=FX().speed,t=FX().type;cx.clearRect(0,0,W,H);
    for(const p of P){
      p.ph+=.02*s;
      if(t==='snow'){p.y+=p.v*s;p.x+=Math.sin(p.ph)*.5;cx.fillStyle='rgba(255,255,255,.8)';cx.beginPath();cx.arc(p.x,p.y,p.r*.6,0,7);cx.fill();}
      else if(t==='sakura'){p.y+=p.v*s*.8;p.x+=Math.sin(p.ph)*1.2*s;cx.fillStyle='rgba(255,170,205,.8)';cx.beginPath();cx.ellipse(p.x,p.y,p.r*1.6,p.r*.8,p.ph,0,7);cx.fill();}
      else if(t==='hearts'){p.y-=p.v*s*.7;p.x+=Math.sin(p.ph)*.6;cx.fillStyle='rgba(255,105,160,.75)';cx.font=(p.r*4)+'px sans-serif';cx.fillText('♥',p.x,p.y);}
      else if(t==='stars'){cx.fillStyle=`rgba(255,255,255,${.25+.75*Math.abs(Math.sin(p.ph*2))})`;cx.beginPath();cx.arc(p.x,p.y,p.r*.5,0,7);cx.fill();}
      else if(t==='fireflies'){p.x+=Math.cos(p.ph)*.4*s;p.y+=Math.sin(p.ph*1.3)*.4*s;const g=cx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*4);const a=.3+.5*Math.abs(Math.sin(p.ph*2));g.addColorStop(0,`rgba(255,240,120,${a})`);g.addColorStop(1,'rgba(255,240,120,0)');cx.fillStyle=g;cx.fillRect(p.x-p.r*4,p.y-p.r*4,p.r*8,p.r*8);}
      if(p.y>H+30||p.y<-30||p.x<-30||p.x>W+30)Object.assign(p,mk(false));
    }
    if(FX().trail){trail=trail.filter(m=>(m.l-=.03)>0);trail.forEach(m=>{cx.fillStyle=`hsla(${m.h},90%,60%,${m.l})`;cx.beginPath();cx.arc(m.x,m.y,6*m.l,0,7);cx.fill();});}
  })();
}
addEventListener('pointermove',e=>{if(FX().trail){trail.push({x:e.clientX,y:e.clientY,l:1,h:Date.now()/8%360});if(trail.length>45)trail.shift();}});
addEventListener('resize',()=>{if(cv){cv.width=innerWidth;cv.height=innerHeight;}});
function beep(){if(!FX().sound)return;try{au=au||new AudioContext();const o=au.createOscillator(),g=au.createGain();o.frequency.value=660;g.gain.setValueAtTime(.08,au.currentTime);g.gain.exponentialRampToValueAtTime(.001,au.currentTime+.15);o.connect(g);g.connect(au.destination);o.start();o.stop(au.currentTime+.15);}catch(e){}}

/* ===== PWA, бэкап, профиль ===== */
let dip;addEventListener('beforeinstallprompt',e=>{e.preventDefault();dip=e;});
function installApp(){if(dip){dip.prompt();dip=null;}else toast('Chrome: меню ⋮ → «Установить приложение»');}
function exportData(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(Object.values(items),null,1)],{type:'application/json'}));a.download='watchlist-backup.json';a.click();}
function switchMe(){ME='';localStorage.removeItem('wl_me');ensureMe();$('meName').textContent=ME;render();}

/* ===== внедрение интерфейса ===== */
addEventListener('load',()=>{
  const css=document.createElement('style');css.textContent=`
  #fxCanvas{position:fixed;inset:0;z-index:0;pointer-events:none}
  .item{position:relative}.poster{width:46px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0}
  .chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;align-items:center}
  .chips>*{font-size:11px;padding:2px 8px;border-radius:20px;background:rgba(255,255,255,.07);color:var(--text2)}
  .stb{cursor:pointer}.chips .rt{color:#facc15}.chips .tg{background:var(--accent-glow);color:var(--accent2)}
  .pp{border:0;background:var(--accent);color:#fff;border-radius:10px;padding:0 7px;margin-left:5px;cursor:pointer;font-size:11px}
  .st-done{background:var(--done-bg)!important;border-color:rgba(34,197,94,.2)!important}.st-done .item-title{text-decoration:line-through;opacity:.55}
  .st-done .check{background:var(--done);border-color:var(--done)}.st-dropped{opacity:.55}.st-watching{border-left:3px solid var(--accent)}
  .row3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.modal{max-height:92dvh;overflow-y:auto}
  #toast{position:fixed;left:50%;bottom:90px;transform:translate(-50%,20px);background:#1d2140;color:#fff;border:1px solid var(--border-color);border-radius:12px;padding:10px 14px;display:flex;gap:12px;align-items:center;opacity:0;pointer-events:none;transition:.25s;z-index:60;font-size:13px}
  #toast.show{opacity:1;transform:translate(-50%,0);pointer-events:auto}#toast button{background:var(--accent);border:0;color:#fff;border-radius:8px;padding:5px 10px;cursor:pointer}
  .rou-t{font-size:24px;font-weight:700;margin:22px 0;min-height:64px;display:grid;place-items:center;transition:.2s}.rou-t.win{color:var(--accent2);transform:scale(1.08)}`;
  document.head.appendChild(css);
  document.body.insertAdjacentHTML('beforeend',`<canvas id="fxCanvas"></canvas><div id="toast"></div>
  <div id="rou" class="overlay" onclick="if(event.target===this)this.classList.remove('open')"><div class="modal" style="text-align:center">
   <div style="font-size:13px;color:var(--text2)">Сегодня смотрим…</div><div id="rouTitle" class="rou-t">🎲</div>
   <label style="font-size:12px;color:var(--text2)"><input type="checkbox" id="rouAll"> из всех категорий</label>
   <div class="btn-row"><button class="btn btn-secondary" onclick="$('rou').classList.remove('open')">Закрыть</button><button class="btn btn-primary" onclick="roulette()">Ещё раз</button></div></div></div>`);
  $('overlay').querySelector('.btn-row').insertAdjacentHTML('beforebegin',`
   <div class="field"><label>Статус</label><select id="fStatus">${Object.entries(ST).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
   <div class="field row3"><div><label>Сезон</label><input id="fSeason" type="number" min="0"></div><div><label>Серия</label><input id="fEpisode" type="number" min="0"></div><div><label>Всего серий</label><input id="fTotal" type="number" min="0"></div></div>
   <div class="field"><label>Моя оценка (1–10)</label><input id="fRating" type="number" min="0" max="10" step="0.5"></div>
   <div class="field"><label>Теги через запятую</label><input id="fTags" placeholder="хоррор, романтика"></div>
   <div class="field"><label>Постер (ссылка)</label><input id="fPoster" placeholder="https://… (у аниме найдётся сам)"></div>`);
  document.querySelector('.toolbar').insertAdjacentHTML('beforeend',`<select class="sort-select" onchange="curStatus=this.value;render()"><option value="all">Все статусы</option>${Object.entries(ST).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><button class="filter-btn" onclick="roulette()">🎲 Что смотрим?</button>`);
  document.querySelector('.cp-tabs').insertAdjacentHTML('beforeend',`<div class="cp-tab" data-tab="fx" onclick="switchCpTab('fx')">✨ Темы и FX</div>`);
  document.querySelector('.cp-body').insertAdjacentHTML('beforeend',`<div class="cp-page" data-page="fx">
   <div class="cs"><div class="cs-title">Темы</div><div id="themeList" class="color-grid"></div><button class="upload-btn" onclick="saveTheme()">💾 Сохранить текущее оформление как тему</button></div><div class="sep"></div>
   <div class="cs"><div class="cs-title">Эффекты на фоне</div>
    <select class="cp-select" id="fxType" onchange="setFx('type',this.value)"><option value="none">Нет</option><option value="sakura">🌸 Сакура</option><option value="snow">❄️ Снег</option><option value="stars">✨ Звёзды</option><option value="fireflies">🟡 Светлячки</option><option value="hearts">💗 Сердечки</option></select>
    <div class="rr"><span class="cl">Количество</span><input type="range" id="fxN" min="10" max="200" oninput="setFx('n',+this.value)"></div>
    <div class="rr"><span class="cl">Скорость</span><input type="range" id="fxS" min="0.3" max="3" step="0.1" oninput="setFx('speed',+this.value)"></div>
    <div class="rgb-row"><span class="cl" style="font-size:13px;color:var(--text)">Хвост за курсором</span><label class="toggle"><input type="checkbox" id="fxTrail" onchange="setFx('trail',this.checked)"><span class="tslider"></span></label></div>
    <div class="rgb-row"><span class="cl" style="font-size:13px;color:var(--text)">Звук при отметке</span><label class="toggle"><input type="checkbox" id="fxSound" onchange="setFx('sound',this.checked)"><span class="tslider"></span></label></div></div><div class="sep"></div>
   <div class="cs"><div class="cs-title">Приложение и данные</div>
    <button class="upload-btn" onclick="installApp()">📲 Установить как приложение</button>
    <button class="upload-btn" onclick="exportData()">⬇️ Резервная копия (JSON)</button>
    <button class="upload-btn" onclick="switchMe()">👤 Я: <span id="meName">${esc(ME)}</span> (сменить)</button></div></div>`);
  renderThemes();fxSync();fxStart();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
});
