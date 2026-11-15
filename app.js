// ===== JSONBIN =====
const API_BASE = 'https://api.jsonbin.io/v3';
let API_KEY='', BIN_ID='';
let items={}, currentTab='anime', currentFilter='all', currentSort='date_desc', editingId=null, isSaving=false, pollTimer=null, searchQuery='';

// ===== INIT =====
window.addEventListener('load', ()=>{
  loadCustom();
  API_KEY = localStorage.getItem('wl_apikey')||'';
  BIN_ID  = localStorage.getItem('wl_binid')||'';
  if(API_KEY && BIN_ID){ showMain(); loadFromBin(); startPolling(); }
  else{ showSetup(); if(API_KEY){document.getElementById('apiKeyInput').value=API_KEY; document.getElementById('binFieldWrap').style.display='flex';} }
  document.getElementById('apiKeyInput').addEventListener('input',()=>{
    document.getElementById('binFieldWrap').style.display = document.getElementById('apiKeyInput').value.trim()?'flex':'none';
  });
  document.getElementById('inputTitle').addEventListener('keydown', e=>{ if(e.key==='Enter') saveItem(); });
  document.getElementById('searchInput').addEventListener('input', e=>{ searchQuery=e.target.value.toLowerCase(); render(); });
  initBgPosPad();
  renderIconPreviews();
  renderCustomCatList();
});

// ===== SETUP =====
function showSetup(){ document.getElementById('setupScreen').classList.add('visible'); document.getElementById('mainApp').style.display='none'; setSyncState('error','не настроен'); }
function showMain(){ document.getElementById('setupScreen').classList.remove('visible'); document.getElementById('mainApp').style.display='flex'; }
function resetSettings(){ if(!confirm('Сбросить настройки подключения?'))return; localStorage.removeItem('wl_apikey'); localStorage.removeItem('wl_binid'); clearInterval(pollTimer); API_KEY=''; BIN_ID=''; items={}; document.getElementById('apiKeyInput').value=''; document.getElementById('binIdInput').value=''; showSetup(); }

async function connectBin(){
  const key=document.getElementById('apiKeyInput').value.trim(), bid=document.getElementById('binIdInput').value.trim();
  if(!key){showSetupError('Введи Secret Key');return;}
  const btn=document.getElementById('connectBtn'); btn.disabled=true; btn.textContent='Подключаем...'; hideSetupError(); API_KEY=key;
  if(bid){ const ok=await tryLoadBin(bid); if(!ok){btn.disabled=false;btn.textContent='Подключить';return;} BIN_ID=bid; }
  else{ const id=await createBin(); if(!id){btn.disabled=false;btn.textContent='Подключить';return;} BIN_ID=id; alert('✅ Готово! Твой Bin ID:\n\n'+BIN_ID+'\n\nОтправь его второму человеку.'); }
  localStorage.setItem('wl_apikey',API_KEY); localStorage.setItem('wl_binid',BIN_ID); showMain(); startPolling();
}
async function tryLoadBin(id){ try{const r=await fetch(`${API_BASE}/b/${id}/latest`,{headers:{'X-Master-Key':API_KEY}});if(!r.ok){showSetupError('Не удалось загрузить Bin. ('+r.status+')');return false;}const d=await r.json();items=d.record?.items||{};render();setSyncState('live','синхронизировано');return true;}catch(e){showSetupError('Ошибка: '+e.message);return false;} }
async function createBin(){ try{const r=await fetch(`${API_BASE}/b`,{method:'POST',headers:{'Content-Type':'application/json','X-Master-Key':API_KEY,'X-Bin-Name':'watchlist','X-Bin-Private':'false'},body:JSON.stringify({items:{}})});if(!r.ok){showSetupError('Не удалось создать Bin. ('+r.status+')');return null;}const d=await r.json();return d.metadata?.id||null;}catch(e){showSetupError('Ошибка: '+e.message);return null;} }
function showSetupError(m){ const e=document.getElementById('setupError'); e.textContent='⚠️ '+m; e.style.display='block'; }
function hideSetupError(){ document.getElementById('setupError').style.display='none'; }

// ===== SYNC =====
function setSyncState(s,l){ document.getElementById('syncDot').className='sync-dot '+s; document.getElementById('syncLabel').textContent=l; }
async function loadFromBin(){ if(!API_KEY||!BIN_ID)return; setSyncState('loading','загрузка...'); try{const r=await fetch(`${API_BASE}/b/${BIN_ID}/latest`,{headers:{'X-Master-Key':API_KEY}});if(!r.ok)throw new Error(r.status);const d=await r.json();items=d.record?.items||{};render();setSyncState('live','синхронизировано');}catch(e){setSyncState('error','ошибка');} }
async function saveToBin(){ if(!API_KEY||!BIN_ID||isSaving)return; isSaving=true; setSyncState('loading','сохранение...'); try{const r=await fetch(`${API_BASE}/b/${BIN_ID}`,{method:'PUT',headers:{'Content-Type':'application/json','X-Master-Key':API_KEY},body:JSON.stringify({items})});if(!r.ok)throw new Error(r.status);setSyncState('live','сохранено');}catch(e){setSyncState('error','ошибка');}finally{isSaving=false;} }
function startPolling(){ clearInterval(pollTimer); pollTimer=setInterval(loadFromBin,15000); }

