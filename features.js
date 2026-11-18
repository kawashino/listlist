/* features.js: надстройка над app.js и custom.js, подключается последней.
   Разделы по порядку: обёртки над app.js, карточки, форма, рулетка, темы, эффекты, PWA и бэкап,
   внедрение интерфейса, v3 облако и постеры, v4 «хотим оба»/детали/статистика/импорт/обои,
   v5 источники постеров, v6 умное добавление/серии/франшизы/фильтры, v7 оформление/вкладки/скорость,
   v8 расположение и виды карточек.
   Чистка кода: часть 1 (мёртвые дубли), часть 2 (цепочки обёрток свёрнуты в обычные функции).
   Остаются одиночные обёртки над app.js/custom.js: saveCustom, applyCustom, getAllCats, renderTabs, cands, upsertItem, toggleCustom, sortItems.
   Дальше: разнести по модулям. */
const ST={want:'🕒 Хочу',watching:'▶️ Смотрю',done:'✅ Посмотрел',dropped:'❌ Брошено',later:'⏸ Отложено'};
const EP=['anime','series'];
let ME=localStorage.getItem('wl_me')||'',curStatus='all';
const FX=()=>C.fx||(C.fx={type:'none',n:60,speed:1,trail:false,sound:false});
const sOf=i=>i.status||(i.done?'done':'want');
const $=id=>document.getElementById(id);
function ensureMe(){if(!ME){ME=(prompt('Как тебя зовут? (для оценок и пометки «кто добавил»)')||'').trim()||'Я';localStorage.setItem('wl_me',ME);}}

/* ===== обёртки над app.js ===== */
const _initApp=initApp;initApp=async function(){ensureMe();await _initApp();if($('meName'))$('meName').textContent=ME;pullTheme();setTimeout(autoRefresh,6000);setTimeout(()=>usage(true),9000);};
const _loadAllItems=loadAllItems;loadAllItems=async function(){
  try{await _loadAllItems();localStorage.setItem('wl_cache',JSON.stringify(items));}
  catch(e){const c=localStorage.getItem('wl_cache');if(!c)throw e;items=JSON.parse(c);setSyncState('error','офлайн');}
  Object.values(items).forEach(i=>SNAP[i.id]=JSON.stringify(i));
};

