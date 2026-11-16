// ===== SUPABASE CONFIG =====
const SUPA_URL = 'https://dspniootbeoebxefopia.supabase.co';
const SUPA_KEY = 'sb_publishable_XvUI2M2jmfixsE3d_ikJZQ_DXp5WyKY';

let items = {}, currentTab = 'anime', currentFilter = 'all', currentSort = 'date_desc', editingId = null, isSaving = false, searchQuery = '';
let realtimeChannel = null;

// ===== SUPABASE REST HELPERS =====
async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || '',
      ...(opts.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status}: ${err}`);
  }
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
    prefer: 'resolution=merge-duplicates',
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
  // Supabase Realtime via WebSocket
  const wsUrl = SUPA_URL.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + SUPA_KEY + '&vsn=1.0.0';
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ topic: 'realtime:public:items', event: 'phx_join', payload: {}, ref: '1' }));
    setSyncState('live', 'онлайн');
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.event === 'phx_reply' && msg.ref === '1' && msg.payload?.status === 'ok') {
        setSyncState('live', 'онлайн');
      }
      if (['INSERT', 'UPDATE'].includes(msg.payload?.type)) {
        const row = msg.payload.record;
        if (row) { items[row.id] = row; render(); }
      }
      if (msg.payload?.type === 'DELETE') {
        const old = msg.payload.old_record;
        if (old?.id) { delete items[old.id]; render(); }
      }
      // heartbeat
      if (msg.event === 'heartbeat') {
        ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: null }));
      }
    } catch(e) {}
  };

  ws.onerror = () => setSyncState('error', 'ошибка WS');
  ws.onclose = () => {
    setSyncState('error', 'переподключение...');
    realtimeChannel = null;
    setTimeout(startRealtime, 3000);
  };

  realtimeChannel = ws;
  // keepalive ping every 25s
  setInterval(() => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: null }));
    }
  }, 25000);
}

// ===== INIT =====
window.addEventListener('load', () => {
  loadCustom();
  initApp();
  document.getElementById('apiKeyInput')?.addEventListener('input', () => {
    document.getElementById('binFieldWrap').style.display = 'none';
  });
  document.getElementById('inputTitle').addEventListener('keydown', e => { if (e.key === 'Enter') saveItem(); });
  document.getElementById('searchInput').addEventListener('input', e => { searchQuery = e.target.value.toLowerCase(); render(); });
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
    setSyncState('error', 'ошибка подключения');
    console.error(e);
    // show setup with error hint
    document.getElementById('setupScreen').classList.add('visible');
    document.getElementById('mainApp').style.display = 'none';
    showSetupError('Не удалось подключиться к Supabase: ' + e.message);
  }
}

// ===== SETUP (упрощённый — только для ошибок) =====
function showSetup() {
  document.getElementById('setupScreen').classList.add('visible');
  document.getElementById('mainApp').style.display = 'none';
  setSyncState('error', 'нет подключения');
}
function showMain() {
  document.getElementById('setupScreen').classList.remove('visible');
  document.getElementById('mainApp').style.display = 'flex';
}
function resetSettings() {
  if (!confirm('Перезагрузить приложение?')) return;
  location.reload();
}
async function connectBin() { location.reload(); }
function showSetupError(m) { const e = document.getElementById('setupError'); if(e){e.textContent = '⚠️ ' + m; e.style.display = 'block';} }
function hideSetupError() { const e = document.getElementById('setupError'); if(e) e.style.display = 'none'; }

// ===== SYNC STATE =====
function setSyncState(s, l) {
  const dot = document.getElementById('syncDot');
  const lbl = document.getElementById('syncLabel');
  if(dot) dot.className = 'sync-dot ' + s;
  if(lbl) lbl.textContent = l;
}

// ===== TABS =====
function getAllCats() {
  const base = [
    {id:'anime', name:'Аниме', icon:'🎌'},
    {id:'games', name:'Игры', icon:'🎮'},
    {id:'series', name:'Сериалы', icon:'📺'},
    {id:'films', name:'Фильмы', icon:'🎬'}
  ];
  return [...base, ...(C.customCats || [])];
}

function renderTabs() {
  const nav = document.getElementById('tabsNav'); if (!nav) return;
  const cats = getAllCats();
  document.documentElement.style.setProperty('--tab-count', cats.length);
  nav.innerHTML = cats.map(cat => `
    <div class="tab${currentTab === cat.id ? ' active' : ''}" data-cat="${cat.id}" onclick="setTab('${cat.id}')">
      <span class="t-icon" id="icon-${cat.id}">${C.icons && C.icons[cat.id] ? `<img src="${C.icons[cat.id]}" style="width:22px;height:22px;object-fit:cover;border-radius:4px;">` : (cat.icon || '📂')}</span>
      <span>${cat.name}</span>
      <span class="badge" id="badge-${cat.id}"></span>
      ${cat.id.startsWith('cat_') ? `<span class="tab-close" onclick="event.stopPropagation();removeCustomCat('${cat.id}')">✕</span>` : ''}
    </div>
  `).join('');
}

function setTab(cat) { currentTab = cat; renderTabs(); document.getElementById('fab').dataset.cat = cat; render(); }
function setFilter(f, btn) { currentFilter = f; document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); render(); }
function setSort(v) { currentSort = v; render(); }

// ===== SORT =====
function sortItems(arr) {
  const cp = [...arr];
  switch(currentSort) {
    case 'date_asc':   return cp.sort((a,b) => a.ts - b.ts);
    case 'alpha_asc':  return cp.sort((a,b) => a.title.localeCompare(b.title, 'ru'));
    case 'alpha_desc': return cp.sort((a,b) => b.title.localeCompare(a.title, 'ru'));
    case 'status':     return cp.sort((a,b) => a.done - b.done);
    default:           return cp.sort((a,b) => b.ts - a.ts);
  }
}

// ===== RENDER =====
function render() {
  renderTabs();
  const list = document.getElementById('list');
  let arr = Object.values(items).filter(i => i.cat === currentTab);
  if (currentFilter === 'done') arr = arr.filter(i => i.done);
  else if (currentFilter === 'todo') arr = arr.filter(i => !i.done);
  if (searchQuery) arr = arr.filter(i => i.title.toLowerCase().includes(searchQuery) || (i.note || '').toLowerCase().includes(searchQuery));
  arr = sortItems(arr);

  // badges
  getAllCats().forEach(cat => {
    const cnt = Object.values(items).filter(i => i.cat === cat.id && !i.done).length;
    const el = document.getElementById('badge-' + cat.id);
    if (el) { el.textContent = cnt; el.classList.toggle('show', cnt > 0); }
  });

  // stats
  const allCat = Object.values(items).filter(i => i.cat === currentTab);
  const doneCount = allCat.filter(i => i.done).length;
  const el_total = document.getElementById('stat-total'), el_done = document.getElementById('stat-done'), el_left = document.getElementById('stat-left');
  if (el_total) el_total.textContent = allCat.length;
  if (el_done) el_done.textContent = doneCount;
  if (el_left) el_left.textContent = allCat.length - doneCount;

  if (!arr.length) {
    const cats = getAllCats(); const cat = cats.find(c => c.id === currentTab) || {};
    const ico = C.icons && C.icons[currentTab] ? `<img src="${C.icons[currentTab]}" style="width:52px;height:52px;object-fit:cover;border-radius:12px;">` : (cat.icon || '📂');
    list.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">${ico}</div><p>Список пуст.<br>Нажми <strong>+</strong> чтобы добавить!</p></div>`;
    return;
  }

  const checkIc = C.icons && C.icons.check;
  const editIc  = C.icons && C.icons.edit;
  const delIc   = C.icons && C.icons.del;

  list.innerHTML = arr.map(item => {
    const checkContent = item.done ? (checkIc ? `<img src="${checkIc}">` : '✓') : '';
    const editBtn = editIc ? `<img src="${editIc}">` : '✏️';
    const delBtn  = delIc  ? `<img src="${delIc}">` : '🗑️';
    return `<div class="item${item.done ? ' done' : ''}">
      <div class="check" onclick="toggleDone('${item.id}')">${checkContent}</div>
      <div class="item-body">
        <div class="item-title">${esc(item.title)}</div>
        ${item.note ? `<div class="item-meta">${esc(item.note)}</div>` : ''}
        ${item.link ? `<a href="${esc(item.link)}" target="_blank" style="font-size:11px;color:var(--accent2);text-decoration:none;margin-top:3px;display:inline-block;">🔗 Открыть</a>` : ''}
      </div>
      <div class="item-actions">
        <button class="btn-icon" onclick="editItem('${item.id}')" title="Редактировать">${editBtn}</button>
        <button class="btn-icon del" onclick="deleteItem('${item.id}')" title="Удалить">${delBtn}</button>
      </div>
    </div>`;
  }).join('');

  if (C.rgb.text && rgbRaf)     document.querySelectorAll('.item-title').forEach(el => el.style.color = `hsl(${rgbHue},${C.rgb.sat}%,${C.rgb.light}%)`);
  if (C.rgb.metaText && rgbRaf) document.querySelectorAll('.item-meta').forEach(el => el.style.color = `hsl(${(rgbHue+40)%360},${C.rgb.sat}%,${C.rgb.light}%)`);
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ===== CRUD =====
async function toggleDone(id) {
  if (!items[id]) return;
  items[id] = { ...items[id], done: !items[id].done };
  render();
  try { await upsertItem(items[id]); } catch(e) { setSyncState('error', 'ошибка сохранения'); }
}