// ===== TABS =====
function getAllCats(){
  const base=[{id:'anime',name:'Аниме',icon:'🎌'},{id:'games',name:'Игры',icon:'🎮'},{id:'series',name:'Сериалы',icon:'📺'},{id:'films',name:'Фильмы',icon:'🎬'}];
  return [...base, ...(C.customCats||[])];
}

function renderTabs(){
  const nav=document.getElementById('tabsNav'); if(!nav)return;
  const cats=getAllCats();
  document.documentElement.style.setProperty('--tab-count', cats.length);
  nav.innerHTML = cats.map(cat=>`
    <div class="tab${currentTab===cat.id?' active':''}" data-cat="${cat.id}" onclick="setTab('${cat.id}')">
      <span class="t-icon" id="icon-${cat.id}">${C.icons&&C.icons[cat.id]?`<img src="${C.icons[cat.id]}" style="width:22px;height:22px;object-fit:cover;border-radius:4px;">`:(cat.icon||'📂')}</span>
      <span>${cat.name}</span>
      <span class="badge" id="badge-${cat.id}"></span>
      ${cat.id.startsWith('cat_')?`<span class="tab-close" onclick="event.stopPropagation();removeCustomCat('${cat.id}')">✕</span>`:''}
    </div>
  `).join('');
  // set tab colors for custom cats
  cats.forEach(cat=>{
    const tabEl=nav.querySelector(`[data-cat="${cat.id}"]`); if(!tabEl)return;
    if(cat.id.startsWith('cat_')){
      tabEl.style.setProperty('color','var(--accent)');
    }
    if(currentTab===cat.id){
      const color=C['tab'+cat.id.charAt(0).toUpperCase()+cat.id.slice(1)]||C.accent||'#7c5cfc';
      tabEl.style.borderTopColor=color;
      tabEl.style.color=color;
    }
  });
}

function setTab(cat){ currentTab=cat; renderTabs(); document.getElementById('fab').dataset.cat=cat; render(); }

// ===== FILTER / SORT =====
function setFilter(f,btn){ currentFilter=f; document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); render(); }
function setSort(v){ currentSort=v; render(); }

// ===== SORT =====
function sortItems(arr){
  const cp=[...arr];
  switch(currentSort){
    case 'date_asc':   return cp.sort((a,b)=>a.ts-b.ts);
    case 'alpha_asc':  return cp.sort((a,b)=>a.title.localeCompare(b.title,'ru'));
    case 'alpha_desc': return cp.sort((a,b)=>b.title.localeCompare(a.title,'ru'));
    case 'status':     return cp.sort((a,b)=>a.done-b.done);
    default:           return cp.sort((a,b)=>b.ts-a.ts);
  }
}

