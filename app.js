// ===== SUPABASE CONFIG =====
const SUPA_URL = 'https://dspniootbeoebxefopia.supabase.co';
const SUPA_KEY = 'sb_publishable_XvUI2M2jmfixsE3d_ikJZQ_DXp5WyKY';

// ===== ЗАЩИТА ВХОДОМ (пароль хранится только как хеш) =====
const PW_SALT = 'wl-a00e84dea84412e4';
const PW_ITER = 150000;
const PW_HASH = '1ba1c8fa0387cfc44eea7169dd568f015103279dc32a45c2526acec241e06aad';
// Новый пароль: открой makehash.html, введи пароль и вставь полученный хеш в PW_HASH
// =========================================================

let items = {}, currentTab = 'anime', currentFilter = 'all', currentSort = 'date_desc', editingId = null, isSaving = false, searchQuery = '';
let realtimeChannel = null;

// ===== PASSWORD GATE =====
async function hashPw(pw) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(PW_SALT), iterations: PW_ITER, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function isAuthed() {
  const saved = localStorage.getItem('wl_auth') || sessionStorage.getItem('wl_auth');
  return saved === PW_HASH;
}

function lockApp() {
  document.getElementById('mainWrapper').style.display = 'none';
  document.getElementById('passwordScreen').classList.add('show');
  setTimeout(() => document.getElementById('passwordInput').focus(), 80);
}

function unlockApp() {
  document.getElementById('passwordScreen').classList.remove('show');
  document.getElementById('mainWrapper').style.display = 'flex';
}