async function deleteItem(id) {
  if (!items[id]) return;
  delete items[id];
  render();
  try { await deleteItemDb(id); } catch(e) { setSyncState('error', 'ошибка удаления'); }
}

function editItem(id) {
  const item = items[id]; if (!item) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = 'Редактировать';
  document.getElementById('inputTitle').value = item.title;
  document.getElementById('inputNote').value = item.note || '';
  document.getElementById('inputLink').value = item.link || '';
  rebuildCatSelect(); document.getElementById('inputCat').value = item.cat;
  document.getElementById('overlay').classList.add('open');
  setTimeout(() => document.getElementById('inputTitle').select(), 50);
}

async function saveItem() {
  const title = document.getElementById('inputTitle').value.trim();
  if (!title) { document.getElementById('inputTitle').focus(); return; }
  const note = document.getElementById('inputNote').value.trim();
  const link = document.getElementById('inputLink').value.trim();
  const cat  = document.getElementById('inputCat')?.value || currentTab;
  const btn  = document.getElementById('saveBtn');
  btn.disabled = true; btn.textContent = 'Сохраняем...';

  let item;
  if (editingId) {
    item = { ...items[editingId], title, note, link, cat };
  } else {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    item = { id, cat, title, note, link, done: false, ts: Date.now() };
  }

  items[item.id] = item;
  render(); closeModal();
  try { await upsertItem(item); setSyncState('live', 'сохранено'); }
  catch(e) { setSyncState('error', 'ошибка сохранения'); }
  btn.disabled = false; btn.textContent = 'Сохранить';
}

