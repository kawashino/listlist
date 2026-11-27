/* cards.js: Карточки и список: отрисовка, статусы, форма, сохранение, фильтры, франшизы, подгрузка по частям. */

function renderList(){
  renderTabs();
  const list=$('list'),all=Object.values(items);
  if (isLoading && all.length === 0) {
    list.innerHTML = Array(6).fill('<div class="sk"></div>').join('');
    return;
  }
  let arr=all.filter(i=>i.cat===currentTab);
  if(curStatus!=='all')arr=arr.filter(i=>sOf(i)===curStatus);
  else if(currentFilter==='done')arr=arr.filter(i=>sOf(i)==='done');
  else if(currentFilter==='todo')arr=arr.filter(i=>sOf(i)!=='done');
  if(searchQuery)arr=arr.filter(i=>itemSearchScore(searchQuery,i)>0);
  if(curColl!=='all')arr=arr.filter(i=>i.coll===curColl);if(curFr!=='all')arr=all.filter(i=>i.franchise===curFr);arr=arr.filter(smartOk).filter(i=>showArch?i.archived:!i.archived);updFr();arr=sortItems(arr);updColl();
  // при активном поиске релевантность важнее выбранной сортировки
  if(searchQuery)arr.sort((a,b)=>itemSearchScore(searchQuery,b)-itemSearchScore(searchQuery,a));
  getAllCats().forEach(c=>{const n=all.filter(i=>i.cat===c.id&&sOf(i)!=='done').length,el=$('badge-'+c.id);if(el){el.textContent=n;el.classList.toggle('show',n>0);}});
  const cat=all.filter(i=>i.cat===currentTab),d=cat.filter(i=>sOf(i)==='done').length;
  [['stat-total',cat.length],['stat-done',d],['stat-left',cat.length-d]].forEach(([id,v])=>{const e=$(id);if(e)e.textContent=v;});
  if(!arr.length){list.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-icon">${C.icons?.empty?`<img src="${C.icons.empty}" style="width:64px;height:64px;border-radius:14px;object-fit:cover">`:'📂'}</div><p>Здесь пока пусто</p><button class="btn btn-primary" style="margin-top:14px;max-width:200px" onclick="openModal()" title="Добавить новую карточку в текущую категорию">+ Добавить</button></div>`;selBar();return;}
  const ic=C.icons||{};
  lastTotal=arr.length;arr=arr.slice(0,shown);

  // табличный вид: строка на тайтл, удобно для длинных списков на ПК
  if(U().view==='table'){
    list.innerHTML=renderTable(arr,ic);
    if(C.rgb.text&&rgbRaf)document.querySelectorAll('.item-title').forEach(el=>el.style.color=`hsl(${rgbHue},${C.rgb.sat}%,${C.rgb.light}%)`);
    selBar();
    return;
  }

  list.innerHTML=arr.map(i=>{
    const st=sOf(i),rs=Object.entries(i.ratings||{}).filter(([,v])=>v>0).map(([k,v])=>esc(k)+' '+v).join(' · ');
    const prog=(st==='watching'&&EP.includes(i.cat))?`<span>${i.cat==='manga'?'гл. ':'S'+(i.season||1)+' · '}${i.episode||0}${i.total?'/'+i.total:''}<button class="pp" onclick="bump('${i.id}')" title="Отметить следующую серию/главу">+1</button></span>`:'';
    const tags=(i.tags||'').split(',').map(t=>t.trim()).filter(Boolean).map(t=>`<span class="tg">${esc(t)}</span>`).join('');
    const gs=genresOf(i).slice(0,4).map(t=>`<span class="tg">${esc(t)}</span>`).join('');
    const w=Object.keys(i.wants||{});
    return `<div class="item cat-${i.cat.replace(/^cat_/,'custom')} st-${st}${w.length>1?' both':''}${SEL.has(i.id)?' sel':''}" data-id="${i.id}" data-title="${esc(i.title)}" tabindex="0" role="button" aria-label="${esc(i.title)}">
      <label class="tsel" onclick="event.stopPropagation()" title="Выбрать"><input type="checkbox" ${SEL.has(i.id)?'checked':''} onchange="toggleSel('${i.id}')"></label>
      ${i.poster?`<img class="poster" loading="lazy" src="${esc(i.poster)}" onerror="this.remove()">`:''}
      <div class="check" onclick="toggleDone('${i.id}')">${st==='done'?(ic.check?`<img src="${ic.check}">`:'✓'):''}</div>
      <div class="item-body"><div class="item-title" style="cursor:pointer" onclick="openInfo('${i.id}')">${esc(i.title)}</div>
        ${i.note?`<div class="item-meta">${esc(i.note)}</div>`:''}
        <div class="chips"><span class="stb" onclick="cycleStatus('${i.id}')">${ST[st]}</span><span class="stb" onclick="toggleWant('${i.id}')">${w.length?'💗 '+w.map(esc).join(', '):'🤍 хочу'}</span>${i.coll?'<span class="tg">📁 '+esc(i.coll)+'</span>':''}${i.franchise?`<span class="tg" style="cursor:pointer" data-f="${esc(i.franchise)}" onclick="setFr(this.dataset.f)">🔗 ${esc(i.franchise)} ${frProg(i.franchise)}</span>`:''}${prog}${rs?`<span class="rt">⭐ ${rs}</span>`:''}${i.added_by?`<span>+${esc(i.added_by)}</span>`:''}</div>
        ${gs||tags?`<div class="chips">${gs}${gs&&tags?'<span class="tg-sep"></span>':''}${tags}</div>`:''}
        ${i.link?`<a href="${esc(i.link)}" target="_blank" style="font-size:11px;color:var(--accent2);text-decoration:none">🔗 Открыть</a>`:''}
      </div>
      <div class="item-actions"><button class="btn-icon" onclick="editItem('${i.id}')" title="Редактировать карточку">${ic.edit?`<img src="${ic.edit}">`:'✏️'}</button><button class="btn-icon del" onclick="deleteItem('${i.id}')" title="Удалить карточку">${ic.del?`<img src="${ic.del}">`:'🗑️'}</button></div></div>`;
  }).join('');
  if(C.rgb.text&&rgbRaf)document.querySelectorAll('.item-title').forEach(el=>el.style.color=`hsl(${rgbHue},${C.rgb.sat}%,${C.rgb.light}%)`);
  selBar();
}

/* ===== ТАБЛИЧНЫЙ ВИД (ПК) ===== */
function renderTable(arr,ic){
  const row=i=>{
    const st=sOf(i),rs=Object.entries(i.ratings||{}).filter(([,v])=>v>0).map(([k,v])=>v).join(',');
    const score=i.info?.score||rs;
    const prog=EP.includes(i.cat)&&st==='watching'&&i.episode?`${i.cat==='manga'?'гл.':'сер.'} ${i.episode}${i.total?'/'+i.total:''}`:'';
    const gs=genresOf(i).slice(0,3).map(t=>`<span class="tg">${esc(t)}</span>`).join('');
    return `<div class="trow${i.done?' done':''}${SEL.has(i.id)?' sel':''}" data-id="${i.id}" data-title="${esc(i.title)}" onclick="rowClick(event,'${i.id}')">
      <label class="tsel" onclick="event.stopPropagation()" title="Выбрать"><input type="checkbox" ${SEL.has(i.id)?'checked':''} onchange="toggleSel('${i.id}')"></label>
      ${i.poster?`<img class="poster" loading="lazy" src="${esc(i.poster)}" onerror="this.style.visibility='hidden'">`:'<span class="poster ph"></span>'}
      <div class="tcell title"><span class="item-title">${esc(i.title)}</span>${i.note?`<small class="item-meta">${esc(i.note)}</small>`:''}</div>
      <div class="tcell"><span class="stb" onclick="event.stopPropagation();cycleStatus('${i.id}')">${ST[st]}</span></div>
      <div class="tcell c">${score?`<span class="rt">⭐ ${esc(score)}</span>`:''}</div>
      <div class="tcell c">${esc(i.info?.year||'')}</div>
      <div class="tcell c">${prog?`<span class="stb" onclick="event.stopPropagation();bump('${i.id}')">${prog} +1</span>`:''}</div>
      <div class="tcell genres">${gs}</div>
      <div class="tcell c">${i.coll?esc(i.coll):''}</div>
      <div class="tcell act"><button class="btn-icon" onclick="event.stopPropagation();editItem('${i.id}')" title="Редактировать">${ic.edit?`<img src="${ic.edit}">`:'✏️'}</button><button class="btn-icon del" onclick="event.stopPropagation();deleteItem('${i.id}')" title="Удалить">${ic.del?`<img src="${ic.del}">`:'🗑️'}</button></div>
    </div>`;
  };
  const head=`<div class="thead"><span></span><span></span><span>Название</span><span>Статус</span><span>Оценка</span><span>Год</span><span>Прогресс</span><span>Жанры</span><span>Коллекция</span><span></span></div>`;
  return head+arr.map(row).join('');
}

/* ===== МУЛЬТИ-ВЫБОР ===== */
let SEL=new Set();
function toggleSel(id){
  SEL.has(id)?SEL.delete(id):SEL.add(id);
  document.body.classList.toggle('selecting',SEL.size>0);
  render();
}
function clearSel(){SEL.clear();document.body.classList.remove('selecting');render();}
function rowClick(e,id){if(e.target.closest('button,input,a,.stb,label'))return;openInfo(id);}

async function bulkStatus(st){
  const ids=[...SEL],changed=[];
  ids.forEach(id=>{const i=items[id];if(!i)return;items[id]={...i,status:st,done:st==='done'};changed.push(items[id]);});
  SEL.clear();document.body.classList.remove('selecting');render();beep();
  for(const it of changed){try{await upsertItem(it);}catch(e){}}
  toast('Статус изменён: '+changed.length);
}

async function bulkCat(){
  const names=getAllCats().map(c=>c.name).join(', ');
  const name=(prompt('В какую категорию? ('+names+')')||'').trim();if(!name)return;
  const cat=(getAllCats().find(c=>c.name.toLowerCase()===name.toLowerCase())||{}).id;
  if(!cat){toast('Нет такой категории');return;}
  const changed=[];
  SEL.forEach(id=>{const i=items[id];if(!i)return;items[id]={...i,cat};changed.push(items[id]);});
  SEL.clear();document.body.classList.remove('selecting');render();
  for(const it of changed){try{await upsertItem(it);}catch(e){}}
  toast('Перенесено: '+changed.length);
}

async function bulkArchive(){
  const changed=[];
  SEL.forEach(id=>{const i=items[id];if(!i)return;items[id]={...i,archived:!i.archived};changed.push(items[id]);});
  SEL.clear();document.body.classList.remove('selecting');render();
  for(const it of changed){try{await upsertItem(it);}catch(e){}}
  toast('Архив обновлён: '+changed.length);
}

async function bulkDelete(){
  const ids=[...SEL];if(!ids.length)return;
  if(!confirm('Удалить выбранные карточки: '+ids.length+'?'))return;
  const removed=ids.map(id=>items[id]).filter(Boolean);
  ids.forEach(id=>delete items[id]);
  SEL.clear();document.body.classList.remove('selecting');render();
  for(const id of ids){try{await deleteItemDb(id);}catch(e){}}
  toast('Удалено: '+ids.length,async()=>{
    removed.forEach(i=>items[i.id]=i);render();
    for(const i of removed){try{await upsertItem(i);}catch(e){}}
  });
}

function selBar(){
  let bar=$('selbar');
  if(!SEL.size){if(bar)bar.remove();return;}
  if(!bar){document.body.insertAdjacentHTML('beforeend','<div id="selbar" class="selbar"></div>');bar=$('selbar');}
  bar.innerHTML=`<span class="selbar-n">Выбрано: <b>${SEL.size}</b></span>
    <button class="filter-btn" onclick="bulkStatus('watching')" title="Пометить выбранные как «Смотрю»">▶ Смотрю</button>
    <button class="filter-btn" onclick="bulkStatus('done')" title="Пометить выбранные как «Просмотрено»">✅ Просмотрено</button>
    <button class="filter-btn" onclick="bulkCat()" title="Переместить выбранные в другую категорию">📂 В категорию</button>
    <button class="filter-btn" onclick="bulkArchive()" title="Архивировать/разархивировать выбранные">📦 Архив</button>
    <button class="filter-btn" onclick="bulkDelete()" title="Удалить выбранные карточки">🗑 Удалить</button>
    <button class="filter-btn" onclick="clearSel()" title="Очистить выбор">✕</button>`;
}

async function setStatus(id,st){const i=items[id];if(!i)return;items[id]={...i,status:st,done:st==='done'};render();beep();try{await upsertItem(items[id]);}catch(e){setSyncState('error','ошибка');}}

async function toggleDone(id){const i=items[id];if(i)setStatus(id,sOf(i)==='done'?'want':'done');}

function cycleStatus(id){const k=Object.keys(ST);setStatus(id,k[(k.indexOf(sOf(items[id]))+1)%k.length]);}

function fillForm(i){
  const v=(id,x)=>$(id).value=x??'';
  $('modalTitle').textContent=i.id?'Редактировать':'Добавить';
  v('inputTitle',i.title);v('inputNote',i.note);v('inputLink',i.link);
  rebuildCatSelect();$('inputCat').value=i.cat||currentTab;
  v('fStatus',sOf(i));v('fSeason',i.season||'');v('fEpisode',i.episode||'');v('fTotal',i.total||'');
  v('fRating',(i.ratings||{})[ME]||'');v('fTags',i.tags);v('fPoster',i.poster);v('fColl',i.coll);_pick=null;$('sug').innerHTML='';v('fFr',i.franchise);
  $('overlay').classList.add('open');setTimeout(()=>$('inputTitle').focus(),80);
}

function openModal(){editingId=null;fillForm({});pasteLink(true);if(innerWidth>=900)$('overlay').classList.add('modal-2col');else $('overlay').classList.remove('modal-2col');}

function editItem(id){const i=items[id];if(!i)return;editingId=id;fillForm(i);}

// ===== ПРОВЕРКА ФОРМЫ =====
// Ловим то, что раньше уходило в базу молча: пустое название, битую ссылку, кривой постер и дубликаты.
function validUrl(u) {
  if (!u) return true;
  if (/^https?:\/\/\S+$/i.test(u)) return true;
  if (/^data:image\//i.test(u)) return true;
  return false;
}

function validateItemForm({ title, link, poster, cat, id }) {
  if (!title) return 'Введи название';
  if (title.length < 2) return 'Название слишком короткое (минимум 2 символа)';
  if (link && !validUrl(link)) return 'Ссылка должна начинаться с http:// или https://';
  if (poster && !validUrl(poster)) return 'Постер должен быть ссылкой на картинку (http/https)';

  const dup = Object.values(items).find(i => i.id !== id && i.cat === cat && String(i.title || '').trim().toLowerCase() === title.toLowerCase());
  if (dup && !confirm(`Такая карточка уже есть: «${dup.title}». Всё равно сохранить?`)) return '__cancel__';
  return '';
}

async function saveItem(){
  await resolveTitleLink();
  let title=$('inputTitle').value.trim();
  const link=$('inputLink').value.trim();
  let poster0=$('fPoster').value.trim();
  const cat=$('inputCat').value||currentTab;
  const problem=validateItemForm({title,link,poster:poster0,cat,id:editingId});
  if(problem){ if(problem==='__cancel__')return; toast(problem); $('inputTitle').focus(); return; }

  // Высокий приоритет: распознать по ссылке (Steam, Википедия, Shikimori, IMDb и т.п.)
  let linkInfo=null;
  if(link&&isUrl(link)&&!_pick){
    try{linkInfo=await fromLink(link);}catch(e){}
    if(linkInfo){
      if(!title)title=linkInfo.title;
      if(!poster0&&linkInfo.poster)poster0=linkInfo.poster;
      _pick=linkInfo;
    }
  }

  const old=editingId?items[editingId]:null,st=$('fStatus').value,rate=parseFloat($('fRating').value)||0;
  const ratings={...(old&&old.ratings||{})};if(rate>0)ratings[ME]=rate;else delete ratings[ME];
  const btn=$('saveBtn');btn.disabled=true;btn.textContent='Сохраняем...';
  let poster=poster0;
  if(!poster)poster=await findPoster(title,cat);
  const base=old||{id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),ts:Date.now(),added_by:ME};
  const genres=_pick&&_pick.genres?_pick.genres:[];
  const item={...base,cat,title,note:$('inputNote').value.trim(),link:$('inputLink').value.trim(),status:st,done:st==='done',
    season:+$('fSeason').value||0,episode:+$('fEpisode').value||0,total:+$('fTotal').value||0,ratings,tags:$('fTags').value.trim(),poster,
    coll:$('fColl').value.trim(),
    franchise:$('fFr').value.trim()||(_pick&&_pick.franchise)||'',
    ...(_pick?{info:{ts:1,year:_pick.year||'',genres,desc:_pick.desc||'',score:_pick.score||'',trailer:_pick.trailer||'',franchise:_pick.franchise||'',upd:Date.now()}}:{})};
  items[item.id]=item;render();closeModal();
  try{localStorage.setItem('wl_cache',JSON.stringify(items));}catch(e){}
  try{await upsertItem(item);setSyncState('live','сохранено');}catch(e){setSyncState('error','ошибка сохранения');}
  btn.disabled=false;btn.textContent='Сохранить';
}

async function deleteItem(id){
  const i=items[id];if(!i)return;delete items[id];render();
  try{localStorage.setItem('wl_cache',JSON.stringify(items));}catch(e){}
  try{await deleteItemDb(id);}catch(e){}
  toast('Удалено: '+i.title,async()=>{items[id]=i;render();try{await upsertItem(i);}catch(e){}});
}

let curColl='all',infoId=null;

function updColl(){const s=$('collSel');if(!s)return;const cs=[...new Set(Object.values(items).filter(i=>i.cat===currentTab&&i.coll).map(i=>i.coll))];
  const h='<option value="all">Все коллекции</option>'+cs.map(c=>`<option>${esc(c)}</option>`).join('');if(s.dataset.h!==h){s.innerHTML=h;s.dataset.h=h;}
  if(!cs.includes(curColl))curColl='all';s.value=curColl;}

function toggleWant(id){
  const i=items[id];if(!i)return;const w={...(i.wants||{})},had=!!w[ME];if(had)delete w[ME];else w[ME]=1;beep();
  if(!extrasOn){patch(id,{wants:w});return;}
  items[id]={...i,wants:w};render();if(infoId===id&&$('info').classList.contains('open'))drawInfo();
  (had?xtDel('item_wants',`item_id=eq.${encodeURIComponent(id)}&author=eq.${encodeURIComponent(ME)}`):xtAdd('item_wants',{item_id:id,author:ME})).catch(()=>setSyncState('error','ошибка'));
}

let _pick=null,sugT,curFr='all',SF={};

function frProg(f){const a=Object.values(items).filter(i=>i.franchise===f);return a.filter(i=>sOf(i)==='done').length+'/'+a.length;}

function setFr(f){curFr=f;render();}

function updFr(){const s=$('frSel');if(!s)return;const fs=[...new Set(Object.values(items).map(i=>i.franchise).filter(Boolean))];
  const h='<option value="all">Все франшизы</option>'+fs.map(c=>`<option>${esc(c)}</option>`).join('');
  if(s.dataset.h!==h){s.innerHTML=h;s.dataset.h=h;$('frList').innerHTML=fs.map(c=>`<option value="${esc(c)}">`).join('');}
  if(!fs.includes(curFr))curFr='all';s.value=curFr;s.style.display=fs.length?'':'none';}

function bump(id){const i=items[id],S=i.season||1,seen={...(i.seen||{})},a=new Set(seen[S]||[]),n=(i.episode||0)+1;a.add(n);seen[S]=[...a].sort((x,y)=>x-y);patch(id,{episode:n,seen});beep();}


function smartOk(i){
  const f=SF,y=+i.info?.year||0,g=genresText(i).toLowerCase(),tags=((i.tags||'').toLowerCase());
  if(f.r&&avgR(i)<f.r)return false;if(f.y1&&(!y||y<f.y1))return false;if(f.y2&&(!y||y>f.y2))return false;
  if(f.g&&!f.g.some(x=>g.includes(x)))return false;if(f.t&&!f.t.some(x=>tags.includes(x)))return false;return true;
}

function readFlt(){SF={r:+$('sfR').value||0,y1:+$('sfY1').value||0,y2:+$('sfY2').value||0,g:($('sfG').value||'').trim().toLowerCase().split(',').filter(Boolean),t:($('sfT').value||'').trim().toLowerCase().split(',').filter(Boolean)};}

function writeFlt(){$('sfR').value=SF.r||'';$('sfY1').value=SF.y1||'';$('sfY2').value=SF.y2||'';$('sfG').value=(SF.g||[]).join(', ');$('sfT').value=(SF.t||[]).join(', ');}

function applyFlt(){readFlt();$('flt').classList.remove('open');render();$('fltBtn').style.outline=(SF.r||SF.y1||SF.y2||(SF.g&&SF.g.length)||(SF.t&&SF.t.length))?'2px solid var(--accent)':'';}

function resetFlt(){SF={};writeFlt();applyFlt();}

function saveView(){readFlt();const n=(prompt('Название вида?')||'').trim();if(!n)return;const v=JSON.parse(localStorage.getItem('wl_views')||'{}');v[n]=SF;localStorage.setItem('wl_views',JSON.stringify(v));drawViews();}

function openFlt(){renderPillRow('g');renderPillRow('t');$('flt').classList.add('open');}
function useView(n){SF=JSON.parse(localStorage.getItem('wl_views')||'{}')[n]||{};writeFlt();applyFlt();}

function toggleFltPill(k,v){
  const arr=SF[k]||[];
  const i=arr.indexOf(v);
  if(i>=0)arr.splice(i,1);else arr.push(v);
  SF[k]=arr;
  renderPillRow(k);
  applyFlt();
}

function renderPillRow(k){
  const box=$(k==='g'?'fltGenres':'fltTags');if(!box)return;
  let all=[];
  Object.values(items).filter(i=>i.cat===($('inputCat')?$('inputCat').value||currentTab:currentTab)).forEach(i=>{
    if(k==='g'){genresOf(i).forEach(x=>all.push(x.toLowerCase()));}
    else if(k==='t'){(i.tags||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).forEach(x=>all.push(x));}
  });
  all=[...new Set(all)].sort();
  const active=new Set(SF[k]||[]);
  box.innerHTML=all.map(v=>`<span class="pill${active.has(v)?' pill-active':''}" onclick="toggleFltPill('${k}','${esc(v)}')">${esc(v)}</span>`).join('');
}

function drawViews(){$('views').innerHTML=Object.keys(JSON.parse(localStorage.getItem('wl_views')||'{}')).map(n=>`<span class="stb" data-n="${esc(n)}" onclick="useView(this.dataset.n)">${esc(n)}</span>`).join('');}

let shown=60,lastTotal=0,sig='',showArch=false,px=0;

const io=new IntersectionObserver(e=>{if(e[0].isIntersecting){io.disconnect();shown+=60;render();}});

function mergeShared(k,cur,mine){
  if(k==='wants'){const r={...(cur||{})};if(mine[ME])r[ME]=1;else delete r[ME];return r;}
  if(k==='reacts'){const r={};cur=cur||{};new Set([...Object.keys(cur),...Object.keys(mine)]).forEach(e=>{const s=new Set(cur[e]||[]);(mine[e]||[]).includes(ME)?s.add(ME):s.delete(ME);r[e]=[...s];});return r;}
  const key=c=>c.by+c.ts+c.text,have=new Set((cur||[]).map(key));return[...(cur||[]),...mine.filter(c=>!have.has(key(c)))];
}

async function patch(id,o){
  const old=items[id];if(!old)return;items[id]={...old,...o};
  try{render();if(infoId===id&&$('info').classList.contains('open'))drawInfo();}catch(e){}
  try{for(const k of ['wants','reacts','comments'])if(k in o){const r=await sbFetch(`/items?id=eq.${encodeURIComponent(id)}&select=${k}`);items[id][k]=mergeShared(k,r?.[0]?.[k],o[k]);}
    await upsertItem(items[id]);render();}catch(e){setSyncState('error','ошибка');}
}

function render(){
  const sg=[currentTab,currentFilter,curStatus,searchQuery,curColl,curFr,currentSort,JSON.stringify(SF),showArch].join('|');if(sg!==sig){sig=sg;shown=60;}
  lastTotal=0;renderList();
  if(lastTotal>shown){$('list').insertAdjacentHTML('beforeend',`<div id="more" class="stb" style="grid-column:1/-1;text-align:center;padding:12px;cursor:pointer" onclick="shown+=60;render()">Показать ещё (${lastTotal-shown})</div>`);io.observe($('more'));}
  try{localStorage.setItem('wl_state',JSON.stringify({t:currentTab,f:currentFilter,s:currentSort}));}catch(e){}
}

/* Встроенная вкладка «Манга» есть у всех. Карточки из старой личной категории (она жила только на одном устройстве) переносим в неё. */
async function migrateManga(){
  const ids=(C.customCats||[]).filter(c=>c.kind==='manga'||c.name==='Манга').map(c=>c.id);
  if(!ids.length)return;
  let n=0;
  for(const i of Object.values(items))if(ids.includes(i.cat)){items[i.id]={...i,cat:'manga'};n++;try{await upsertItem(items[i.id]);}catch(e){}}
  C.customCats=C.customCats.filter(c=>!ids.includes(c.id));
  for(const id of ids){if(C.tabs&&C.tabs[id]){C.tabs.manga=C.tabs.manga||C.tabs[id];delete C.tabs[id];}if(C.icons&&C.icons[id]&&!C.icons.manga)C.icons.manga=C.icons[id];if(currentTab===id)currentTab='manga';}
  saveCustom();renderTabs();render();renderCustomCatList();renderIconPreviews();if(n)toast('Манга перенесена во встроенную вкладку: '+n);
}

/* ===== Сборка интерфейса этого модуля: шаги выполняются в порядке номеров (uiStep, см. util.js), номера хранят исходный порядок вставки элементов ===== */
uiStep(110, () => {
$('overlay').querySelector('.btn-row').insertAdjacentHTML('beforebegin',`
   <div class="field"><label>Статус</label><select id="fStatus">${Object.entries(ST).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
   <div class="field row3"><div><label>Сезон</label><input id="fSeason" type="number" min="0"></div><div><label>Серия</label><input id="fEpisode" type="number" min="0"></div><div><label>Всего серий</label><input id="fTotal" type="number" min="0"></div></div>
   <div class="field"><label>Моя оценка (1–10)</label><input id="fRating" type="number" min="0" max="10" step="0.5"></div>
   <div class="field"><label>Теги через запятую</label><input id="fTags" placeholder="хоррор, романтика"></div>
   <div class="field"><label>Постер (ссылка)</label><input id="fPoster" placeholder="https://… (у аниме найдётся сам)"></div>`);
});
uiStep(120, () => {
document.querySelector('.toolbar').insertAdjacentHTML('beforeend',`<select class="sort-select" onchange="curStatus=this.value;render()"><option value="all">Все статусы</option>${Object.entries(ST).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><button class="filter-btn" onclick="roulette()" title="Выбрать случайную карточку из «Хочу»">🎲 Что смотрим?</button>`);
});
uiStep(230, () => {
$('fPoster').closest('.field').insertAdjacentHTML('afterend','<div class="field"><label>Коллекция</label><input id="fColl" placeholder="например: Ужастики на Хэллоуин"></div>');
});
uiStep(240, () => {
document.querySelector('.toolbar').insertAdjacentHTML('beforeend','<select id="collSel" class="sort-select" onchange="curColl=this.value;render()"></select><button class="filter-btn" onclick="stats()" title="Показать статистику просмотренного">📊</button><button class="filter-btn" onclick="$(\'imp\').classList.add(\'open\')" title="Импортировать карточки из файла">📥</button><button class="filter-btn" onclick="fillPosters()" title="Автозаполнить постеры, описания, жанры для карточек без них">🔄 Дозаполнить данные</button>');
});
uiStep(260, () => {
updColl();
});
uiStep(270, () => {
$('inputTitle').insertAdjacentHTML('afterend','<div id="sug" class="sug"></div>');
});
uiStep(280, () => {
$('inputTitle').addEventListener('input',onTitle);
});
uiStep(290, () => {
$('fColl').closest('.field').insertAdjacentHTML('afterend','<div class="field"><label>Франшиза (общая для частей)</label><input id="fFr" list="frList" placeholder="Silent Hill"><datalist id="frList"></datalist></div>');
});
uiStep(300, () => {
document.querySelector('.toolbar').insertAdjacentHTML('beforeend','<select id="frSel" class="sort-select" onchange="curFr=this.value;render()" style="display:none"></select><button id="fltBtn" class="filter-btn" onclick="openFlt()" title="Умные фильтры (жанры, теги, год, оценка)">🔎</button>');
});
uiStep(310, () => {
document.body.insertAdjacentHTML('beforeend',`<div id="flt" class="overlay" onclick="if(event.target===this)this.classList.remove('open')"><div class="modal"><div class="modal-title">🔎 Умные фильтры</div>
   <div class="field row3"><div><label>Оценка от</label><input id="sfR" type="number" min="0" max="10" step=".5"></div><div><label>Год от</label><input id="sfY1" type="number"></div><div><label>Год до</label><input id="sfY2" type="number"></div></div>
   <div class="field"><label>Жанры</label><div class="pill-row" id="fltGenres"></div></div>
   <div class="field"><label>Теги</label><div class="pill-row" id="fltTags"></div></div>
   <div id="views" class="chips"></div>
   <div class="btn-row"><button class="btn btn-secondary" onclick="resetFlt()" title="Сбросить все фильтры">Сбросить</button><button class="btn btn-secondary" onclick="saveView()" title="Сохранить текущие фильтры как вид">💾 Вид</button><button class="btn btn-primary" onclick="applyFlt()" title="Применить выбранные фильтры">Применить</button></div></div></div>`);
});
uiStep(320, () => {
drawViews();
});
uiStep(330, () => {
updFr();
});
uiStep(360, () => {
document.querySelector('.toolbar').insertAdjacentHTML('beforeend','<button class="filter-btn" onclick="showArch=!showArch;this.style.outline=showArch?\'2px solid var(--accent)\':\'\';render()" title="Показать/скрыть карточки из архива">📦</button>');
});
uiStep(380, () => {
const c=localStorage.getItem('wl_cache');
  if(c&&isAuthed()){try{items=JSON.parse(c);render();}catch(e){}}else $('list').innerHTML=Array(6).fill('<div class="sk"></div>').join('');
});

/* ===== HOVER-ПРЕВЬЮ (ПК) =====
   Наводишь на карточку — справа появляется блок с постером, жанрами, описанием и быстрыми действиями.
   Работает только там, где есть настоящий курсор: тач-устройства не трогаем. */
const canHover=()=>matchMedia('(hover:hover) and (min-width:900px)').matches;
let hoverT=null,hoverEl=null;

function hideHover(){const b=$('hover');if(b)b.classList.remove('show');hoverEl=null;}

function hoverShow(el){
  if(!canHover()||!el)return;
  const ds=el.dataset;if(!ds||!ds.id)return;
  const i=items[ds.id];if(!i)return;
  let box=$('hover');
  if(!box){document.body.insertAdjacentHTML('beforeend','<div id="hover" class="hover-card"></div>');box=$('hover');}
  const gs=genresOf(i).slice(0,6).map(t=>`<span class="tg">${esc(t)}</span>`).join('');
  const desc=cleanDesc(i.info&&i.info.desc||'');
  box.innerHTML=`${i.poster?`<img class="hover-poster" src="${esc(i.poster)}" onerror="this.remove()">`:''}
    <div class="hover-body">
      <div class="hover-title">${esc(i.title)}</div>
      <div class="hover-meta">${[i.info&&i.info.year,i.info&&i.info.score?'⭐ '+esc(i.info.score):'',i.total?i.total+' эп.':''].filter(Boolean).join(' · ')}</div>
      ${gs?`<div class="chips">${gs}</div>`:''}
      ${desc?`<div class="hover-desc">${esc(desc.slice(0,420))}${desc.length>420?'…':''}</div>`:''}
      <div class="hover-acts">
        <button class="filter-btn" onclick="setStatus('${i.id}','watching')" title="Пометить как «Смотрю»">▶ Смотрю</button>
        <button class="filter-btn" onclick="hideHover();openInfo('${i.id}')" title="Открыть подробную карточку">Открыть</button>
        ${EP.includes(i.cat)?`<button class="filter-btn" onclick="bump('${i.id}')" title="Отметить следующую серию/главу">+1</button>`:''}
      </div>
    </div>`;
  box.classList.add('show');
  const r=el.getBoundingClientRect(),w=box.offsetWidth,h=box.offsetHeight;
  let x=r.right+12,y=r.top;
  if(x+w>innerWidth-8)x=r.left-w-12;
  if(x<8)x=8;
  y=Math.min(Math.max(8,y),Math.max(8,innerHeight-h-8));
  box.style.left=x+'px';box.style.top=y+'px';
}

document.addEventListener('mouseover',e=>{
  if(!canHover())return;
  const el=e.target.closest?e.target.closest('.item[data-id],.trow[data-id]'):null;
  if(!el||el===hoverEl)return;
  if(hoverEl&&hoverEl.contains(e.relatedTarget))return;
  hoverEl=el;clearTimeout(hoverT);
  hoverT=setTimeout(()=>hoverShow(el),280);
});
document.addEventListener('mouseout',e=>{
  const el=e.target.closest?e.target.closest('.item[data-id],.trow[data-id]'):null;
  if(!el)return;
  if(el.contains(e.relatedTarget))return;
  clearTimeout(hoverT);hoverT=setTimeout(hideHover,160);
});
addEventListener('scroll',()=>{clearTimeout(hoverT);hideHover();},{passive:true});
addEventListener('resize',hideHover);
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideHover();});
