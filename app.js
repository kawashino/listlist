// ===== SUPABASE CONFIG =====
const SUPA_URL = 'https://dspniootbeoebxefopia.supabase.co';
const SUPA_KEY = 'sb_publishable_XvUI2M2jmfixsE3d_ikJZQ_DXp5WyKY';

// ===== ПАРОЛЬ — поменяй на свой =====
const APP_PASSWORD = '11120309';
// ====================================

let items = {}, currentTab = 'anime', currentFilter = 'all', currentSort = 'date_desc', editingId = null, isSaving = false, searchQuery = '';
let realtimeChannel = null;

// ===== PASSWORD CHECK =====
function checkPassword() {
  const stored = sessionStorage.getItem('wl_auth');
  if (stored === APP_PASSWORD) return true;
  return false;
}

function showPasswordScreen() {
  document.getElementById('passwordScreen').style.display = 'flex';
  document.getElementById('mainWrapper').style.display = 'none';
  setTimeout(() => document.getElementById('passwordInput').focus(), 100);
}

function hidePasswordScreen() {
  document.getElementById('passwordScreen').style.display = 'none';
  document.getElementById('mainWrapper').style.display = 'flex';
}

function submitPassword() {
  const val = document.getElementById('passwordInput').value;
  if (val === APP_PASSWORD) {
    sessionStorage.setItem('wl_auth', APP_PASSWORD);
    hidePasswordScreen();
    initApp();
  } else {
    const err = document.getElementById('passwordError');
    err.style.display = 'block';
    document.getElementById('passwordInput').value = '';
    document.getElementById('passwordInput').focus();
    setTimeout(() => err.style.display = 'none', 2000);
  }
}

// ===== SUPABASE REST =====
async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`${res.status}: ${err}`); }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function loadAllItems() {
  const rows = await sbFetch('/items?select=*&order=ts.desc');
  items = {};
  (rows || []).forEach(r => { items[r.id] = r; });
}

async function upsertItem(item) {
  await sbFetch('/items', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(item)
  });
}