function rebuildCatSelect() {
  const sel = document.getElementById('inputCat'); if (!sel) return;
  sel.innerHTML = getAllCats().map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  sel.value = currentTab;
}

// ===== MODAL =====
function openModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Добавить';
  document.getElementById('inputTitle').value = '';
  document.getElementById('inputNote').value = '';
  document.getElementById('inputLink').value = '';
  rebuildCatSelect();
  document.getElementById('overlay').classList.add('open');
  setTimeout(() => document.getElementById('inputTitle').focus(), 100);
}
function closeModal() { document.getElementById('overlay').classList.remove('open'); editingId = null; }
function maybeClose(e) { if (e.target === document.getElementById('overlay')) closeModal(); }

// ===== CUSTOM CATS =====
function addCustomCat() {
  const inp = document.getElementById('newCatName'), ico = document.getElementById('newCatIcon');
  const name = (inp.value || '').trim(); if (!name) return;
  const id = 'cat_' + Date.now();
  C.customCats.push({ id, name, icon: ico.value || '📂' });
  inp.value = ''; ico.value = '📂';
  saveCustom(); renderTabs(); renderIconPreviews();
}
function removeCustomCat(id) {
  C.customCats = C.customCats.filter(c => c.id !== id);
  if (currentTab === id) currentTab = 'anime';
  saveCustom(); renderTabs(); render();
}
function renderCustomCatList() {
  const container = document.getElementById('customCatList'); if (!container) return;
  if (!C.customCats || !C.customCats.length) { container.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px">Нет пользовательских категорий</div>'; return; }
  container.innerHTML = C.customCats.map(cat => `
    <div class="cr">
      <span style="font-size:18px">${cat.icon || '📂'}</span>
      <span class="cl">${cat.name}</span>
      <button class="reset-sm" onclick="removeCustomCat('${cat.id}');renderCustomCatList()">Удалить</button>
    </div>`).join('');
}
