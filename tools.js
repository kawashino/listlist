/* tools.js: Инструменты: рулетка, импорт, бэкап, установка приложения, горячие клавиши, хранилище. */

let dip;

addEventListener('beforeinstallprompt',e=>{e.preventDefault();dip=e;});

function installApp(){if(dip){dip.prompt();dip=null;}else toast('Chrome: меню ⋮ → «Установить приложение»');}

function exportData(){
  const data={app:'listlist',v:2,ts:Date.now(),items:Object.values(items)};
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,1)],{type:'application/json'}));
  a.download='listlist-backup-'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

function switchMe(){ME='';localStorage.removeItem('wl_me');ensureMe();$('meName').textContent=ME;render();}

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

async function doImport(){
  let t=$('impText').value;const f=$('impFile').files[0];if(f)t=await f.text();

  // Резервная копия listlist (JSON): массив либо {app:'listlist',items:[…]}
  if(/^[\[{]/.test(t.trim())){
    let d;try{d=JSON.parse(t);}catch(e){toast('Не удалось прочитать JSON');return;}
    const L=Array.isArray(d)?d:(d&&d.items)||[];
    if(!L.length){toast('В файле нет карточек');return;}
    if(!confirm(`Восстановить ${L.length} карточек? Существующие с теми же id будут перезаписаны.`))return;
    let n=0;
    for(const x of L){
      if(!x||!x.title)continue;
      const it={...x,id:x.id||Date.now().toString(36)+n.toString(36)+Math.random().toString(36).slice(2,5)};
      items[it.id]=it;n++;
      try{await upsertItem(it);}catch(e){}
    }
    render();$('imp').classList.remove('open');$('impText').value='';
    toast('Восстановлено: '+n);return;
  }

  let L=[];
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

// ===== ГОРЯЧИЕ КЛАВИШИ =====
// Одиночные клавиши работают только вне полей ввода; Ctrl/Cmd — везде.
let focusedId=null;
function getItemOrder(){return [...document.querySelectorAll('.item[data-id],.trow[data-id]')].map(el=>el.dataset.id);}
function focusItemById(id){const el=document.querySelector(`.item[data-id="${id}"],.trow[data-id="${id}"]`);if(el){el.focus();el.scrollIntoView({block:'nearest',inline:'nearest'});focusedId=id;}}

addEventListener('keydown',e=>{
  const inField=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName),mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
  if(mod&&e.key==='Enter'){const ov=$('overlay');if(ov&&ov.classList.contains('open')){e.preventDefault();saveItem();}return;}
  if(mod&&k==='k'){e.preventDefault();$('searchInput').focus();$('searchInput').select();return;}
  if(inField||mod||e.altKey)return;
  if(k==='arrowdown'){e.preventDefault();const order=getItemOrder();let i=focusedId?order.indexOf(focusedId):-1;if(i<0)i=0;else i=Math.min(i+1,order.length-1);focusItemById(order[i]);return;}
  if(k==='arrowup'){e.preventDefault();const order=getItemOrder();let i=focusedId?order.indexOf(focusedId):-1;if(i<0)i=order.length-1;else i=Math.max(i-1,0);focusItemById(order[i]);return;}
  if(k==='enter'){e.preventDefault();if(focusedId)openInfo(focusedId);return;}
  if(k===' '){e.preventDefault();if(focusedId)toggleDone(focusedId);return;}
  if(k==='x'){e.preventDefault();if(focusedId)setStatus(focusedId,'archived');return;}
  if(k==='n'){e.preventDefault();openModal();}else if(k==='/'){e.preventDefault();$('searchInput').focus();}else if(k==='r')roulette();else if(k==='s')stats();else if(k==='f')$('flt').classList.add('open');
  else if(k==='?')showShortcuts();
  else if(k==='escape')document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
});

function showShortcuts(){
  const rows=[['N','Добавить карточку'],['/ или Ctrl+K','Поиск'],['Ctrl+Enter','Сохранить в форме'],['R','Рулетка «что смотрим»'],['S','Статистика'],['F','Умные фильтры'],['T','Экран «Сегодня»'],['?','Эта подсказка'],['Esc','Закрыть окно']];
  if(!$('keys'))document.body.insertAdjacentHTML('beforeend','<div id="keys" class="overlay" onclick="if(event.target===this)this.classList.remove(\'open\')"><div class="modal" id="keysBody"></div></div>');
  $('keysBody').innerHTML='<div class="modal-title">⌨️ Горячие клавиши</div>'+rows.map(([k,v])=>`<div class="br"><span style="width:130px;flex:none"><b>${esc(k)}</b></span><span>${esc(v)}</span></div>`).join('')
    +'<div class="btn-row"><button class="btn btn-primary" onclick="$(\'keys\').classList.remove(\'open\')">Понятно</button></div>';
  $('keys').classList.add('open');
}

async function usage(silent){
  const el=$('usage');if(!silent)el.textContent='Считаю…';let bytes=0,n=0;
  try{for(const p of ['bg','poster','video']){const r=await fetch(`${SUPA_URL}/storage/v1/object/list/media`,{method:'POST',headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({prefix:p,limit:1000})});(await r.json()).forEach(o=>{bytes+=o.metadata?.size||0;n++;});}
    const warn=bytes>8e8;if(silent&&!warn)return;if(warn)toast('Хранилище почти заполнено');
    el.innerHTML=`Файлы: <b>${(bytes/1048576).toFixed(1)} МБ</b> (${n} шт.), карточек: <b>${Object.keys(items).length}</b>.${warn?' ⚠️ почти заполнено.':''} Точные лимиты: Supabase → Project → Usage.`;}
  catch(e){if(!silent)el.textContent='Не удалось получить данные';}
}

/* ===== «Поделиться → в наш список», ссылка из буфера, экран «Состояние», экран «Сегодня» ===== */
let SHARED=(()=>{
  const p=new URLSearchParams(location.search);if(!(p.has('url')||p.has('text')||p.has('title')))return'';
  const t=[p.get('url'),p.get('text'),p.get('title')].filter(Boolean).join(' '),m=t.match(/https?:\/\/\S+/);
  try{history.replaceState(null,'',location.pathname);}catch(e){}
  return m?m[0]:t.trim();
})();
function handleShare(){if(!SHARED)return;const s=SHARED;SHARED='';openModal();$('inputTitle').value=s;onTitle();}
async function pasteLink(auto){
  try{
    if(auto){const p=await navigator.permissions.query({name:'clipboard-read'});if(p.state!=='granted')return;}
    const t=(await navigator.clipboard.readText()).trim();
    if(/^https?:\/\/\S+$/.test(t)&&!$('inputTitle').value){$('inputTitle').value=t;onTitle();}else if(!auto)toast('В буфере нет ссылки');
  }catch(e){if(!auto)toast('Браузер не дал прочитать буфер: вставь ссылку вручную');}
}
const ago=t=>{const s=Math.round((Date.now()-t)/1000);return s<60?s+' с назад':s<3600?Math.round(s/60)+' мин назад':Math.round(s/3600)+' ч назад';};
async function statusReport(){
  const s=STAT,ws=typeof realtimeChannel!=='undefined'&&realtimeChannel&&realtimeChannel.readyState===1;let v='неизвестно';
  try{v=(await caches.keys()).join(', ')||'нет';}catch(e){}
  return[['База',s.fetch?'данные получены '+ago(s.fetch):'ещё не загружались'],
   ['Мгновенная синхронизация',(ws?'подключена':'нет соединения')+' ('+s.rt+')'+(s.rtAt?', последнее событие '+ago(s.rtAt):'')],
   ['Комментарии, реакции, «хочу»',extrasOn?'в отдельных таблицах, без конфликтов':'старый режим: выполни SQL из инструкции'],
   ['Карточек',Object.keys(items).length],['Офлайн-копия',Math.round((localStorage.getItem('wl_cache')||'').length/1024)+' КБ'],
   ['Версия кэша',v],['Пользователь',ME],['Браузер',String(navigator.userAgent||'').slice(0,90)],
   ['Ошибки скриптов',window.__errs&&__errs.length?__errs.join(' | '):'нет']];
}
async function showStatus(){
  const L=await statusReport();
  $('statusBody').innerHTML='<div class="modal-title">🩺 Состояние</div>'+L.map(([k,v])=>`<div class="br" style="align-items:flex-start"><span style="width:150px;flex:none">${esc(k)}</span><b style="font-weight:500;word-break:break-word">${esc(v)}</b></div>`).join('')
   +'<div class="btn-row"><button class="btn btn-secondary" onclick="refreshItems().then(showStatus)">Обновить сейчас</button><button class="btn btn-primary" onclick="copyStatus()">Скопировать отчёт</button></div>';
  $('status').classList.add('open');
}
async function copyStatus(){try{await navigator.clipboard.writeText((await statusReport()).map(([k,v])=>k+': '+v).join('\n'));toast('Отчёт скопирован');}catch(e){toast('Не удалось скопировать');}}
function showToday(){
  const all=Object.values(items).filter(i=>!i.archived),now=all.filter(i=>sOf(i)==='watching'),want=all.filter(i=>sOf(i)==='want'),both=want.filter(i=>Object.keys(i.wants||{}).length>1);
  const next=[...both,...want.filter(i=>!both.includes(i)).sort(()=>Math.random()-.5)].slice(0,3),recent=all.filter(i=>sOf(i)==='done').sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,4);
  const row=i=>`<div class="br" style="gap:10px;margin:8px 0">${i.poster?`<img class="poster" style="width:34px;height:48px" src="${esc(i.poster)}">`:''}<span style="flex:1;width:auto;white-space:normal;cursor:pointer" onclick="openInfo('${i.id}')">${esc(i.title)}${EP.includes(i.cat)&&i.episode?` <small style="color:var(--text3)">· ${i.cat==='manga'?'гл.':'сер.'} ${i.episode}${i.total?'/'+i.total:''}</small>`:''}</span>${EP.includes(i.cat)?`<button class="pp" onclick="bump('${i.id}');showToday()">+1</button>`:''}</div>`;
  $('todayBody').innerHTML='<div class="modal-title">🏠 Сегодня</div><div class="cs-title">Смотрим сейчас</div>'+(now.map(row).join('')||'<small style="color:var(--text3)">Ничего не в процессе</small>')
   +'<div class="cs-title" style="margin-top:14px">Что дальше'+(both.length?' (💗 хотите оба — первыми)':'')+'</div>'+(next.map(row).join('')||'<small style="color:var(--text3)">В «Хочу» пусто</small>')
   +'<div class="cs-title" style="margin-top:14px">Недавно закончили</div>'+(recent.map(row).join('')||'<small style="color:var(--text3)">Пока ничего</small>');
  $('today').classList.add('open');
}
addEventListener('keydown',e=>{if(!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.toLowerCase()==='t')showToday();});
function buildExtraUi(){
  const cl="if(event.target===this)this.classList.remove('open')";
  document.body.insertAdjacentHTML('beforeend',`<div id="status" class="overlay" onclick="${cl}"><div class="modal" id="statusBody"></div></div><div id="today" class="overlay" onclick="${cl}"><div class="modal" id="todayBody"></div></div>`);
  $('tools').insertAdjacentHTML('beforeend','<button class="filter-btn" onclick="showToday()">🏠 Сегодня</button><button class="filter-btn" onclick="showStatus()">🩺 Состояние</button>');
  $('inputTitle').insertAdjacentHTML('afterend','<button type="button" class="upload-btn" style="margin-top:6px" onclick="pasteLink()">📋 Вставить ссылку из буфера</button>');
}

/* ===== Сборка интерфейса этого модуля: шаги выполняются в порядке номеров (uiStep, см. util.js), номера хранят исходный порядок вставки элементов ===== */
uiStep(100, () => {
document.body.insertAdjacentHTML('beforeend',`<canvas id="fxCanvas"></canvas><div id="toast"></div>
  <div id="rou" class="overlay" onclick="if(event.target===this)this.classList.remove('open')"><div class="modal" style="text-align:center">
   <div style="font-size:13px;color:var(--text2)">Сегодня смотрим…</div><div id="rouTitle" class="rou-t">🎲</div>
   <label style="font-size:12px;color:var(--text2)"><input type="checkbox" id="rouAll"> из всех категорий</label>
   <div class="btn-row"><button class="btn btn-secondary" onclick="$('rou').classList.remove('open')">Закрыть</button><button class="btn btn-primary" onclick="roulette()">Ещё раз</button></div></div></div>`);
});
uiStep(180, () => {
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
});
uiStep(210, () => {
const cl="if(event.target===this)this.classList.remove('open')";
  document.body.insertAdjacentHTML('beforeend',`
   <div id="info" class="overlay" onclick="${cl}"><div class="modal" id="infoBody"></div></div>
   <div id="stats" class="overlay" onclick="${cl}"><div class="modal" id="statsBody"></div></div>
   <div id="imp" class="overlay" onclick="${cl}"><div class="modal"><div class="modal-title">📥 Импорт в текущую категорию</div>
    <div class="field"><label>Названия, по одному в строке</label><textarea id="impText" style="height:110px"></textarea></div>
    <div class="field"><label>или файл: Letterboxd CSV / MyAnimeList XML</label><input type="file" id="impFile" accept=".csv,.xml,.txt" style="display:block"></div>
    <div class="btn-row"><button class="btn btn-secondary" onclick="$('imp').classList.remove('open')">Закрыть</button><button class="btn btn-primary" onclick="doImport()">Импортировать</button></div></div></div>`);
});
uiStep(220, () => {
$('rouAll').parentElement.insertAdjacentHTML('afterend','<br><label style="font-size:12px;color:var(--text2)"><input type="checkbox" id="rouBoth"> только «хотим оба»</label><div id="rouPicks"></div><button class="upload-btn" style="margin-top:8px" onclick="night()">🍿 3 варианта на вечер</button>');
});
uiStep(1000,buildExtraUi);