async function deleteItemDb(id) {
  await sbFetch(`/items?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ===== REALTIME =====
function startRealtime() {
  if (realtimeChannel) return;
  const wsUrl = SUPA_URL.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + SUPA_KEY + '&vsn=1.0.0';
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ topic: 'realtime:public:items', event: 'phx_join', payload: {}, ref: '1' }));
    setSyncState('live', 'онлайн');
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (['INSERT','UPDATE'].includes(msg.payload?.type)) { const r = msg.payload.record; if(r){items[r.id]=r;render();} }
      if (msg.payload?.type === 'DELETE') { const o = msg.payload.old_record; if(o?.id){delete items[o.id];render();} }
      if (msg.event === 'heartbeat') ws.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:null}));
    } catch(e) {}
  };
  ws.onerror = () => setSyncState('error', 'ошибка');
  ws.onclose = () => { setSyncState('error', 'переподключение...'); realtimeChannel=null; setTimeout(startRealtime,3000); };
  realtimeChannel = ws;
  setInterval(() => { if(ws.readyState===1) ws.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:null})); }, 25000);
}

// ===== INIT =====
window.addEventListener('load', () => {
  loadCustom();

  // password gate
  if (checkPassword()) {
    hidePasswordScreen();
    initApp();
  } else {
    showPasswordScreen();
  }

  document.getElementById('passwordInput').addEventListener('keydown', e => { if(e.key==='Enter') submitPassword(); });
  document.getElementById('inputTitle').addEventListener('keydown', e => { if(e.key==='Enter') saveItem(); });
  document.getElementById('searchInput').addEventListener('input', e => { searchQuery=e.target.value.toLowerCase(); render(); });
  initBgPosPad();
  renderIconPreviews();
  renderCustomCatList();
});

async function initApp() {
  setSyncState('loading', 'подключение...');
  try {
    await loadAllItems();
    render();
    setSyncState('live', 'онлайн');
    showMain();
    startRealtime();
  } catch(e) {
    setSyncState('error', 'ошибка');
    document.getElementById('setupScreen').classList.add('visible');
    document.getElementById('mainApp').style.display = 'none';
    showSetupError('Ошибка подключения: ' + e.message);
  }
}

function showMain() { document.getElementById('setupScreen').classList.remove('visible'); document.getElementById('mainApp').style.display='flex'; }
function resetSettings() { if(!confirm('Выйти из приложения?'))return; sessionStorage.removeItem('wl_auth'); location.reload(); }
function connectBin() { location.reload(); }
function showSetupError(m) { const e=document.getElementById('setupError'); if(e){e.textContent='⚠️ '+m;e.style.display='block';} }
function hideSetupError() { const e=document.getElementById('setupError'); if(e) e.style.display='none'; }
function setSyncState(s,l) { const d=document.getElementById('syncDot'),lb=document.getElementById('syncLabel'); if(d)d.className='sync-dot '+s; if(lb)lb.textContent=l; }

// ===== TABS =====
function getAllCats() {
  return [{id:'anime',name:'Аниме',icon:'🎌'},{id:'games',name:'Игры',icon:'🎮'},{id:'series',name:'Сериалы',icon:'📺'},{id:'films',name:'Фильмы',icon:'🎬'},...(C.customCats||[])];
}
function renderTabs() {
  const nav=document.getElementById('tabsNav'); if(!nav)return;
  const cats=getAllCats();
  document.documentElement.style.setProperty('--tab-count',cats.length);
  nav.innerHTML=cats.map(cat=>`
    <div class="tab${currentTab===cat.id?' active':''}" data-cat="${cat.id}" onclick="setTab('${cat.id}')">
      <span class="t-icon" id="icon-${cat.id}">${C.icons&&C.icons[cat.id]?`<img src="${C.icons[cat.id]}" style="width:22px;height:22px;object-fit:cover;border-radius:4px;">`:(cat.icon||'📂')}</span>
      <span>${cat.name}</span>
      <span class="badge" id="badge-${cat.id}"></span>
      ${cat.id.startsWith('cat_')?`<span class="tab-close" onclick="event.stopPropagation();removeCustomCat('${cat.id}')">✕</span>`:''}
    </div>`).join('');
}
function setTab(cat) { currentTab=cat; renderTabs(); document.getElementById('fab').dataset.cat=cat; render(); }
function setFilter(f,btn) { currentFilter=f; document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); render(); }
function setSort(v) { currentSort=v; render(); }

function sortItems(arr) {
  const cp=[...arr];
  switch(currentSort) {
    case 'date_asc':   return cp.sort((a,b)=>a.ts-b.ts);
    case 'alpha_asc':  return cp.sort((a,b)=>a.title.localeCompare(b.title,'ru'));
    case 'alpha_desc': return cp.sort((a,b)=>b.title.localeCompare(a.title,'ru'));
    case 'status':     return cp.sort((a,b)=>a.done-b.done);
    default:           return cp.sort((a,b)=>b.ts-a.ts);
  }
}

// ===== RENDER =====
function render() {
  renderTabs();
  const list=document.getElementById('list');
  let arr=Object.values(items).filter(i=>i.cat===currentTab);
  if(currentFilter==='done') arr=arr.filter(i=>i.done);
  else if(currentFilter==='todo') arr=arr.filter(i=>!i.done);
  if(searchQuery) arr=arr.filter(i=>i.title.toLowerCase().includes(searchQuery)||(i.note||'').toLowerCase().includes(searchQuery));
  arr=sortItems(arr);

  getAllCats().forEach(cat=>{
    const cnt=Object.values(items).filter(i=>i.cat===cat.id&&!i.done).length;
    const el=document.getElementById('badge-'+cat.id); if(el){el.textContent=cnt;el.classList.toggle('show',cnt>0);}
  });

  const allCat=Object.values(items).filter(i=>i.cat===currentTab);
  const doneCount=allCat.filter(i=>i.done).length;
  const et=document.getElementById('stat-total'),ed=document.getElementById('stat-done'),el2=document.getElementById('stat-left');
  if(et)et.textContent=allCat.length; if(ed)ed.textContent=doneCount; if(el2)el2.textContent=allCat.length-doneCount;

  if(!arr.length){
    const cats=getAllCats(); const cat=cats.find(c=>c.id===currentTab)||{};
    const ico=C.icons&&C.icons[currentTab]?`<img src="${C.icons[currentTab]}" style="width:52px;height:52px;object-fit:cover;border-radius:12px;">`:(cat.icon||'📂');
    list.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-icon">${ico}</div><p>Список пуст.<br>Нажми <strong>+</strong> чтобы добавить!</p></div>`;
    return;
  }

  const checkIc=C.icons&&C.icons.check, editIc=C.icons&&C.icons.edit, delIc=C.icons&&C.icons.del;
  list.innerHTML=arr.map(item=>{
    const checkContent=item.done?(checkIc?`<img src="${checkIc}">`:'✓'):'';
    return `<div class="item${item.done?' done':''}">
      <div class="check" onclick="toggleDone('${item.id}')">${checkContent}</div>
      <div class="item-body">
        <div class="item-title">${esc(item.title)}</div>
        ${item.note?`<div class="item-meta">${esc(item.note)}</div>`:''}
        ${item.link?`<a href="${esc(item.link)}" target="_blank" style="font-size:11px;color:var(--accent2);text-decoration:none;margin-top:3px;display:inline-block;">🔗 Открыть</a>`:''}
      </div>
      <div class="item-actions">
        <button class="btn-icon" onclick="editItem('${item.id}')">${editIc?`<img src="${editIc}">`:'✏️'}</button>
        <button class="btn-icon del" onclick="deleteItem('${item.id}')">${delIc?`<img src="${delIc}">`:'🗑️'}</button>
      </div>
    </div>`;
  }).join('');

  if(C.rgb.text&&rgbRaf)     document.querySelectorAll('.item-title').forEach(el=>el.style.color=`hsl(${rgbHue},${C.rgb.sat}%,${C.rgb.light}%)`);
  if(C.rgb.metaText&&rgbRaf) document.querySelectorAll('.item-meta').forEach(el=>el.style.color=`hsl(${(rgbHue+40)%360},${C.rgb.sat}%,${C.rgb.light}%)`);
}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ===== CRUD =====
async function toggleDone(id){
  if(!items[id])return; items[id]={...items[id],done:!items[id].done}; render();
  try{await upsertItem(items[id]);}catch(e){setSyncState('error','ошибка');}
}
async function deleteItem(id){
  if(!items[id])return; delete items[id]; render();
  try{await deleteItemDb(id);}catch(e){setSyncState('error','ошибка');}
}
function editItem(id){
  const item=items[id]; if(!item)return;
  editingId=id;
  document.getElementById('modalTitle').textContent='Редактировать';
  document.getElementById('inputTitle').value=item.title;
  document.getElementById('inputNote').value=item.note||'';
  document.getElementById('inputLink').value=item.link||'';
  rebuildCatSelect(); document.getElementById('inputCat').value=item.cat;
  document.getElementById('overlay').classList.add('open');
  setTimeout(()=>document.getElementById('inputTitle').select(),50);
}
async function saveItem(){
  const title=document.getElementById('inputTitle').value.trim();
  if(!title){document.getElementById('inputTitle').focus();return;}
  const note=document.getElementById('inputNote').value.trim();
  const link=document.getElementById('inputLink').value.trim();
  const cat=document.getElementById('inputCat')?.value||currentTab;
  const btn=document.getElementById('saveBtn'); btn.disabled=true; btn.textContent='Сохраняем...';
  let item;
  if(editingId){ item={...items[editingId],title,note,link,cat}; }
  else{ const id=Date.now().toString(36)+Math.random().toString(36).slice(2,6); item={id,cat,title,note,link,done:false,ts:Date.now()}; }
  items[item.id]=item; render(); closeModal();
  try{await upsertItem(item);setSyncState('live','сохранено');}
  catch(e){setSyncState('error','ошибка сохранения');}
  btn.disabled=false; btn.textContent='Сохранить';
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
function closeModal(){document.getElementById('overlay').classList.remove('open');editingId=null;}
function maybeClose(e){if(e.target===document.getElementById('overlay'))closeModal();}

// ===== CUSTOM CATS =====
function addCustomCat(){
  const inp=document.getElementById('newCatName'),ico=document.getElementById('newCatIcon');
  const name=(inp.value||'').trim(); if(!name)return;
  const id='cat_'+Date.now();
  C.customCats.push({id,name,icon:ico.value||'📂'});
  inp.value=''; ico.value='📂';
  saveCustom(); renderTabs(); renderIconPreviews();
}
function removeCustomCat(id){
  C.customCats=C.customCats.filter(c=>c.id!==id);
  if(currentTab===id)currentTab='anime';
  saveCustom(); renderTabs(); render();
}
function renderCustomCatList(){
  const container=document.getElementById('customCatList'); if(!container)return;
  if(!C.customCats||!C.customCats.length){container.innerHTML='<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px">Нет категорий</div>';return;}
  container.innerHTML=C.customCats.map(cat=>`
    <div class="cr">
      <span style="font-size:18px">${cat.icon||'📂'}</span>
      <span class="cl">${cat.name}</span>
      <button class="reset-sm" onclick="removeCustomCat('${cat.id}');renderCustomCatList()">Удалить</button>
    </div>`).join('');
}