/* ===== карточки ===== */
function renderList(){
  renderTabs();
  const list=$('list'),all=Object.values(items);
  let arr=all.filter(i=>i.cat===currentTab);
  if(curStatus!=='all')arr=arr.filter(i=>sOf(i)===curStatus);
  else if(currentFilter==='done')arr=arr.filter(i=>sOf(i)==='done');
  else if(currentFilter==='todo')arr=arr.filter(i=>sOf(i)!=='done');
  if(searchQuery)arr=arr.filter(i=>(i.title+' '+(i.note||'')+' '+(i.tags||'')).toLowerCase().includes(searchQuery));
  if(curColl!=='all')arr=arr.filter(i=>i.coll===curColl);if(curFr!=='all')arr=all.filter(i=>i.franchise===curFr);arr=arr.filter(smartOk).filter(i=>showArch?i.archived:!i.archived);updFr();arr=sortItems(arr);updColl();
  getAllCats().forEach(c=>{const n=all.filter(i=>i.cat===c.id&&sOf(i)!=='done').length,el=$('badge-'+c.id);if(el){el.textContent=n;el.classList.toggle('show',n>0);}});
  const cat=all.filter(i=>i.cat===currentTab),d=cat.filter(i=>sOf(i)==='done').length;
  [['stat-total',cat.length],['stat-done',d],['stat-left',cat.length-d]].forEach(([id,v])=>{const e=$(id);if(e)e.textContent=v;});
  if(!arr.length){list.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-icon">${C.icons?.empty?`<img src="${C.icons.empty}" style="width:64px;height:64px;border-radius:14px;object-fit:cover">`:'📂'}</div><p>Здесь пока пусто</p><button class="btn btn-primary" style="margin-top:14px;max-width:200px" onclick="openModal()">+ Добавить</button></div>`;return;}
  const ic=C.icons||{};
  lastTotal=arr.length;arr=arr.slice(0,shown);list.innerHTML=arr.map(i=>{
    const st=sOf(i),rs=Object.entries(i.ratings||{}).filter(([,v])=>v>0).map(([k,v])=>esc(k)+' '+v).join(' · ');
    const prog=(st==='watching'&&EP.includes(i.cat))?`<span>S${i.season||1} · ${i.episode||0}${i.total?'/'+i.total:''}<button class="pp" onclick="bump('${i.id}')">+1</button></span>`:'';
    const tags=(i.tags||'').split(',').map(t=>t.trim()).filter(Boolean).map(t=>`<span class="tg">${esc(t)}</span>`).join('');
    const w=Object.keys(i.wants||{});return `<div class="item st-${st}${w.length>1?' both':''}">
      ${i.poster?`<img class="poster" loading="lazy" src="${esc(i.poster)}" onerror="this.remove()">`:''}
      <div class="check" onclick="toggleDone('${i.id}')">${st==='done'?(ic.check?`<img src="${ic.check}">`:'✓'):''}</div>
      <div class="item-body"><div class="item-title" style="cursor:pointer" onclick="openInfo('${i.id}')">${esc(i.title)}</div>
        ${i.note?`<div class="item-meta">${esc(i.note)}</div>`:''}
        <div class="chips"><span class="stb" onclick="cycleStatus('${i.id}')">${ST[st]}</span><span class="stb" onclick="toggleWant('${i.id}')">${w.length?'💗 '+w.map(esc).join(', '):'🤍 хочу'}</span>${i.coll?'<span class="tg">📁 '+esc(i.coll)+'</span>':''}${i.franchise?`<span class="tg" style="cursor:pointer" data-f="${esc(i.franchise)}" onclick="setFr(this.dataset.f)">🔗 ${esc(i.franchise)} ${frProg(i.franchise)}</span>`:''}${i.fear?`<span>${'💀'.repeat(i.fear)}</span>`:''}${i.scary?'<span>😱 скримеры</span>':''}${prog}${rs?`<span class="rt">⭐ ${rs}</span>`:''}${i.added_by?`<span>+${esc(i.added_by)}</span>`:''}</div>
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

/* ===== форма ===== */
function fillForm(i){
  const v=(id,x)=>$(id).value=x??'';
  $('modalTitle').textContent=i.id?'Редактировать':'Добавить';
  v('inputTitle',i.title);v('inputNote',i.note);v('inputLink',i.link);
  rebuildCatSelect();$('inputCat').value=i.cat||currentTab;
  v('fStatus',sOf(i));v('fSeason',i.season||'');v('fEpisode',i.episode||'');v('fTotal',i.total||'');
  v('fRating',(i.ratings||{})[ME]||'');v('fTags',i.tags);v('fPoster',i.poster);v('fColl',i.coll);_pick=null;$('sug').innerHTML='';v('fFr',i.franchise);
  $('overlay').classList.add('open');setTimeout(()=>$('inputTitle').focus(),80);
}
function openModal(){editingId=null;fillForm({});}
function editItem(id){const i=items[id];if(!i)return;editingId=id;fillForm(i);}
async function saveItem(){
  const title=$('inputTitle').value.trim();if(!title){$('inputTitle').focus();return;}
  const old=editingId?items[editingId]:null,st=$('fStatus').value,rate=parseFloat($('fRating').value)||0,cat=$('inputCat').value||currentTab;
  const ratings={...(old&&old.ratings||{})};if(rate>0)ratings[ME]=rate;else delete ratings[ME];
  const btn=$('saveBtn');btn.disabled=true;btn.textContent='Сохраняем...';
  let poster=$('fPoster').value.trim();
  if(!poster)poster=await findPoster(title,cat);
  const base=old||{id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),ts:Date.now(),added_by:ME};
  const item={...base,cat,title,note:$('inputNote').value.trim(),link:$('inputLink').value.trim(),status:st,done:st==='done',
    season:+$('fSeason').value||0,episode:+$('fEpisode').value||0,total:+$('fTotal').value||0,ratings,tags:$('fTags').value.trim(),poster,coll:$('fColl').value.trim(),franchise:$('fFr').value.trim(),...(_pick&&!old?{info:{ts:1,year:_pick.year||'',genres:_pick.genres||'',desc:_pick.desc||'',score:_pick.score||'',trailer:_pick.trailer||''}}:{})};
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
function playBeep(){if(!FX().sound)return;try{au=au||new AudioContext();const o=au.createOscillator(),g=au.createGain();o.frequency.value=660;g.gain.setValueAtTime(.08,au.currentTime);g.gain.exponentialRampToValueAtTime(.001,au.currentTime+.15);o.connect(g);g.connect(au.destination);o.start();o.stop(au.currentTime+.15);}catch(e){}}

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

/* ===== v3: облако (Storage + settings), постеры TMDB/RAWG, прокрутка вкладок ===== */
async function upload(f,kind){
  const path=`${kind}/${(ME||'x').replace(/\W/g,'')}-${Date.now()}.${(f.name.split('.').pop()||'bin').toLowerCase()}`;
  const r=await fetch(`${SUPA_URL}/storage/v1/object/media/${path}`,{method:'POST',headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,'Content-Type':f.type||'application/octet-stream','x-upsert':'true'},body:f});
  if(!r.ok)throw new Error(await r.text());
  return `${SUPA_URL}/storage/v1/object/public/media/${path}`;
}
async function shrink(f,max){const b=await createImageBitmap(f),k=Math.min(1,max/Math.max(b.width,b.height)),c=document.createElement('canvas');c.width=Math.round(b.width*k);c.height=Math.round(b.height*k);c.getContext('2d').drawImage(b,0,0,c.width,c.height);return c.toDataURL('image/webp',.85);}
async function loadBg(inp){
  const f=inp.files[0];if(!f)return;toast('Загружаю фон…');
  try{C.bg=await upload(f,'bg');C.bgGrad=false;$('bgGradToggle').checked=false;saveCustom();applyBg();toast('Фон загружен без потери качества');}
  catch(e){toast('Не вышло загрузить: выполни SQL для хранилища');}
}
async function loadIcon(inp,key){const f=inp.files[0];if(!f)return;C.icons[key]=await shrink(f,96);saveCustom();applyAllIcons();}
async function upPoster(inp){const f=inp.files[0];if(!f)return;try{$('fPoster').value=await upload(f,'poster');}catch(e){toast('Не вышло загрузить постер');}}

async function pushTheme(){
  try{const d={...C};if(d.bg&&d.bg.startsWith('data:'))d.bg=null;const ts=Date.now();
    await sbFetch('/settings',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({id:'theme_'+ME,data:d,updated_at:ts})});
    localStorage.setItem('wl_theme_ts',ts);}catch(e){}
}
async function pullTheme(){
  try{const r=await sbFetch('/settings?id=eq.'+encodeURIComponent('theme_'+ME)),row=r&&r[0];
    if(!row)return pushTheme();
    if(row.updated_at>(+localStorage.getItem('wl_theme_ts')||0)){
      C={...JSON.parse(JSON.stringify(CD)),...row.data};C.icons={...CD.icons,...C.icons};
      localStorage.setItem('wl_custom',JSON.stringify(C));localStorage.setItem('wl_theme_ts',row.updated_at);
      applyCustom();syncControls();fxSync();fxStart();renderIconPreviews();render();}
  }catch(e){}
}
const _sc=saveCustom;saveCustom=function(){try{_sc();}catch(e){}clearTimeout(saveCustom._t);saveCustom._t=setTimeout(pushTheme,1500);};

addEventListener('load',()=>{
  const css=document.createElement('style');
  css.textContent='.cp-tabs{flex-wrap:wrap;overflow:visible}.cp-tab{padding:9px 12px}';
  document.head.appendChild(css);
  $('fPoster').insertAdjacentHTML('afterend','<button type="button" class="upload-btn" style="margin-top:6px" onclick="$(\'fPosterFile\').click()">📁 Загрузить с устройства</button><input type="file" id="fPosterFile" accept="image/*" onchange="upPoster(this)">');
  document.querySelector('[data-page="fx"]').insertAdjacentHTML('beforeend',`<div class="sep"></div><div class="cs"><div class="cs-title">Постеры</div>
   <button class="upload-btn" onclick="fillPosters()">🖼 Найти постеры для всех без обложки</button>
   <div style="font-size:11px;color:var(--text3)">Источники: Shikimori, iTunes, Википедия. Ключи не нужны.</div></div>`);
});

/* ===== v4: хотим оба, карточка-детали, статистика, импорт, обои из сети ===== */
let curColl='all',infoId=null;
function updColl(){const s=$('collSel');if(!s)return;const cs=[...new Set(Object.values(items).filter(i=>i.cat===currentTab&&i.coll).map(i=>i.coll))];
  const h='<option value="all">Все коллекции</option>'+cs.map(c=>`<option>${esc(c)}</option>`).join('');if(s.dataset.h!==h){s.innerHTML=h;s.dataset.h=h;}
  if(!cs.includes(curColl))curColl='all';s.value=curColl;}
function toggleWant(id){const w={...(items[id].wants||{})};if(w[ME])delete w[ME];else w[ME]=1;beep();patch(id,{wants:w});}
function react(id,e){const r={...(items[id].reacts||{})},n=[...(r[e]||[])],k=n.indexOf(ME);if(k<0)n.push(ME);else n.splice(k,1);r[e]=n;patch(id,{reacts:r});}
function addCmt(){const t=$('cmt').value.trim();if(!t)return;patch(infoId,{comments:[...(items[infoId].comments||[]),{by:ME,text:t,ts:Date.now()}]});}
async function openInfo(id){
  const i=items[id];if(!i)return;infoId=id;$('info').classList.add('open');drawInfo();
  if(!i.info||!i.info.ts||(!i.info.poster&&!i.poster)){const inf=await findInfo(i),c=items[id];if(c)patch(id,{info:inf,poster:c.poster||inf.poster||'',total:c.total||inf.eps||0});}
}
function showTrl(){$('trl').innerHTML=`<iframe src="${esc(items[infoId].info.trailer)}" allowfullscreen style="width:100%;aspect-ratio:16/9;border:0;border-radius:10px"></iframe>`;}
function drawInfoMain(){
  const i=items[infoId],f=i.info||{},rc=i.reacts||{},pic=i.poster||f.poster;
  $('infoBody').innerHTML=`<div style="display:flex;gap:12px">${pic?`<img class="poster" style="width:90px;height:128px" src="${esc(pic)}">`:''}<div><h3 style="margin:0 0 6px">${esc(i.title)}</h3><div class="chips">${f.year?`<span>${esc(f.year)}</span>`:''}${f.genres?`<span>${esc(f.genres)}</span>`:''}${f.score?`<span class="rt">⭐ ${f.score}</span>`:''}</div></div></div>
  ${f.desc?`<p style="font-size:13px;color:var(--text2);line-height:1.5;max-height:140px;overflow:auto">${esc(f.desc)}</p>`:(f.ts?'':'<p style="color:var(--text3)">Загружаю описание…</p>')}
  ${f.trailer?`<div id="trl"><button class="upload-btn" onclick="showTrl()">▶️ Трейлер</button></div>`:''}
  <div class="cr" style="margin:10px 0"><span class="cl">Дата просмотра</span><input type="date" value="${esc(i.watched_on||'')}" onchange="patch('${i.id}',{watched_on:this.value})"><label style="font-size:12px"><input type="checkbox" ${i.together?'checked':''} onchange="patch('${i.id}',{together:this.checked})"> вместе</label></div>
  <div class="chips">${['👍','😂','😱','😢','🔥'].map(e=>{const n=rc[e]||[];return `<span class="stb" style="${n.includes(ME)?'outline:1px solid var(--accent)':''}" onclick="react('${i.id}','${e}')">${e} ${n.length||''}</span>`;}).join('')}</div>
  <div style="margin:10px 0">${(i.comments||[]).map(c=>`<div style="font-size:12px;margin:4px 0"><b>${esc(c.by)}:</b> ${esc(c.text)}</div>`).join('')}</div>
  <div class="cr"><input id="cmt" class="cp-select" placeholder="Комментарий…" onkeydown="if(event.key==='Enter')addCmt()"><button class="upload-btn" onclick="addCmt()">➤</button></div>`;
}
function roulette(){
  const all=$('rouAll').checked,t=$('rouTitle');
  const pool=Object.values(items).filter(i=>sOf(i)==='want'&&(all||i.cat===currentTab)&&(!$('rouBoth').checked||Object.keys(i.wants||{}).length>1));
  $('rou').classList.add('open');t.classList.remove('win');
  if(!pool.length){t.textContent='Подходящих нет';return;}
  let n=0;clearInterval(roulette._t);
  roulette._t=setInterval(()=>{t.textContent=pool[Math.floor(Math.random()*pool.length)].title;if(++n>22){clearInterval(roulette._t);t.classList.add('win');beep();}},90);
}
function night(){
  const all=$('rouAll').checked,p=Object.values(items).filter(i=>sOf(i)==='want'&&(all||i.cat===currentTab)&&(!$('rouBoth').checked||Object.keys(i.wants||{}).length>1)).sort(()=>Math.random()-.5).slice(0,3);
  $('rouPicks').innerHTML=p.map(i=>`<div class="pick" onclick="setStatus('${i.id}','watching');$('rou').classList.remove('open')">${i.poster?`<img src="${esc(i.poster)}">`:''}<span>${esc(i.title)}</span></div>`).join('')||'<small>Пусто</small>';
}
function bars(o,max){return Object.entries(o).map(([k,v])=>`<div class="br"><span>${esc(k)}</span><div class="bw"><i style="width:${Math.max(3,v/max*100)}%"></i></div><b>${v}</b></div>`).join('');}
function stats(){
  const all=Object.values(items),done=all.filter(i=>sOf(i)==='done'),yr=new Date().getFullYear(),cats={},g={},m={},rt={};
  getAllCats().forEach(c=>cats[c.name]=done.filter(i=>i.cat===c.id).length);
  done.forEach(i=>(i.info?.genres||'').split(',').map(x=>x.trim()).filter(Boolean).forEach(x=>g[x]=(g[x]||0)+1));
  const top=Object.fromEntries(Object.entries(g).sort((a,b)=>b[1]-a[1]).slice(0,6));
  for(let k=1;k<=12;k++)m[k]=0;done.forEach(i=>{const d=new Date(i.watched_on||i.ts);if(d.getFullYear()===yr)m[d.getMonth()+1]++;});
  all.forEach(i=>Object.entries(i.ratings||{}).forEach(([n,v])=>(rt[n]=rt[n]||[]).push(v)));
  const avg=Object.fromEntries(Object.entries(rt).map(([n,a])=>[n,+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1)]));
  const mx=o=>Math.max(1,...Object.values(o));
  $('statsBody').innerHTML=`<h3 style="margin-top:0">Итоги ${yr}</h3><p>Просмотрено всего: <b>${done.length}</b> · вместе: <b>${done.filter(i=>i.together).length}</b></p><h4>По категориям</h4>${bars(cats,mx(cats))}<h4>Жанры</h4>${bars(top,mx(top))||'<small>Открой карточки, чтобы подтянулись жанры</small>'}<h4>По месяцам</h4>${bars(m,mx(m))}<h4>Средняя оценка</h4>${bars(avg,10)||'<small>Оценок пока нет</small>'}`;
  $('stats').classList.add('open');
}
async function doImport(){
  let t=$('impText').value;const f=$('impFile').files[0];if(f)t=await f.text();let L=[];
  if(t.trim().startsWith('<')){const st={Completed:'done',Watching:'watching','On-Hold':'later',Dropped:'dropped'};L=[...new DOMParser().parseFromString(t,'text/xml').querySelectorAll('anime')].map(a=>({t:a.querySelector('series_title')?.textContent,c:'anime',s:st[a.querySelector('my_status')?.textContent]||'want'}));}
  else{const R=t.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),sp=l=>[...l.matchAll(/"([^"]*)"|([^,]+)/g)].map(m=>m[1]??m[2]);
    if(R[0]&&R[0].includes(',')&&/name/i.test(R[0])){const k=sp(R[0]).findIndex(x=>/^name$/i.test(x));L=R.slice(1).map(l=>({t:sp(l)[k],c:currentTab,s:'done'}));}
    else L=R.map(x=>({t:x,c:currentTab,s:'want'}));}
  const have=new Set(Object.values(items).map(i=>i.title.toLowerCase()));
  const rows=L.filter(x=>x.t&&!have.has(x.t.toLowerCase())).map((x,k)=>({id:Date.now().toString(36)+k.toString(36)+Math.random().toString(36).slice(2,5),cat:x.c,title:x.t,note:'',link:'',status:x.s,done:x.s==='done',ts:Date.now()+k,added_by:ME}));
  if(!rows.length){toast('Нечего импортировать');return;}
  rows.forEach(r=>items[r.id]=r);render();$('imp').classList.remove('open');$('impText').value='';
  try{await sbFetch('/items',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify(rows)});toast('Добавлено: '+rows.length);}catch(e){toast('Ошибка импорта');}
}
function setBgUrl(u){u=(u||$('urlBg').value).trim();if(!u)return;C.bg=u;C.bgGrad=false;$('bgGradToggle').checked=false;saveCustom();applyBg();toast('Обои установлены');}
async function whSearch(){
  const q=encodeURIComponent($('whQ').value.trim()),r=$('whRes');r.textContent='Ищу…';
  try{const d=await(await fetch(`https://wallhaven.cc/api/v1/search?q=${q}&sorting=${$('whS').value}&categories=111&purity=100&atleast=1280x720`)).json();
    r.innerHTML=(d.data||[]).slice(0,24).map(x=>`<img loading="lazy" src="${x.thumbs.small}" onclick="setBgUrl('${x.path}')">`).join('')||'Ничего не найдено';}
  catch(e){r.textContent='Wallhaven недоступен. Вставь прямую ссылку на картинку ниже.';}
}
addEventListener('load',()=>{
  const css=document.createElement('style');
  css.textContent=`.both{box-shadow:inset 0 0 0 2px #ff6fa5}.whgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.whgrid img{width:100%;height:64px;object-fit:cover;border-radius:6px;cursor:pointer}
  .br{display:flex;align-items:center;gap:8px;font-size:12px;margin:4px 0}.br span{width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bw{flex:1}.bw i{display:block;height:8px;background:var(--accent);border-radius:4px}
  .pick{display:inline-block;width:30%;margin:4px;cursor:pointer;font-size:12px;vertical-align:top}.pick img{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:8px}`;
  document.head.appendChild(css);
  const cl="if(event.target===this)this.classList.remove('open')";
  document.body.insertAdjacentHTML('beforeend',`
   <div id="info" class="overlay" onclick="${cl}"><div class="modal" id="infoBody"></div></div>
   <div id="stats" class="overlay" onclick="${cl}"><div class="modal" id="statsBody"></div></div>
   <div id="imp" class="overlay" onclick="${cl}"><div class="modal"><div class="modal-title">📥 Импорт в текущую категорию</div>
    <div class="field"><label>Названия, по одному в строке</label><textarea id="impText" style="height:110px"></textarea></div>
    <div class="field"><label>или файл: Letterboxd CSV / MyAnimeList XML</label><input type="file" id="impFile" accept=".csv,.xml,.txt" style="display:block"></div>
    <div class="btn-row"><button class="btn btn-secondary" onclick="$('imp').classList.remove('open')">Закрыть</button><button class="btn btn-primary" onclick="doImport()">Импортировать</button></div></div></div>`);
  $('rouAll').parentElement.insertAdjacentHTML('afterend','<br><label style="font-size:12px;color:var(--text2)"><input type="checkbox" id="rouBoth"> только «хотим оба»</label><div id="rouPicks"></div><button class="upload-btn" style="margin-top:8px" onclick="night()">🍿 3 варианта на вечер</button>');
  $('fPoster').closest('.field').insertAdjacentHTML('afterend','<div class="field"><label>Коллекция</label><input id="fColl" placeholder="например: Ужастики на Хэллоуин"></div>');
  document.querySelector('.toolbar').insertAdjacentHTML('beforeend','<select id="collSel" class="sort-select" onchange="curColl=this.value;render()"></select><button class="filter-btn" onclick="stats()">📊</button><button class="filter-btn" onclick="$(\'imp\').classList.add(\'open\')">📥</button>');
  document.querySelector('[data-page="bg"]').insertAdjacentHTML('beforeend',`<div class="sep"></div><div class="cs"><div class="cs-title">Обои из интернета</div>
   <div class="cr"><input id="whQ" class="cp-select" placeholder="Wallhaven: anime, sakura, forest…" onkeydown="if(event.key==='Enter')whSearch()"><button class="upload-btn" onclick="whSearch()">Найти</button></div>
   <select id="whS" class="cp-select"><option value="relevance">Релевантные</option><option value="toplist">Топ</option><option value="random">Случайные</option><option value="views">По просмотрам</option></select>
   <div id="whRes" class="whgrid"></div>
   <div class="cs-title">Своя ссылка на картинку</div>
   <div class="cr"><input id="urlBg" class="cp-select" placeholder="Pinterest (i.pinimg.com), Imgur и др."><button class="upload-btn" onclick="setBgUrl()">Поставить</button></div>
   <div style="font-size:11px;color:var(--text3)">Pinterest: открой пин, ПКМ по картинке, «Копировать адрес изображения» (i.pinimg.com…). Ссылка на страницу пина не подойдёт.</div></div>`);
  updColl();
});

/* ===== v5: постеры без ключей (Shikimori, iTunes, Википедия) ===== */
const J=async u=>(await fetch(u)).json();
const SRC={
  async shiki(q){
    for(const h of ['shikimori.one','shikimori.me','shikimori.io']){
      try{const a=await J(`https://${h}/api/animes?limit=4&search=${encodeURIComponent(q)}`);
        const r=a.map(x=>({title:x.russian||x.name,poster:x.image?.original?`https://${h}${x.image.original}`:'',year:(x.aired_on||'').slice(0,4),score:+x.score||'',eps:x.episodes||0}));
        if(a[0]){try{const d=await J(`https://${h}/api/animes/${a[0].id}`);r[0].genres=(d.genres||[]).map(g=>g.russian||g.name).join(', ');r[0].desc=(d.description||'').replace(/\[[^\]]*\]/g,'').slice(0,600);}catch(e){}}
        return r;}catch(e){}
    }return[];
  },
  async jikan(q){try{return((await J('https://api.jikan.moe/v4/anime?limit=4&q='+encodeURIComponent(q))).data||[]).map(x=>({title:x.title_english||x.title,poster:x.images?.jpg?.image_url||'',year:x.year||'',genres:(x.genres||[]).map(g=>g.name).join(', '),desc:x.synopsis||'',score:x.score||'',eps:x.episodes||0,trailer:x.trailer?.embed_url||''}));}catch(e){return[];}},
  async itunes(q,cat){try{const m=cat==='series'?'tvShow':'movie',e=cat==='series'?'tvSeason':'movie';
    return((await J(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=${m}&entity=${e}&country=ru&limit=4`)).results||[]).map(x=>({title:x.trackName||x.collectionName,poster:(x.artworkUrl100||'').replace('100x100bb','400x600bb'),year:(x.releaseDate||'').slice(0,4),genres:x.primaryGenreName||'',desc:x.longDescription||x.shortDescription||''}));}catch(e){return[];}},
  async wiki(q,cat){
    const w={anime:'аниме',films:'фильм',series:'сериал',games:'игра'}[cat]||'';
    for(const l of ['ru','en']){
      try{const d=await J(`https://${l}.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=4&gsrsearch=${encodeURIComponent(q+' '+(l==='ru'?w:''))}&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=300&exintro=1&explaintext=1&exsentences=3&format=json&origin=*`);
        const r=Object.values(d.query?.pages||{}).sort((a,b)=>a.index-b.index).map(p=>({title:p.title,poster:p.thumbnail?.source||'',desc:p.extract||''})).filter(x=>x.poster);
        if(r.length)return r;}catch(e){}
    }return[];
  }
};
async function cands(q,cat){
  const o=cat==='anime'?['shiki','jikan','wiki']:cat==='games'?['wiki']:['itunes','wiki'],out=[];
  for(const k of o){out.push(...(await SRC[k](q,cat)).filter(x=>x.poster));if(out.length>=6)break;}
  return out;
}
async function lookup(i){const b=(await cands(i.title,i.cat))[0]||{};return{ts:1,poster:b.poster||'',year:b.year||'',genres:b.genres||'',desc:b.desc||'',score:b.score||'',eps:b.eps||0,trailer:b.trailer||''};}
async function findPoster(q,cat){return(await lookup({title:q,cat})).poster;}
async function findInfo(i){return lookup(i);}
async function fillPosters(){
  const todo=Object.values(items).filter(i=>!i.poster);let n=0,ok=0;toast('Ищу постеры…');
  for(const i of todo){const f=await lookup(i);n++;
    if(f.poster){items[i.id]={...i,poster:f.poster,info:f,total:i.total||f.eps||0};ok++;try{await upsertItem(items[i.id]);}catch(e){}}
    if(n%4==0){render();toast(`Постеры: ${ok} из ${n} (всего ${todo.length})`);}
    await new Promise(r=>setTimeout(r,700));}
  render();toast(`Готово: найдено ${ok} из ${n}`);
}
function infoPosterPicker(){
  $('infoBody').insertAdjacentHTML('beforeend','<div style="margin-top:12px"><div class="cr"><input id="pq" class="cp-select" placeholder="Название для поиска (англ. или оригинал)"><button class="upload-btn" onclick="pickPoster()">🖼 Найти</button></div><div id="posterPick" class="whgrid" style="margin-top:8px"></div></div>');}
async function pickPoster(){
  const i=items[infoId],g=$('posterPick');g.textContent='Ищу…';
  const c=await cands(($('pq').value.trim())||i.title,i.cat);
  g.innerHTML=c.map(x=>`<img src="${esc(x.poster)}" style="height:110px" onclick="patch('${i.id}',{poster:'${x.poster}'})">`).join('')||'Не нашлось. Попробуй другое название или вставь ссылку в форме.';
}

/* ===== v6: умное добавление, добавление по ссылке, сетка серий, франшизы, хоррор-метр, умные фильтры ===== */
let _pick=null,sugT,curFr='all',SF={};
function frProg(f){const a=Object.values(items).filter(i=>i.franchise===f);return a.filter(i=>sOf(i)==='done').length+'/'+a.length;}
function setFr(f){curFr=f;render();}
function updFr(){const s=$('frSel');if(!s)return;const fs=[...new Set(Object.values(items).map(i=>i.franchise).filter(Boolean))];
  const h='<option value="all">Все франшизы</option>'+fs.map(c=>`<option>${esc(c)}</option>`).join('');
  if(s.dataset.h!==h){s.innerHTML=h;s.dataset.h=h;$('frList').innerHTML=fs.map(c=>`<option value="${esc(c)}">`).join('');}
  if(!fs.includes(curFr))curFr='all';s.value=curFr;s.style.display=fs.length?'':'none';}

/* 18: добавление по ссылке */
async function fromLink(u){
  try{let m;
    if(m=u.match(/shikimori\.[a-z]+\/animes\/[a-z]?(\d+)/)){const d=await J(`https://shikimori.one/api/animes/${m[1]}`);return{title:d.russian||d.name,poster:d.image?.original?'https://shikimori.one'+d.image.original:'',year:(d.aired_on||'').slice(0,4),genres:(d.genres||[]).map(g=>g.russian||g.name).join(', '),desc:(d.description||'').replace(/\[[^\]]*\]/g,'').slice(0,600),score:+d.score||'',eps:d.episodes||0,cat:'anime',url:u};}
    if(m=u.match(/myanimelist\.net\/anime\/(\d+)/)){const x=(await J(`https://api.jikan.moe/v4/anime/${m[1]}`)).data;return{title:x.title_english||x.title,poster:x.images?.jpg?.image_url||'',year:x.year||'',genres:(x.genres||[]).map(g=>g.name).join(', '),desc:x.synopsis||'',score:x.score||'',eps:x.episodes||0,trailer:x.trailer?.embed_url||'',cat:'anime',url:u};}
    if(m=u.match(/(\w+)\.wikipedia\.org\/wiki\/([^#?]+)/)){const d=await J(`https://${m[1]}.wikipedia.org/w/api.php?action=query&titles=${m[2]}&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=300&exintro=1&explaintext=1&exsentences=3&format=json&origin=*`),p=Object.values(d.query.pages)[0];return{title:p.title,poster:p.thumbnail?.source||'',desc:p.extract||'',url:u};}
    if(m=u.match(/apple\.com\/.*?\/id(\d+)/)){const x=(await J(`https://itunes.apple.com/lookup?id=${m[1]}&country=ru`)).results?.[0];if(x)return{title:x.trackName||x.collectionName,poster:(x.artworkUrl100||'').replace('100x100bb','400x600bb'),year:(x.releaseDate||'').slice(0,4),genres:x.primaryGenreName||'',desc:x.longDescription||'',cat:x.kind==='feature-movie'?'films':'series',url:u};}
    if(m=u.match(/letterboxd\.com\/film\/([^/]+)/)){const c=await cands(m[1].replace(/-/g,' '),'films');return c[0]?{...c[0],cat:'films',url:u}:null;}
  }catch(e){}
  return null;
}
/* 9: умное добавление */
function onTitle(){
  clearTimeout(sugT);_pick=null;const v=$('inputTitle').value.trim(),box=$('sug');
  if(editingId||v.length<2){box.innerHTML='';return;}
  sugT=setTimeout(async()=>{
    box.textContent='Ищу…';
    const c=/^https?:\/\//.test(v)?[await fromLink(v)].filter(Boolean):await cands(v,$('inputCat').value||currentTab);
    if(!c.length){box.textContent=/^https?:/.test(v)?'Для этой ссылки нет открытого API. Введи название':'Ничего не нашлось';return;}
    window._cs=c;box.innerHTML=c.slice(0,6).map((x,k)=>`<div class="pick2" onclick="takePick(${k})"><img src="${esc(x.poster)}"><span>${esc(x.title||'')}${x.year?' · '+x.year:''}</span></div>`).join('');
  },450);
}
function takePick(k){
  const x=window._cs[k];_pick=x;$('inputTitle').value=x.title||$('inputTitle').value;$('fPoster').value=x.poster||'';
  if(!$('fTotal').value&&x.eps)$('fTotal').value=x.eps;if(x.cat)$('inputCat').value=x.cat;if(x.url&&!$('inputLink').value)$('inputLink').value=x.url;
  $('sug').innerHTML='';
}
/* 10: сетка серий */
function bump(id){const i=items[id],S=i.season||1,seen={...(i.seen||{})},a=new Set(seen[S]||[]),n=(i.episode||0)+1;a.add(n);seen[S]=[...a].sort((x,y)=>x-y);patch(id,{episode:n,seen});beep();}
function togEp(n){
  const i=items[infoId],S=i.season||1,seen={...(i.seen||{})},a=new Set(seen[S]||[]);a.has(n)?a.delete(n):a.add(n);seen[S]=[...a].sort((x,y)=>x-y);
  const o={seen,episode:seen[S].length?Math.max(...seen[S]):0};if(a.size&&sOf(i)==='want')o.status='watching';
  if(i.total&&a.size>=i.total)toast('Сезон '+S+' досмотрен 🎉');patch(infoId,o);beep();
}
function setSeason(d){const i=items[infoId],S=Math.max(1,(i.season||1)+d);patch(infoId,{season:S,episode:Math.max(0,...((i.seen||{})[S]||[0]))});}
function setFear(n){patch(infoId,{fear:n});}
function infoEpisodesAndFear(){
  const i=items[infoId];if(!i)return;
  const S=i.season||1,seen=new Set((i.seen||{})[S]||[]),T=Math.min(+i.total||0,300);let h='';
  if(EP.includes(i.cat))h+=`<div class="cs-title" style="margin-top:12px">Сезон <button class="upload-btn" onclick="setSeason(-1)">◀</button> ${S} <button class="upload-btn" onclick="setSeason(1)">▶</button> · просмотрено ${seen.size}${T?'/'+T+', осталось '+Math.max(0,T-seen.size):''}</div>`+(T?`<div class="eg">${Array.from({length:T},(_,k)=>`<b class="${seen.has(k+1)?'on':''}" onclick="togEp(${k+1})">${k+1}</b>`).join('')}</div>`:'<small style="color:var(--text3)">Укажи «Всего серий» в форме редактирования</small>');
  h+=`<div class="cs-title" style="margin-top:12px">Насколько страшно</div><div class="chips">${[1,2,3,4,5].map(n=>`<span class="stb" style="${(i.fear||0)>=n?'background:var(--accent-glow)':''}" onclick="setFear(${n})">💀</span>`).join('')}<span class="stb" onclick="setFear(0)">сброс</span><label style="font-size:12px"><input type="checkbox" ${i.scary?'checked':''} onchange="patch(infoId,{scary:this.checked})"> скримеры</label></div>`;
  $('infoBody').firstElementChild.insertAdjacentHTML('afterend',h);
}
/* 19: умные фильтры */
const avgR=i=>{const r=Object.values(i.ratings||{}).filter(v=>v>0);return r.length?r.reduce((a,b)=>a+b,0)/r.length:(+i.info?.score||0);};
function smartOk(i){
  const f=SF,y=+i.info?.year||0;
  if(f.r&&avgR(i)<f.r)return false;if(f.y1&&(!y||y<f.y1))return false;if(f.y2&&(!y||y>f.y2))return false;
  if(f.g&&!(i.info?.genres||'').toLowerCase().includes(f.g))return false;if(f.t&&!(i.tags||'').toLowerCase().includes(f.t))return false;
  if(f.f&&(i.fear||0)<f.f)return false;if(f.s==='1'&&!i.scary)return false;if(f.s==='0'&&i.scary)return false;return true;
}
function readFlt(){SF={r:+$('sfR').value||0,y1:+$('sfY1').value||0,y2:+$('sfY2').value||0,g:$('sfG').value.trim().toLowerCase(),t:$('sfT').value.trim().toLowerCase(),f:+$('sfF').value||0,s:$('sfS').value};}
function writeFlt(){$('sfR').value=SF.r||'';$('sfY1').value=SF.y1||'';$('sfY2').value=SF.y2||'';$('sfG').value=SF.g||'';$('sfT').value=SF.t||'';$('sfF').value=SF.f||'';$('sfS').value=SF.s||'';}
function applyFlt(){readFlt();$('flt').classList.remove('open');render();$('fltBtn').style.outline=Object.values(SF).some(Boolean)?'2px solid var(--accent)':'';}
function resetFlt(){SF={};writeFlt();applyFlt();}
function saveView(){readFlt();const n=(prompt('Название вида?')||'').trim();if(!n)return;const v=JSON.parse(localStorage.getItem('wl_views')||'{}');v[n]=SF;localStorage.setItem('wl_views',JSON.stringify(v));drawViews();}
function useView(n){SF=JSON.parse(localStorage.getItem('wl_views')||'{}')[n]||{};writeFlt();applyFlt();}
function drawViews(){$('views').innerHTML=Object.keys(JSON.parse(localStorage.getItem('wl_views')||'{}')).map(n=>`<span class="stb" data-n="${esc(n)}" onclick="useView(this.dataset.n)">${esc(n)}</span>`).join('');}
addEventListener('load',()=>{
  const css=document.createElement('style');
  css.textContent=`.eg{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}.eg b{width:30px;height:28px;display:grid;place-items:center;font-size:11px;border-radius:6px;background:rgba(255,255,255,.07);cursor:pointer}.eg b.on{background:var(--accent);color:#fff}
  .sug{display:flex;gap:8px;overflow-x:auto;margin:-6px 0 12px;font-size:11px;color:var(--text2)}.pick2{flex:none;width:76px;text-align:center;cursor:pointer}.pick2 img{width:76px;height:108px;object-fit:cover;border-radius:8px}`;
  document.head.appendChild(css);
  $('inputTitle').insertAdjacentHTML('afterend','<div id="sug" class="sug"></div>');
  $('inputTitle').addEventListener('input',onTitle);
  $('fColl').closest('.field').insertAdjacentHTML('afterend','<div class="field"><label>Франшиза (общая для частей)</label><input id="fFr" list="frList" placeholder="Silent Hill"><datalist id="frList"></datalist></div>');
  document.querySelector('.toolbar').insertAdjacentHTML('beforeend','<select id="frSel" class="sort-select" onchange="curFr=this.value;render()" style="display:none"></select><button id="fltBtn" class="filter-btn" onclick="$(\'flt\').classList.add(\'open\')">🔎</button>');
  document.body.insertAdjacentHTML('beforeend',`<div id="flt" class="overlay" onclick="if(event.target===this)this.classList.remove('open')"><div class="modal"><div class="modal-title">🔎 Умные фильтры</div>
   <div class="field row3"><div><label>Оценка от</label><input id="sfR" type="number" min="0" max="10" step=".5"></div><div><label>Год от</label><input id="sfY1" type="number"></div><div><label>Год до</label><input id="sfY2" type="number"></div></div>
   <div class="field row3"><div><label>Жанр</label><input id="sfG"></div><div><label>Тег</label><input id="sfT"></div><div><label>Страх от (0–5)</label><input id="sfF" type="number" min="0" max="5"></div></div>
   <div class="field"><label>Скримеры</label><select id="sfS"><option value="">неважно</option><option value="1">есть</option><option value="0">нет</option></select></div>
   <div id="views" class="chips"></div>
   <div class="btn-row"><button class="btn btn-secondary" onclick="resetFlt()">Сбросить</button><button class="btn btn-secondary" onclick="saveView()">💾 Вид</button><button class="btn btn-primary" onclick="applyFlt()">Применить</button></div></div></div>`);
  drawViews();updFr();
});

/* ===== v7: оформление, вкладки, видео-фон, архив, оптимизация, безопасные сохранения ===== */
document.head.insertAdjacentHTML('beforeend','<style id="userCss"></style>');
const UI0={glow:0,glowC:'#7c5cfc',grad:false,gA:'#7c5cfc',gB:'#ec4899',par:false,parS:20,css:'',nav:false,fabL:false,hide:true,cols:2,dens:1,vib:true,video:''};
const U=()=>{if(!C.ui)C.ui={};for(const k in UI0)if(!(k in C.ui))C.ui[k]=UI0[k];return C.ui;};
let shown=60,lastTotal=0,sig='',showArch=false,px=0;
const io=new IntersectionObserver(e=>{if(e[0].isIntersecting){io.disconnect();shown+=60;render();}});

/* --- применение настроек --- */
function applyUiCore(){
  const u=U(),r=document.documentElement.style,b=document.body.classList;
  r.setProperty('--glow',u.glow+'px');r.setProperty('--glowc',u.glowC);r.setProperty('--ga',u.gA);r.setProperty('--gb',u.gB);r.setProperty('--cols',u.cols);r.setProperty('--dens',u.dens);
  b.toggle('glow',u.glow>0);b.toggle('gradb',!!u.grad);b.toggle('navb',!!u.nav);b.toggle('fabl',!!u.fabL);
  $('userCss').textContent=u.css;if(!u.par)$('bgLayer').style.transform='';
  const h=document.querySelector('header');if(h)r.setProperty('--hh',h.offsetHeight+'px');
  applyVideo();
}
function setU(k,v){U()[k]=v;saveCustom();applyUI();}
function applyVideo(){
  const u=U(),bg=$('bgLayer');let v=$('bgVid');
  if(!u.video){if(v)v.remove();return;}
  if(!v){v=document.createElement('video');v.id='bgVid';v.muted=v.loop=v.playsInline=true;v.autoplay=true;bg.prepend(v);}
  if(v.getAttribute('src')!==u.video)v.src=u.video;v.style.opacity=(C.bgOpacity||100)/100;
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)v.pause();
}
document.addEventListener('visibilitychange',()=>{const v=$('bgVid');if(v)document.hidden?v.pause():v.play().catch(()=>{});});
async function loadVid(inp){const f=inp.files[0];if(!f)return;if(f.size>48e6){toast('Видео больше 48 МБ, лимит хранилища на файл 50 МБ');return;}toast('Загружаю видео…');try{setU('video',await upload(f,'video'));toast('Видео-фон установлен');}catch(e){toast('Не вышло загрузить видео');}}
function par(x,y){const s=U().parS;$('bgLayer').style.transform=`scale(1.12) translate(${x*s}px,${y*s}px)`;}
addEventListener('mousemove',e=>{if(U().par)par((e.clientX/innerWidth-.5)*-1,(e.clientY/innerHeight-.5)*-1);});
addEventListener('deviceorientation',e=>{if(U().par&&e.gamma!=null)par(-Math.max(-1,Math.min(1,e.gamma/30)),-Math.max(-1,Math.min(1,(e.beta-45)/30)));});
function togPar(v){if(v&&window.DeviceOrientationEvent&&DeviceOrientationEvent.requestPermission)DeviceOrientationEvent.requestPermission().catch(()=>{});setU('par',v);}
let ly=0;addEventListener('scroll',()=>{const y=scrollY,hid=U().hide&&y>ly&&y>90,h=document.querySelector('header');if(h)h.classList.toggle('hid',hid);document.body.classList.toggle('hh',hid);ly=y;},{passive:true});
const _ac=applyCustom;applyCustom=function(){_ac();applyUI();};
function beep(){if(U().vib&&navigator.vibrate)navigator.vibrate(12);playBeep();}
addEventListener('keydown',e=>{
  if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.toLowerCase();
  if(k==='n'){e.preventDefault();openModal();}else if(k==='/'){e.preventDefault();$('searchInput').focus();}else if(k==='r')roulette();else if(k==='s')stats();else if(k==='f')$('flt').classList.add('open');
  else if(k==='escape')document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
});

/* --- вкладки (54) и новые категории (78) --- */
const _gac=getAllCats;
getAllCats=function(){const t=C.tabs||{};return _gac().map((c,k)=>({...c,name:t[c.id]?.n||c.name,_o:t[c.id]?.o??k,_h:t[c.id]?.h})).filter(c=>!c._h).sort((a,b)=>a._o-b._o);};
const tabsFull=()=>{const t=C.tabs||{};return _gac().map((c,k)=>({...c,name:t[c.id]?.n||c.name,_o:t[c.id]?.o??k,_h:t[c.id]?.h,_c:t[c.id]?.c})).sort((a,b)=>a._o-b._o);};
const _rt=renderTabs;
renderTabs=function(){const v=getAllCats();if(v.length&&!v.some(c=>c.id===currentTab))currentTab=v[0].id;_rt();
  document.querySelectorAll('.tab').forEach(t=>{const id=t.dataset.cat,c=C.tabs?.[id]?.c||(id.startsWith('cat_')?'var(--accent)':'');
    if(t.classList.contains('active')&&c){t.style.color=c;t.style.borderTop='2px solid '+c;}else{t.style.color='';t.style.borderTop='';}});};
function tabSet(id,k,v){C.tabs=C.tabs||{};C.tabs[id]={...(C.tabs[id]||{}),[k]:v};saveCustom();renderTabs();render();drawTabsEd();}
function tabMove(id,d){const a=tabsFull(),i=a.findIndex(c=>c.id===id),j=i+d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];C.tabs=C.tabs||{};a.forEach((c,k)=>C.tabs[c.id]={...(C.tabs[c.id]||{}),o:k});saveCustom();renderTabs();drawTabsEd();}
function drawTabsEd(){const el=$('tabsEd');if(!el)return;
  el.innerHTML=tabsFull().map(c=>`<div class="cr"><button class="upload-btn" onclick="tabMove('${c.id}',-1)">▲</button><button class="upload-btn" onclick="tabMove('${c.id}',1)">▼</button><input class="cp-select" style="flex:1" value="${esc(c.name)}" onchange="tabSet('${c.id}','n',this.value)"><input type="color" value="${c._c||'#7c5cfc'}" onchange="tabSet('${c.id}','c',this.value)"><label class="toggle" title="Показывать"><input type="checkbox" ${c._h?'':'checked'} onchange="tabSet('${c.id}','h',!this.checked)"><span class="tslider"></span></label></div>`).join('');}
function addPreset(k){const m={books:['📚','Книги'],manga:['📖','Манга'],ranobe:['📕','Ранобэ']}[k];if((C.customCats||[]).some(c=>c.kind===k)){toast('Уже есть');return;}
  C.customCats.push({id:'cat_'+Date.now(),name:m[1],icon:m[0],kind:k});saveCustom();renderTabs();renderCustomCatList();render();drawTabsEd();toast('Добавлена категория «'+m[1]+'»');}
SRC.ol=async q=>{try{return((await J('https://openlibrary.org/search.json?limit=4&q='+encodeURIComponent(q))).docs||[]).filter(d=>d.cover_i).map(d=>({title:d.title,poster:`https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`,year:d.first_publish_year||'',genres:(d.author_name||[]).slice(0,2).join(', ')}));}catch(e){return[];}};
SRC.shikiM=async(q,k)=>{try{return(await J(`https://shikimori.one/api/${k==='ranobe'?'ranobe':'mangas'}?limit=4&search=${encodeURIComponent(q)}`)).map(x=>({title:x.russian||x.name,poster:x.image?.original?'https://shikimori.one'+x.image.original:'',year:(x.aired_on||'').slice(0,4),score:+x.score||''}));}catch(e){return[];}};
const _cands=cands;cands=async function(q,cat){const k=(C.customCats||[]).find(c=>c.id===cat)?.kind;if(k==='books')return(await SRC.ol(q)).filter(x=>x.poster);if(k==='manga'||k==='ranobe')return(await SRC.shikiM(q,k)).filter(x=>x.poster);return _cands(q,cat);};
ICON_LABELS.empty='Картинка пустого списка';

/* --- безопасные сохранения (99, частично) --- */
const SNAP={},_up=upsertItem;
upsertItem=async function(item){
  const old=SNAP[item.id]?JSON.parse(SNAP[item.id]):null;
  if(!old)await _up(item);
  else{const d={};for(const k in item)if(JSON.stringify(item[k])!==JSON.stringify(old[k]))d[k]=item[k];if(!Object.keys(d).length)return;
    await sbFetch('/items?id=eq.'+encodeURIComponent(item.id),{method:'PATCH',body:JSON.stringify(d)});}
  SNAP[item.id]=JSON.stringify(item);
};
function mergeShared(k,cur,mine){
  if(k==='wants'){const r={...(cur||{})};if(mine[ME])r[ME]=1;else delete r[ME];return r;}
  if(k==='reacts'){const r={};cur=cur||{};new Set([...Object.keys(cur),...Object.keys(mine)]).forEach(e=>{const s=new Set(cur[e]||[]);(mine[e]||[]).includes(ME)?s.add(ME):s.delete(ME);r[e]=[...s];});return r;}
  const key=c=>c.by+c.ts+c.text,have=new Set((cur||[]).map(key));return[...(cur||[]),...mine.filter(c=>!have.has(key(c)))];
}
async function patch(id,o){
  const old=items[id];if(!old)return;items[id]={...old,...o};render();if(infoId===id&&$('info').classList.contains('open'))drawInfo();
  try{for(const k of ['wants','reacts','comments'])if(k in o){const r=await sbFetch(`/items?id=eq.${encodeURIComponent(id)}&select=${k}`);items[id][k]=mergeShared(k,r?.[0]?.[k],o[k]);}
    await upsertItem(items[id]);render();}catch(e){setSyncState('error','ошибка');}
}

/* --- оптимизация (101), автообновление (88), лимиты (102) --- */
function render(){
  const sg=[currentTab,currentFilter,curStatus,searchQuery,curColl,curFr,currentSort,JSON.stringify(SF),showArch].join('|');if(sg!==sig){sig=sg;shown=60;}
  lastTotal=0;renderList();
  if(lastTotal>shown){$('list').insertAdjacentHTML('beforeend',`<div id="more" class="stb" style="grid-column:1/-1;text-align:center;padding:12px;cursor:pointer" onclick="shown+=60;render()">Показать ещё (${lastTotal-shown})</div>`);io.observe($('more'));}
  try{localStorage.setItem('wl_state',JSON.stringify({t:currentTab,f:currentFilter,s:currentSort}));}catch(e){}
}
async function autoRefresh(){
  const week=6048e5,todo=Object.values(items).filter(i=>sOf(i)!=='done'&&(!i.info||!i.info.upd||Date.now()-i.info.upd>week)).slice(0,6);
  for(const i of todo){const f=await lookup(i),cur=items[i.id];if(!cur)continue;const nz=Object.fromEntries(Object.entries(f).filter(([,v])=>v));
    items[i.id]={...cur,info:{...cur.info,...nz,ts:1,upd:Date.now()},poster:cur.poster||f.poster||'',total:cur.total||f.eps||0};
    try{await upsertItem(items[i.id]);}catch(e){}await new Promise(r=>setTimeout(r,1500));}
  render();
}
async function usage(silent){
  const el=$('usage');if(!silent)el.textContent='Считаю…';let bytes=0,n=0;
  try{for(const p of ['bg','poster','video']){const r=await fetch(`${SUPA_URL}/storage/v1/object/list/media`,{method:'POST',headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({prefix:p,limit:1000})});(await r.json()).forEach(o=>{bytes+=o.metadata?.size||0;n++;});}
    const warn=bytes>8e8;if(silent&&!warn)return;if(warn)toast('Хранилище почти заполнено');
    el.innerHTML=`Файлы: <b>${(bytes/1048576).toFixed(1)} МБ</b> (${n} шт.), карточек: <b>${Object.keys(items).length}</b>.${warn?' ⚠️ почти заполнено.':''} Точные лимиты: Supabase → Project → Usage.`;}
  catch(e){if(!silent)el.textContent='Не удалось получить данные';}
}

/* --- панель «Ещё» и архив (97) --- */
function infoArchiveButton(){const i=items[infoId];if(i)$('infoBody').insertAdjacentHTML('beforeend',`<div style="margin-top:12px"><button class="upload-btn" onclick="patch(infoId,{archived:!items[infoId].archived})">📦 ${i.archived?'Вернуть из архива':'В архив'}</button></div>`);}
function drawInfo(){drawInfoMain();infoPosterPicker();infoEpisodesAndFear();infoArchiveButton();}
const rw=(l,x)=>`<div class="rr"><span class="cl">${l}</span>${x}</div>`;
const rg=(k,a,b,st=1)=>`<input type="range" min="${a}" max="${b}" step="${st}" value="${U()[k]}" oninput="setU('${k}',+this.value)">`;
const tg=(k,f)=>`<label class="toggle"><input type="checkbox" ${U()[k]?'checked':''} onchange="${f||`setU('${k}',this.checked)`}"><span class="tslider"></span></label>`;
const cl=k=>`<input type="color" value="${U()[k]}" oninput="setU('${k}',this.value)">`;
function drawMoreMain(){
  $('moreBody').innerHTML=`<div class="cs"><div class="cs-title">Карточки</div>
   ${rw('Свечение',rg('glow',0,40))}${rw('Цвет свечения',cl('glowC'))}${rw('Градиентная рамка',tg('grad')+cl('gA')+cl('gB'))}
   ${rw('Колонок',`<select class="cp-select" onchange="setU('cols',+this.value)">${[1,2,3,4,5,6].map(n=>`<option ${U().cols==n?'selected':''}>${n}</option>`).join('')}</select>`)}${rw('Плотность',rg('dens',.6,1.6,.1))}</div><div class="sep"></div>
   <div class="cs"><div class="cs-title">Фон</div>${rw('Параллакс',tg('par','togPar(this.checked)'))}${rw('Сила',rg('parS',5,50))}
   <div class="cr"><button class="upload-btn" onclick="$('vidFile').click()">🎬 Видео-фон (mp4/webm)</button><button class="reset-sm" onclick="setU('video','')">Убрать</button><input type="file" id="vidFile" accept="video/mp4,video/webm" onchange="loadVid(this)"></div></div><div class="sep"></div>
   <div class="cs"><div class="cs-title">Интерфейс</div>${rw('Меню внизу (телефон)',tg('nav'))}${rw('Кнопка «+» слева',tg('fabL'))}${rw('Прятать шапку при прокрутке',tg('hide'))}${rw('Вибрация',tg('vib'))}
   <div style="font-size:11px;color:var(--text3)">Клавиши: N добавить, / поиск, R рулетка, S статистика, F фильтры, Esc закрыть. Картинку для пустого списка задай во вкладке «Иконки».</div></div><div class="sep"></div>
   <div class="cs"><div class="cs-title">Вкладки</div><div id="tabsEd"></div><div class="cr" style="flex-wrap:wrap"><button class="upload-btn" onclick="addPreset('books')">+ Книги</button><button class="upload-btn" onclick="addPreset('manga')">+ Манга</button><button class="upload-btn" onclick="addPreset('ranobe')">+ Ранобэ</button></div></div><div class="sep"></div>
   <div class="cs"><div class="cs-title">Свой CSS</div><textarea class="cp-select" style="height:110px;font-family:monospace;font-size:12px" placeholder=".item{border-radius:20px}" oninput="setU('css',this.value)">${esc(U().css)}</textarea></div><div class="sep"></div>
   <div class="cs"><div class="cs-title">Хранилище</div><div id="usage" style="font-size:12px;color:var(--text2)">—</div><button class="upload-btn" onclick="usage()">Проверить</button></div>`;
  drawTabsEd();
}
const _tc=toggleCustom;toggleCustom=function(){drawMore();_tc();};
addEventListener('load',()=>{
  const css=document.createElement('style');
  css.textContent=`body.glow .item{box-shadow:0 0 var(--glow) var(--glowc),var(--card-shadow)}
  body.gradb .item{border:2px solid transparent;background:linear-gradient(var(--card-bg),var(--card-bg)) padding-box,linear-gradient(135deg,var(--ga),var(--gb)) border-box}
  #list{grid-template-columns:repeat(var(--cols,2),1fr)!important}.item{padding:calc(13px*var(--dens,1)) 14px}
  header{transition:transform .25s}header.hid{transform:translateY(-110%)}
  .toolbar{position:sticky;top:var(--hh,0);z-index:4;background:var(--bg2);padding:8px 0;margin-top:0;transition:top .25s}body.hh .toolbar{top:0}
  body.navb .tabs{position:fixed;bottom:0;left:0;right:0;z-index:20;max-width:860px;margin:0 auto}body.navb .content{padding-bottom:150px}body.navb .fab{bottom:78px}
  body.fabl .fab{right:auto;left:24px}
  .sk{height:76px;border-radius:12px;background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.12),rgba(255,255,255,.04));background-size:200% 100%;animation:sh 1.2s infinite}@keyframes sh{to{background-position:-200% 0}}
  #bgVid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}`;
  document.head.appendChild(css);
  $('cats0')||document.querySelector('.cp-tabs').insertAdjacentHTML('beforeend','<div class="cp-tab" data-tab="more" onclick="switchCpTab(\'more\')">🛠 Ещё</div>');
  document.querySelector('.cp-body').insertAdjacentHTML('beforeend','<div class="cp-page" data-page="more" id="moreBody"></div>');
  document.querySelector('.toolbar').insertAdjacentHTML('beforeend','<button class="filter-btn" onclick="showArch=!showArch;this.style.outline=showArch?\'2px solid var(--accent)\':\'\';render()">📦</button>');
  renderIconPreviews();
  const c=localStorage.getItem('wl_cache');
  if(c&&isAuthed()){try{items=JSON.parse(c);render();}catch(e){}}else $('list').innerHTML=Array(6).fill('<div class="sk"></div>').join('');
  applyUI();
});

/* ===== v8: расположение, панель инструментов, режимы карточек, мелочи ===== */
Object.assign(UI0,{layout:'top',tools:'collapse',toolsOpen:false,view:'list',colsM:1,galMin:150,maxw:860,gap:10,tl:1,btnS:30,pw:46,showPoster:true,showNotes:true,showChips:true,chipsWrap:false,actHover:false,showSync:true,logo:''});
function applyUiLayout(){
  const u=U(),r=document.documentElement.style,b=document.body.classList;
  r.setProperty('--colsm',u.colsM);r.setProperty('--gal',u.galMin+'px');r.setProperty('--maxw',u.maxw+'px');r.setProperty('--gap',u.gap+'px');
  r.setProperty('--tl',u.tl);r.setProperty('--bs',u.btnS+'px');r.setProperty('--pw',u.pw+'px');r.setProperty('--ph',Math.round(u.pw*1.4)+'px');
  b.toggle('side',u.layout==='side');b.toggle('gal',u.view==='gal');b.toggle('cmp',u.view==='cmp');b.toggle('nop',!u.showPoster);b.toggle('non',!u.showNotes);
  b.toggle('nch',!u.showChips);b.toggle('chipsw',!!u.chipsWrap);b.toggle('acth',!!u.actHover);b.toggle('tools-open',u.tools==='show'||!!u.toolsOpen);
  const lg=document.querySelector('.logo > span:not(.logo-icon)');if(lg)lg.innerHTML=u.logo?esc(u.logo):'наш <span>список</span>';
  document.title=u.logo||'Наш список';const sy=document.querySelector('.sync-row');if(sy)sy.style.display=u.showSync?'':'none';
  placeSide();
}
function applyUI(){applyUiCore();applyUiLayout();}
function placeSide(){
  const sb=$('sideBox'),tl=$('tools');if(!sb||!tl)return;
  const side=document.body.classList.contains('side')&&innerWidth>=1000,ct=document.querySelector('.content'),st=$('statsBar'),tb=document.querySelector('.toolbar');
  if(side){sb.append(st,tl);}else if(tl.parentElement===sb){ct.insertBefore(st,tb);tb.after(tl);}
  document.body.classList.toggle('sideon',side);
}
addEventListener('resize',placeSide);
const _si=sortItems;
sortItems=function(a){if(currentSort==='rating')return[...a].sort((x,y)=>avgR(y)-avgR(x));if(currentSort==='year')return[...a].sort((x,y)=>(+y.info?.year||0)-(+x.info?.year||0));return _si(a);};
const sl=(k,o)=>`<select class="cp-select" onchange="setU('${k}',this.value)">${o.map(([v,t])=>`<option value="${v}" ${U()[k]==v?'selected':''}>${t}</option>`).join('')}</select>`;
function drawMoreLayout(){
  $('moreBody').insertAdjacentHTML('afterbegin',`<div class="cs"><div class="cs-title">Вид и расположение</div>
   ${rw('Расположение',sl('layout',[['top','Классика'],['side','Боковая панель (ПК)']]))}
   ${rw('Инструменты',sl('tools',[['collapse','Сворачиваемые (⋯)'],['show','Всегда видны']]))}
   ${rw('Вид карточек',sl('view',[['list','Список'],['gal','Галерея постеров'],['cmp','Компактно']]))}
   ${rw('Колонок на телефоне',sl('colsM',[[1,'1'],[2,'2']]))}
   ${rw('Постер в галерее',rg('galMin',110,260,10))}${rw('Постер в списке',rg('pw',30,120,2))}
   ${rw('Ширина страницы (ПК)',rg('maxw',700,1600,20))}${rw('Отступ карточек',rg('gap',4,24,2))}
   ${rw('Строк в названии',rg('tl',1,3))}${rw('Размер кнопок',rg('btnS',22,42,2))}
   ${rw('Постеры',tg('showPoster'))}${rw('Заметки',tg('showNotes'))}${rw('Метки (статус, оценки…)',tg('showChips'))}
   ${rw('Метки в несколько строк',tg('chipsWrap'))}${rw('Кнопки по наведению (ПК)',tg('actHover'))}${rw('Статус синхронизации',tg('showSync'))}
   ${rw('Название',`<input class="cp-select" style="flex:1" placeholder="наш список" value="${esc(U().logo)}" oninput="setU('logo',this.value)">`)}
   <div style="font-size:11px;color:var(--text3)">Боковая панель включается на экранах шире 1000 px: вкладки, статистика и инструменты уходят влево.</div></div><div class="sep"></div>`);
}
function drawMore(){drawMoreMain();drawMoreLayout();}
addEventListener('load',()=>{
  const css=document.createElement('style');
  css.textContent=`.desktop-wrap{max-width:var(--maxw,860px)!important}
  @media(min-width:700px){.fab{right:max(24px,calc(50% - var(--maxw,860px)/2 + 24px))!important}}
  #list{grid-template-columns:repeat(var(--colsm,1),1fr)!important;gap:var(--gap,10px)!important}
  @media(min-width:700px){#list{grid-template-columns:repeat(var(--cols,2),1fr)!important}}
  .chips{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}.chips>*{flex:none;white-space:nowrap}
  body.chipsw .chips{flex-wrap:wrap;overflow:visible}
  .item-title{white-space:normal!important;display:-webkit-box;-webkit-line-clamp:var(--tl,1);-webkit-box-orient:vertical;overflow:hidden}
  .btn-icon{width:var(--bs,30px);height:var(--bs,30px)}.item .poster{width:var(--pw,46px);height:var(--ph,64px)}
  body.nop .poster{display:none}body.non .item-meta{display:none}body.nch .chips{display:none}
  body.cmp .chips,body.cmp .item-meta,body.cmp .poster{display:none}body.cmp .item{padding:6px 12px!important}
  body.gal #list{grid-template-columns:repeat(auto-fill,minmax(var(--gal,150px),1fr))!important}
  body.gal .item{flex-direction:column;align-items:stretch;padding:0!important;gap:0}
  body.gal .item .poster{width:100%;height:auto;aspect-ratio:2/3;border-radius:0}
  body.gal .item-body{padding:8px 10px 10px}body.gal .check{position:absolute;top:8px;left:8px;z-index:2;background:rgba(0,0,0,.5)}
  body.gal .item-actions{position:absolute;top:8px;right:8px;z-index:2}
  @media(hover:hover){body.acth .item-actions{opacity:0;transition:.15s}body.acth .item:hover .item-actions{opacity:1}}
  #tools{display:none;flex-wrap:wrap;gap:6px;margin:0 0 12px}body.tools-open #tools{display:flex}#sideBox{display:none}
  @media(min-width:1000px){
   body.side #mainApp{display:grid!important;grid-template-columns:260px 1fr;grid-template-areas:"t b" "s b";grid-template-rows:auto 1fr;gap:0 16px;align-items:start}
   body.side .tabs{grid-area:t;display:flex;flex-direction:column;gap:6px;background:none;border:0}
   body.side .tab{flex-direction:row;justify-content:flex-start;border-radius:12px;border-top:0!important;padding:12px 16px}
   body.side .tab.active{border-left:3px solid var(--accent)}
   body.side #sideBox{grid-area:s;display:block;padding:12px;margin-top:10px;background:var(--bg2);border-radius:12px;position:sticky;top:16px}
   body.side .body-wrap{grid-area:b;border-radius:16px!important}
   body.sideon #tools{display:flex!important;flex-direction:column;align-items:stretch;margin:10px 0 0}body.sideon #tools>*{width:100%}body.sideon #toolsBtn{display:none}
  }`;
  document.head.appendChild(css);
  $('tabsNav').insertAdjacentHTML('afterend','<div id="sideBox"></div>');
  const tb=document.querySelector('.toolbar'),tl=document.createElement('div');tl.id='tools';tb.after(tl);
  [...tb.children].forEach(el=>{if(el.classList.contains('filter-row')||el.id==='fltBtn'||(el.getAttribute('onclick')||'').includes('roulette()'))return;tl.append(el);});
  tl.insertAdjacentHTML('beforeend','<button class="filter-btn" onclick="loadAllItems().then(render)">🔄 Обновить</button>');
  tb.insertAdjacentHTML('beforeend','<button class="filter-btn" id="toolsBtn" onclick="setU(\'toolsOpen\',!U().toolsOpen)">⋯</button>');
  $('sortSelect').insertAdjacentHTML('beforeend','<option value="rating">⭐ По оценке</option><option value="year">📆 По году</option>');
  try{const st=JSON.parse(localStorage.getItem('wl_state')||'{}');
    if(st.t)currentTab=st.t;
    if(st.f){currentFilter=st.f;document.querySelectorAll('.filter-row .filter-btn').forEach(b=>b.classList.toggle('active',(b.getAttribute('onclick')||'').includes("'"+st.f+"'")));}
    if(st.s){currentSort=st.s;$('sortSelect').value=st.s;}}catch(e){}
  applyUI();render();
});
