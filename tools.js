/* tools.js: Инструменты: рулетка, импорт, бэкап, установка приложения, горячие клавиши, хранилище. */

let dip;

addEventListener('beforeinstallprompt',e=>{e.preventDefault();dip=e;});

function installApp(){if(dip){dip.prompt();dip=null;}else toast('Chrome: меню ⋮ → «Установить приложение»');}

function exportData(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(Object.values(items),null,1)],{type:'application/json'}));a.download='watchlist-backup.json';a.click();}

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

addEventListener('keydown',e=>{
  if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.toLowerCase();
  if(k==='n'){e.preventDefault();openModal();}else if(k==='/'){e.preventDefault();$('searchInput').focus();}else if(k==='r')roulette();else if(k==='s')stats();else if(k==='f')$('flt').classList.add('open');
  else if(k==='escape')document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
});

async function usage(silent){
  const el=$('usage');if(!silent)el.textContent='Считаю…';let bytes=0,n=0;
  try{for(const p of ['bg','poster','video']){const r=await fetch(`${SUPA_URL}/storage/v1/object/list/media`,{method:'POST',headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({prefix:p,limit:1000})});(await r.json()).forEach(o=>{bytes+=o.metadata?.size||0;n++;});}
    const warn=bytes>8e8;if(silent&&!warn)return;if(warn)toast('Хранилище почти заполнено');
    el.innerHTML=`Файлы: <b>${(bytes/1048576).toFixed(1)} МБ</b> (${n} шт.), карточек: <b>${Object.keys(items).length}</b>.${warn?' ⚠️ почти заполнено.':''} Точные лимиты: Supabase → Project → Usage.`;}
  catch(e){if(!silent)el.textContent='Не удалось получить данные';}
}
