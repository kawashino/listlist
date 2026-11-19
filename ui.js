/* ui.js: сборка интерфейса. Вставляет в страницу поля, кнопки и панели, которых нет в index.html. Вызывается из main.js по порядку. */

function buildInterface(){

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
}

function buildMediaUi(){

  $('fPoster').insertAdjacentHTML('afterend','<button type="button" class="upload-btn" style="margin-top:6px" onclick="$(\'fPosterFile\').click()">📁 Загрузить с устройства</button><input type="file" id="fPosterFile" accept="image/*" onchange="upPoster(this)">');
  document.querySelector('[data-page="fx"]').insertAdjacentHTML('beforeend',`<div class="sep"></div><div class="cs"><div class="cs-title">Постеры</div>
   <button class="upload-btn" onclick="fillPosters()">🖼 Найти постеры для всех без обложки</button>
   <div style="font-size:11px;color:var(--text3)">Источники: Shikimori, iTunes, Википедия. Ключи не нужны.</div></div>`);
}

function buildInfoToolsUi(){

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
}

function buildSmartUi(){

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
}

function buildSettingsUi(){

  $('cats0')||document.querySelector('.cp-tabs').insertAdjacentHTML('beforeend','<div class="cp-tab" data-tab="more" onclick="switchCpTab(\'more\')">🛠 Ещё</div>');
  document.querySelector('.cp-body').insertAdjacentHTML('beforeend','<div class="cp-page" data-page="more" id="moreBody"></div>');
  document.querySelector('.toolbar').insertAdjacentHTML('beforeend','<button class="filter-btn" onclick="showArch=!showArch;this.style.outline=showArch?\'2px solid var(--accent)\':\'\';render()">📦</button>');
  renderIconPreviews();
  const c=localStorage.getItem('wl_cache');
  if(c&&isAuthed()){try{items=JSON.parse(c);render();}catch(e){}}else $('list').innerHTML=Array(6).fill('<div class="sk"></div>').join('');
  applyUI();
}

function buildLayoutUi(){

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
}