// ===== RENDER =====
function render(){
  renderTabs();
  const list=document.getElementById('list');
  let arr=Object.values(items).filter(i=>i.cat===currentTab);
  if(currentFilter==='done') arr=arr.filter(i=>i.done);
  else if(currentFilter==='todo') arr=arr.filter(i=>!i.done);
  if(searchQuery) arr=arr.filter(i=>i.title.toLowerCase().includes(searchQuery)||(i.note||'').toLowerCase().includes(searchQuery));
  arr=sortItems(arr);

  // badges
  getAllCats().forEach(cat=>{
    const cnt=Object.values(items).filter(i=>i.cat===cat.id&&!i.done).length;
    const el=document.getElementById('badge-'+cat.id); if(el){el.textContent=cnt;el.classList.toggle('show',cnt>0);}
  });

  // stats
  const allCat=Object.values(items).filter(i=>i.cat===currentTab);
  const doneCount=allCat.filter(i=>i.done).length;
  const el_total=document.getElementById('stat-total'), el_done=document.getElementById('stat-done'), el_left=document.getElementById('stat-left');
  if(el_total) el_total.textContent=allCat.length;
  if(el_done) el_done.textContent=doneCount;
  if(el_left) el_left.textContent=allCat.length-doneCount;

  if(!arr.length){
    const cats=getAllCats(); const cat=cats.find(c=>c.id===currentTab)||{};
    const ico=C.icons&&C.icons[currentTab]?`<img src="${C.icons[currentTab]}" style="width:52px;height:52px;object-fit:cover;border-radius:12px;">`:(cat.icon||'📂');
    list.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-icon">${ico}</div><p>Список пуст.<br>Нажми <strong>+</strong> чтобы добавить!</p></div>`;
    return;
  }

  // check icon
  const checkIc=C.icons&&C.icons.check;
  const editIc=C.icons&&C.icons.edit;
  const delIc=C.icons&&C.icons.del;

  list.innerHTML=arr.map(item=>{
    const checkContent=item.done?(checkIc?`<img src="${checkIc}">`:'✓'):'';
    const editBtn=editIc?`<img src="${editIc}">`:'✏️';
    const delBtn=delIc?`<img src="${delIc}">`:'🗑️';
    return `<div class="item${item.done?' done':''}">
      <div class="check" onclick="toggleDone('${item.id}')">${checkContent}</div>
      <div class="item-body">
        <div class="item-title">${esc(item.title)}</div>
        ${item.note?`<div class="item-meta">${esc(item.note)}</div>`:''}
        ${item.link?`<a href="${esc(item.link)}" target="_blank" style="font-size:11px;color:var(--accent2);text-decoration:none;margin-top:3px;display:inline-block;">🔗 Открыть</a>`:''}
      </div>
      <div class="item-actions">
        <button class="btn-icon" onclick="editItem('${item.id}')" title="Редактировать">${editBtn}</button>
        <button class="btn-icon del" onclick="deleteItem('${item.id}')" title="Удалить">${delBtn}</button>
      </div>
    </div>`;
  }).join('');

  // rgb text
  if(C.rgb.text&&rgbRaf) document.querySelectorAll('.item-title').forEach(el=>el.style.color=`hsl(${rgbHue},${C.rgb.sat}%,${C.rgb.light}%)`);
  if(C.rgb.metaText&&rgbRaf) document.querySelectorAll('.item-meta').forEach(el=>el.style.color=`hsl(${(rgbHue+40)%360},${C.rgb.sat}%,${C.rgb.light}%)`);
}

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ===== CRUD =====
async function toggleDone(id){ if(!items[id])return; items[id]={...items[id],done:!items[id].done}; render(); await saveToBin(); }
async function deleteItem(id){ if(!items[id])return; delete items[id]; render(); await saveToBin(); }

function editItem(id){
  const item=items[id]; if(!item)return;
  editingId=id;
  document.getElementById('modalTitle').textContent='Редактировать';
  document.getElementById('inputTitle').value=item.title;
  document.getElementById('inputNote').value=item.note||'';
  document.getElementById('inputLink').value=item.link||'';
  const catSel=document.getElementById('inputCat'); if(catSel){ rebuildCatSelect(); catSel.value=item.cat; }
  document.getElementById('overlay').classList.add('open');
  setTimeout(()=>document.getElementById('inputTitle').select(),50);
}

async function saveItem(){
  const title=document.getElementById('inputTitle').value.trim();
  if(!title){document.getElementById('inputTitle').focus();return;}
  const note=document.getElementById('inputNote').value.trim();
  const link=document.getElementById('inputLink').value.trim();
  const catSel=document.getElementById('inputCat');
  const cat=catSel?catSel.value:currentTab;
  const btn=document.getElementById('saveBtn'); btn.disabled=true; btn.textContent='Сохраняем...';
  if(editingId){ items[editingId]={...items[editingId],title,note,link,cat}; }
  else{ const id=Date.now().toString(36)+Math.random().toString(36).slice(2,6); items[id]={id,cat,title,note,link,done:false,ts:Date.now()}; }
  render(); closeModal(); await saveToBin(); btn.disabled=false; btn.textContent='Сохранить';
}

function rebuildCatSelect(){
  const sel=document.getElementById('inputCat'); if(!sel)return;
  sel.innerHTML=getAllCats().map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  sel.value=currentTab;
}

// ===== MODAL =====
function openModal(){
  editingId=null;
  document.getElementById('modalTitle').textContent='Добавить';
  document.getElementById('inputTitle').value='';
  document.getElementById('inputNote').value='';
  document.getElementById('inputLink').value='';
  rebuildCatSelect();
  document.getElementById('overlay').classList.add('open');
  setTimeout(()=>document.getElementById('inputTitle').focus(),100);
}
function closeModal(){ document.getElementById('overlay').classList.remove('open'); editingId=null; }
function maybeClose(e){ if(e.target===document.getElementById('overlay'))closeModal(); }

// ===== CUSTOM CATS PANEL LIST =====
function renderCustomCatList(){
  const container=document.getElementById('customCatList'); if(!container)return;
  if(!C.customCats||!C.customCats.length){ container.innerHTML='<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px">Нет пользовательских категорий</div>'; return; }
  container.innerHTML=C.customCats.map(cat=>`
    <div class="cr">
      <span style="font-size:18px">${cat.icon||'📂'}</span>
      <span class="cl">${cat.name}</span>
      <button class="reset-sm" onclick="removeCustomCat('${cat.id}')">Удалить</button>
    </div>`).join('');
}
