// ===== ЗАЩИТА ВХОДОМ (ключи из config.js, он в .gitignore) =====
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

// ===== ОФЛАЙН-ОЧЕРЕДЬ ПИСАТЕЛЕЙ (в api.js) =====

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
function closeModal(){const ov=document.getElementById('overlay');ov.classList.remove('open');ov.classList.remove('modal-2col');editingId=null;if(!document.body.classList.contains('split')){document.body.classList.remove('info-open');document.getElementById('info')?.classList.remove('open');}}
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
