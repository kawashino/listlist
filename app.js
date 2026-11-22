// ===== КОНФИГ =====
// Значения живут в config.js (он в .gitignore). Шаблон — config.example.js.
const CFG = window.WL_CONFIG || {};
const SUPA_URL = CFG.SUPA_URL || '';
const SUPA_KEY = CFG.SUPA_KEY || '';

// ===== ЗАЩИТА ВХОДОМ (в коде только параметры, сам хеш — в config.js) =====
const PW_SALT = CFG.PW_SALT || '';
const PW_ITER = CFG.PW_ITER || 150000;
const PW_HASH = CFG.PW_HASH || '';
// Новый пароль: открой makehash.html, введи пароль и вставь полученный хеш в config.js → PW_HASH
// =========================================================

function configReady() { return !!(SUPA_URL && SUPA_KEY && PW_SALT && PW_HASH); }
function configMissing() { return !configReady(); }

// Понятная подсказка вместо «неверный пароль», если config.js не создан
function showConfigError() {
  const box = document.getElementById('pwBox');
  const err = document.getElementById('passwordError');
  const btn = document.getElementById('pwBtn');
  if (btn) btn.disabled = true;
  if (err) {
    err.textContent = 'Нет config.js: скопируй config.example.js → config.js и заполни ключи Supabase и PW_HASH';
    err.classList.add('show');
    err.style.color = '#f97316';
  }
  if (box) box.classList.add('shake');
  setSyncState('error', 'нет config.js');
}

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
  if (configMissing()) { showConfigError(); return; }
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
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function sbFetch(path, opts = {}) {
  const { __noRetry, ...rest } = opts;
  const limit = __noRetry ? 1 : 3;
  let lastErr;

  for (let attempt = 0; attempt < limit; attempt++) {
    try {
      const res = await fetch(`${SUPA_URL}/rest/v1${path}`, {
        ...rest,
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': `Bearer ${SUPA_KEY}`,
          'Content-Type': 'application/json',
          ...(rest.headers || {})
        }
      });
      // 429 и 5xx — временные: повторяем с задержкой, остальные 4xx не повторяем
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`сервер вернул ${res.status}`);
        lastErr.status = res.status;
        if (attempt < limit - 1) { await sleep(600 * Math.pow(2, attempt)); continue; }
        throw lastErr;
      }
      if (!res.ok) {
        const err = await res.text();
        const e = new Error(`${res.status}: ${err}`);
        e.status = res.status;
        throw e;
      }
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (e) {
      // сеть оборвалась (TypeError) или сервер ответил 429/5xx — пробуем ещё раз
      lastErr = e;
      if (e.status && e.status < 500 && e.status !== 429) throw e;
      if (attempt < limit - 1) { await sleep(600 * Math.pow(2, attempt)); continue; }
      throw e;
    }
  }
  throw lastErr || new Error('запрос не удался');
}

// ===== ОФЛАЙН-ОЧЕРЕДЬ ПИСАТЕЛЕЙ =====
// Если сети нет, изменения карточек не теряются: они ждут в localStorage и уходят при «online».
const OUTBOX_KEY = 'wl_outbox';
function outboxRead() { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch (e) { return []; } }
function outboxSave(q) { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(q)); } catch (e) {} }
function outboxAdd(op) {
  const q = outboxRead();
  q.push({ ...op, ts: Date.now(), _q: (op._q || 0) + 1 });
  // один и тот же upsert перезаписывает прежний — незачем копить
  const last = q[q.length - 1];
  if (last.method === 'PATCH' || last.method === 'POST') {
    const i = q.findIndex((x, k) => k < q.length - 1 && x.path === last.path && x.method === last.method);
    if (i >= 0) q.splice(i, 1);
  }
  outboxSave(q);
  setSyncState('error', `нет связи · в очереди ${q.length}`);
}
let outboxBusy = false;
async function outboxFlush() {
  if (outboxBusy) return;
  const q = outboxRead();
  if (!q.length) return;   // очередь пуста: не трогаем индикатор синхронизации
  outboxBusy = true;
  const rest = [];
  for (const op of q) {
    try { await sbFetch(op.path, { method: op.method, headers: op.headers, body: op.body, __noRetry: true }); }
    catch (e) { rest.push(op); }
  }
  outboxSave(rest);
  outboxBusy = false;
  if (!rest.length) { setSyncState('live', 'онлайн'); render(); }
  else setSyncState('error', `в очереди ${rest.length}`);
}
addEventListener('online', outboxFlush);
setTimeout(outboxFlush, 4000);

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
  const d = old ? diffBody(old, body) : body;
  if (old && !Object.keys(d).length) return;
  try {
    if (!old) {
      await sbFetch('/items', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(d)
      });
    } else {
      await sbFetch('/items?id=eq.' + encodeURIComponent(item.id), { method: 'PATCH', body: JSON.stringify(d) });
    }
  } catch (e) {
    outboxAdd(old
      ? { path: '/items?id=eq.' + encodeURIComponent(item.id), method: 'PATCH', body: JSON.stringify(d) }
      : { path: '/items', method: 'POST', headers: { 'Prefer': 'resolution=merge-duplicates' }, body: JSON.stringify(d) });
  }
  SNAP[item.id] = JSON.stringify(body);
}

function diffBody(old, body) {
  const d = {};
  for (const k in body) if (JSON.stringify(body[k]) !== JSON.stringify(old[k])) d[k] = body[k];
  return d;
}

async function deleteItemDb(id) {
  lastLocalWrite = Date.now();
  try {
    await sbFetch(`/items?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (e) {
    outboxAdd({ path: `/items?id=eq.${encodeURIComponent(id)}`, method: 'DELETE' });
  }
  delete SNAP[id];
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
let lastLocalWrite = 0, rtTimer = null, rtRetry = 0;
function applyRemote(type, rec, old) {
  if (type === 'DELETE') { const id = (old && old.id) || (rec && rec.id); if (id) { delete items[id]; delete SNAP[id]; } }
  else if (rec && rec.id) { const p = items[rec.id] || {}; items[rec.id] = extrasOn ? { ...rec, wants: p.wants || {}, reacts: p.reacts || {}, comments: p.comments || [] } : rec; SNAP[rec.id] = JSON.stringify(rec); }
  render();
}
function startRealtime() {
  if (realtimeChannel) return;
  if (!SUPA_URL || !SUPA_KEY) return;
  const ws = new WebSocket(SUPA_URL.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + SUPA_KEY + '&vsn=1.0.0');
  ws.onopen = () => {
    rtRetry = 0;
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
  // Экспоненциальный backoff с потолком 30 с: частые обрывы не должны долбить сервер
  ws.onclose = () => {
    STAT.rt = 'переподключение'; realtimeChannel = null; clearInterval(rtTimer);
    const delay = Math.min(30000, 1000 * Math.pow(2, rtRetry++));
    setTimeout(startRealtime, delay + Math.random() * 400);
  };
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

  // без config.js работать нечем: показываем подсказку и не идём дальше
  if (configMissing()) { lockApp(); showConfigError(); return; }

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
// Рендер, CRUD и форма живут в cards.js: он подключается позже и перекрывает ядро.
// Здесь остаются только функции, которых нет в модулях: esc, rebuildCatSelect, закрытие модалки, категории.
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function rebuildCatSelect(){
  const sel=document.getElementById('inputCat'); if(!sel)return;
  sel.innerHTML=getAllCats().map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  sel.value=currentTab;
}

// ===== MODAL =====
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