async function submitPassword() {
  const input = document.getElementById('passwordInput');
  const btn = document.getElementById('pwBtn');
  const val = input.value;
  if (!val) { input.focus(); return; }
  btn.disabled = true;
  const h = await hashPw(val);
  btn.disabled = false;
  if (h === PW_HASH) {
    sessionStorage.removeItem('wl_auth'); localStorage.removeItem('wl_auth');
    const remember = document.getElementById('pwRemember').checked;
    (remember ? localStorage : sessionStorage).setItem('wl_auth', h);
    input.value = '';
    unlockApp();
    initApp();
  } else {
    const box = document.getElementById('pwBox');
    const err = document.getElementById('passwordError');
    err.classList.add('show');
    box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
    input.value = ''; input.focus();
    clearTimeout(window._pwErrT);
    window._pwErrT = setTimeout(() => err.classList.remove('show'), 2200);
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

const SNAP = {};  // последнее известное серверное состояние карточек: в базу уходят только изменённые поля
async function loadAllItems() {
  try {
    const rows = await Promise.race([sbFetch('/items?select=*&order=ts.desc'), new Promise((_, no) => setTimeout(() => no(new Error('сервер не отвечает')), 12000))]);
    items = {};
    (rows || []).forEach(r => { items[r.id] = r; });
    await loadExtras();
    STAT.fetch = Date.now();
    localStorage.setItem('wl_cache', JSON.stringify(items));
  } catch(e) {
    const c = localStorage.getItem('wl_cache');   // нет сети: показываем последний сохранённый список
    if (!c) throw e;
    items = JSON.parse(c);
    setSyncState('error', 'офлайн');
  }
  Object.values(items).forEach(i => SNAP[i.id] = JSON.stringify(i));
}

async function upsertItem(item) {
  lastLocalWrite = Date.now();
  let body = item;
  if (extrasOn) { body = { ...item }; XKEYS.forEach(k => delete body[k]); }   // эти поля живут в своих таблицах
  const old = SNAP[item.id] ? JSON.parse(SNAP[item.id]) : null;
  if (!old) {
    await sbFetch('/items', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(body)
    });
  } else {
    const d = {};
    for (const k in body) if (JSON.stringify(body[k]) !== JSON.stringify(old[k])) d[k] = body[k];
    if (!Object.keys(d).length) return;
    await sbFetch('/items?id=eq.' + encodeURIComponent(item.id), { method: 'PATCH', body: JSON.stringify(d) });
  }
  SNAP[item.id] = JSON.stringify(body);
}

async function deleteItemDb(id) {
  lastLocalWrite = Date.now();
  await sbFetch(`/items?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ===== ШИНА СОБЫТИЙ: ядро ничего не знает о модулях, модули подписываются в main.js =====
const Hooks = {};
function on(name, fn) { (Hooks[name] = Hooks[name] || []).push(fn); }
function emit(name, ...a) { (Hooks[name] || []).forEach(f => f(...a)); }
const avgR=i=>{const r=Object.values(i.ratings||{}).filter(v=>v>0);return r.length?r.reduce((a,b)=>a+b,0)/r.length:(+i.info?.score||0);};
const STAT = { fetch: 0, rt: 'нет', rtAt: 0 };   // для экрана «Состояние»

// ===== КОММЕНТАРИИ, РЕАКЦИИ, «ХОЧУ»: отдельные таблицы, каждая запись независима, поэтому правки двоих не затирают друг друга =====
let extrasOn = false;                              // true, когда таблицы item_wants / item_reacts / item_comments созданы
const XKEYS = ['wants', 'reacts', 'comments'];
const XTABLES = ['items', 'item_wants', 'item_reacts', 'item_comments'];
async function xtAdd(table, row) { await sbFetch('/' + table, { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify(row) }); }
async function xtDel(table, q) { await sbFetch('/' + table + '?' + q, { method: 'DELETE' }); }
async function loadExtras() {
  try {
    const [w, r, c] = await Promise.all([sbFetch('/item_wants?select=*'), sbFetch('/item_reacts?select=*'), sbFetch('/item_comments?select=*&order=ts.asc')]);
    extrasOn = true;
    Object.values(items).forEach(i => { i.wants = {}; i.reacts = {}; i.comments = []; });
    (w || []).forEach(x => { const i = items[x.item_id]; if (i) i.wants[x.author] = 1; });
    (r || []).forEach(x => { const i = items[x.item_id]; if (i) (i.reacts[x.emoji] = i.reacts[x.emoji] || []).push(x.author); });
    (c || []).forEach(x => { const i = items[x.item_id]; if (i) i.comments.push({ by: x.author, text: x.body, ts: x.ts, id: x.id }); });
  } catch (e) { extrasOn = false; }                // таблиц ещё нет: работаем по-старому
}
function applyRemoteExtra(table, type, rec, old) {
  const r = (type === 'DELETE' ? old : rec) || {}, i = items[r.item_id]; if (!i) return;
  if (table === 'item_wants') { i.wants = { ...(i.wants || {}) }; if (type === 'DELETE') delete i.wants[r.author]; else i.wants[r.author] = 1; }
  else if (table === 'item_reacts') { i.reacts = { ...(i.reacts || {}) }; const a = new Set(i.reacts[r.emoji] || []); if (type === 'DELETE') a.delete(r.author); else a.add(r.author); i.reacts[r.emoji] = [...a]; }
  else if (table === 'item_comments') { i.comments = (i.comments || []).filter(c => c.id !== r.id); if (type !== 'DELETE') i.comments.push({ by: r.author, text: r.body, ts: r.ts, id: r.id }); i.comments.sort((a, b) => a.ts - b.ts); }
  render();
}

// ===== REALTIME (протокол Supabase Realtime v2) + запасной опрос =====
let lastLocalWrite = 0, rtTimer = null;
function applyRemote(type, rec, old) {
  if (type === 'DELETE') { const id = (old && old.id) || (rec && rec.id); if (id) { delete items[id]; delete SNAP[id]; } }
  else if (rec && rec.id) { const p = items[rec.id] || {}; items[rec.id] = extrasOn ? { ...rec, wants: p.wants || {}, reacts: p.reacts || {}, comments: p.comments || [] } : rec; SNAP[rec.id] = JSON.stringify(rec); }
  render();
}
function startRealtime() {
  if (realtimeChannel) return;
  const ws = new WebSocket(SUPA_URL.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + SUPA_KEY + '&vsn=1.0.0');
  ws.onopen = () => {
    ws.send(JSON.stringify({ topic: 'realtime:items-sync', event: 'phx_join', ref: '1', join_ref: '1',
      payload: { config: { broadcast: { ack: false, self: false }, presence: { key: '' }, postgres_changes: XTABLES.map(t => ({ event: '*', schema: 'public', table: t })), private: false }, access_token: SUPA_KEY } }));
    clearInterval(rtTimer);
    rtTimer = setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(Date.now()) })); }, 25000);
  };
  ws.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      if (m.event === 'phx_reply' && m.topic === 'realtime:items-sync') {
        if (m.payload && m.payload.status === 'ok') { STAT.rt = 'подключено'; setSyncState('live', 'онлайн'); }
        else setSyncState('error', 'realtime: ' + ((m.payload && m.payload.response && m.payload.response.reason) || 'ошибка'));
      } else if (m.event === 'postgres_changes') {
        const d = m.payload && m.payload.data;
        if (d) { STAT.rtAt = Date.now(); if (d.table && d.table !== 'items') applyRemoteExtra(d.table, d.type, d.record, d.old_record); else applyRemote(d.type, d.record, d.old_record); }
      }
    } catch (err) {}
  };
  ws.onerror = () => { STAT.rt = 'ошибка'; setSyncState('error', 'ошибка соединения'); };
  ws.onclose = () => { STAT.rt = 'переподключение'; realtimeChannel = null; clearInterval(rtTimer); setTimeout(startRealtime, 3000); };
  realtimeChannel = ws;
}
// Запасной путь, если realtime не включён или соединение молчит: обновляем список по таймеру и при возврате на вкладку.
async function refreshItems() {
  if (Date.now() - lastLocalWrite < 5000) return;   // не затираем только что сделанные правки
  try {
    const rows = await sbFetch('/items?select=*&order=ts.desc');
    items = {}; (rows || []).forEach(r => { items[r.id] = r; SNAP[r.id] = JSON.stringify(r); });
    await loadExtras(); STAT.fetch = Date.now();
    try { localStorage.setItem('wl_cache', JSON.stringify(items)); } catch (e) {}
    render();
  } catch (e) {}
}
setInterval(() => { if (!document.hidden && typeof authedNow === 'function' && authedNow()) refreshItems(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && typeof authedNow === 'function' && authedNow()) refreshItems(); });
addEventListener('online', () => { if (typeof authedNow === 'function' && authedNow()) refreshItems(); });

// ===== INIT =====
window.addEventListener('load', () => {
  loadCustom();

  // password gate
  if (isAuthed()) { unlockApp(); initApp(); }
  else { lockApp(); }

  document.getElementById('passwordInput').addEventListener('keydown', e => { if(e.key==='Enter') submitPassword(); });
  document.getElementById('inputTitle').addEventListener('keydown', e => { if(e.key==='Enter') saveItem(); });
  document.getElementById('searchInput').addEventListener('input', e => { searchQuery=e.target.value.toLowerCase(); render(); });
  initBgPosPad();
  renderIconPreviews();
  renderCustomCatList();
});

async function initApp() {
  emit('beforeInit');
  setSyncState('loading', 'подключение...');
  try {
    await loadAllItems();
    render();
    setSyncState('live', 'онлайн');
    showMain();
    startRealtime();
    emit('itemsLoaded');
  } catch(e) {
    setSyncState('error', 'ошибка');
    document.getElementById('setupScreen').classList.add('visible');
    document.getElementById('mainApp').style.display = 'none';
    showSetupError('Ошибка подключения: ' + e.message);
  }
  emit('afterInit');
}

function authedNow() { return typeof isAuthed === 'function' && isAuthed() && document.getElementById('mainWrapper') && document.getElementById('mainWrapper').style.display !== 'none'; }
function showMain() { document.getElementById('setupScreen').classList.remove('visible'); document.getElementById('mainApp').style.display='flex'; }
function resetSettings() { if(!confirm('Выйти из приложения?'))return; sessionStorage.removeItem('wl_auth'); localStorage.removeItem('wl_auth'); location.reload(); }
function connectBin() { location.reload(); }
function showSetupError(m) { const e=document.getElementById('setupError'); if(e){e.textContent='⚠️ '+m;e.style.display='block';} }
function hideSetupError() { const e=document.getElementById('setupError'); if(e) e.style.display='none'; }
function setSyncState(s,l) { const d=document.getElementById('syncDot'),lb=document.getElementById('syncLabel'); if(d)d.className='sync-dot '+s; if(lb)lb.textContent=l; }

// ===== TABS =====
function baseCats() {
  return [{id:'anime',name:'Аниме',icon:'🎌'},{id:'games',name:'Игры',icon:'🎮'},{id:'series',name:'Сериалы',icon:'📺'},{id:'films',name:'Фильмы',icon:'🎬'},{id:'manga',name:'Манга',icon:'📖'},...(C.customCats||[])];
}
// видимые вкладки с учётом переименования, порядка и скрытия из настроек (C.tabs)
function getAllCats() {
  const t = C.tabs || {};
  return baseCats().map((c, k) => ({...c, name: t[c.id]?.n || c.name, _o: t[c.id]?.o ?? k, _h: t[c.id]?.h})).filter(c => !c._h).sort((a, b) => a._o - b._o);
}
function renderTabs() {
  const v = getAllCats(); if (v.length && !v.some(c => c.id === currentTab)) currentTab = v[0].id;  // скрытую вкладку не показываем
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
  colorTabs();
}
function colorTabs() {
  document.querySelectorAll('.tab').forEach(t => {
    const id = t.dataset.cat, c = C.tabs?.[id]?.c || (id.startsWith('cat_') ? 'var(--accent)' : id === 'manga' ? '#10b981' : '');
    if (t.classList.contains('active') && c) { t.style.color = c; t.style.borderTop = '2px solid ' + c; }
    else { t.style.color = ''; t.style.borderTop = ''; }
  });
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
    case 'rating':     return cp.sort((x,y)=>avgR(y)-avgR(x));
    case 'year':       return cp.sort((x,y)=>(+y.info?.year||0)-(+x.info?.year||0));
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
