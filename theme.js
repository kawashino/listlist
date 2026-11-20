/* theme.js: Оформление и облако: темы, фон (картинка, видео, обои из сети), синхронизация оформления. */

const THEMES={
 'Базовая':{accent:CD.accent,pageBgColor:CD.pageBgColor,cardBgColor:CD.cardBgColor,cardTextColor:CD.cardTextColor,cardMetaColor:CD.cardMetaColor,borderColorRaw:CD.borderColorRaw,borderWidth:1,borderOpacity:100,borderRadius:12,headerColor:CD.headerColor,font:'Inter',fx:{type:'none'}},
 'Неон':{accent:'#00f0ff',pageBgColor:'#05000f',cardBgColor:'#12002b',cardTextColor:'#e0faff',borderColorRaw:'#ff00e6',borderWidth:2,borderOpacity:90,headerColor:'#0a0020',font:'Russo One',fx:{type:'stars'}},
 'Сакура':{accent:'#ff7eb6',pageBgColor:'#1a0f14',cardBgColor:'#2a1520',cardTextColor:'#ffe6ef',cardMetaColor:'#d9a3b8',borderColorRaw:'#ff9ec7',borderWidth:1,headerColor:'#2a1520',font:'Comfortaa',fx:{type:'sakura'}},
 'Терминал':{accent:'#22ff66',pageBgColor:'#000000',cardBgColor:'#001a08',cardTextColor:'#22ff66',cardMetaColor:'#14a040',borderColorRaw:'#22ff66',borderRadius:2,headerColor:'#001206',font:'Fira Code',fx:{type:'none'}},
 'Пиксель':{accent:'#f59e0b',pageBgColor:'#1b1033',cardBgColor:'#2b1b52',cardTextColor:'#fff3c4',borderColorRaw:'#f59e0b',borderWidth:3,borderRadius:0,headerColor:'#241446',font:'Press Start 2P',fx:{type:'snow'}}
};

const userThemes=()=>JSON.parse(localStorage.getItem('wl_themes')||'{}');

function applyTheme(n){
  const p=THEMES[n]||userThemes()[n];if(!p)return;
  const {fx,...rest}=p;Object.assign(C,rest);if(fx)Object.assign(FX(),fx);
  saveCustom();applyCustom();syncControls();fxSync();fxStart();
}

function saveTheme(){
  const n=(prompt('Название темы?')||'').trim();if(!n)return;
  const {bg,icons,customCats,rgb,...p}=C;p.fx={...FX()};
  const u=userThemes();u[n]=p;localStorage.setItem('wl_themes',JSON.stringify(u));renderThemes();toast('Тема «'+n+'» сохранена');
}

function renderThemes(){
  $('themeList').innerHTML=[...Object.keys(THEMES),...Object.keys(userThemes())].map(n=>`<button class="upload-btn" onclick='applyTheme(${JSON.stringify(n)})'>${esc(n)}</button>`).join('');
}

async function loadBg(inp){
  const f=inp.files[0];if(!f)return;toast('Загружаю фон…');
  try{C.bg=await upload(f,'bg');C.bgGrad=false;$('bgGradToggle').checked=false;saveCustom();applyBg();toast('Фон загружен без потери качества');}
  catch(e){toast('Не вышло загрузить: выполни SQL для хранилища');}
}

async function loadIcon(inp,key){const f=inp.files[0];if(!f)return;C.icons[key]=await shrink(f,96);saveCustom();applyAllIcons();}

async function pushTheme(){
  try{const d={...C};if(d.bg&&d.bg.startsWith('data:'))d.bg=null;const ts=Date.now();
    await sbFetch('/settings',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({id:'theme_'+ME,data:d,updated_at:ts})});
    localStorage.setItem('wl_theme_ts',ts);}catch(e){}
}

async function pullTheme(){
  try{const r=await sbFetch('/settings?id=eq.'+encodeURIComponent('theme_'+ME)),row=r&&r[0];
    if(!row)return pushTheme();
    if(row.updated_at>(+localStorage.getItem('wl_theme_ts')||0)){
      C={...JSON.parse(JSON.stringify(CD)),...row.data};C.icons={...CD.icons,...C.icons};
      localStorage.setItem('wl_custom',JSON.stringify(C));localStorage.setItem('wl_theme_ts',row.updated_at);
      applyCustom();syncControls();fxSync();fxStart();renderIconPreviews();render();}
  }catch(e){}
}

function setBgUrl(u){u=(u||$('urlBg').value).trim();if(!u)return;C.bg=u;C.bgGrad=false;$('bgGradToggle').checked=false;saveCustom();applyBg();toast('Обои установлены');}

async function whSearch(){
  const q=encodeURIComponent($('whQ').value.trim()),r=$('whRes');r.textContent='Ищу…';
  try{const d=await(await fetch(`https://wallhaven.cc/api/v1/search?q=${q}&sorting=${$('whS').value}&categories=111&purity=100&atleast=1280x720`)).json();
    r.innerHTML=(d.data||[]).slice(0,24).map(x=>`<img loading="lazy" src="${x.thumbs.small}" onclick="setBgUrl('${x.path}')">`).join('')||'Ничего не найдено';}
  catch(e){r.textContent='Wallhaven недоступен. Вставь прямую ссылку на картинку ниже.';}
}

function applyVideo(){
  const u=U(),bg=$('bgLayer');let v=$('bgVid');
  if(!u.video){if(v)v.remove();return;}
  if(!v){v=document.createElement('video');v.id='bgVid';v.muted=v.loop=v.playsInline=true;v.autoplay=true;bg.prepend(v);}
  if(v.getAttribute('src')!==u.video)v.src=u.video;v.style.opacity=(C.bgOpacity||100)/100;
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)v.pause();
}

document.addEventListener('visibilitychange',()=>{const v=$('bgVid');if(v)document.hidden?v.pause():v.play().catch(()=>{});});

async function loadVid(inp){const f=inp.files[0];if(!f)return;if(f.size>48e6){toast('Видео больше 48 МБ, лимит хранилища на файл 50 МБ');return;}toast('Загружаю видео…');try{setU('video',await upload(f,'video'));toast('Видео-фон установлен');}catch(e){toast('Не вышло загрузить видео');}}

ICON_LABELS.empty='Картинка пустого списка';ICON_LABELS.manga='Вкладка Манга';ICON_DEFS.manga='📖';

/* ===== Сборка интерфейса этого модуля: шаги выполняются в порядке номеров (uiStep, см. util.js), номера хранят исходный порядок вставки элементов ===== */
uiStep(140, () => {
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
});
uiStep(150, () => {
renderThemes();
});
uiStep(200, () => {
document.querySelector('[data-page="fx"]').insertAdjacentHTML('beforeend',`<div class="sep"></div><div class="cs"><div class="cs-title">Постеры</div>
   <button class="upload-btn" onclick="fillPosters()">🖼 Найти постеры для всех без обложки</button>
   <div style="font-size:11px;color:var(--text3)">Источники: Shikimori, iTunes, Википедия. Ключи не нужны.</div></div>`);
});
uiStep(250, () => {
document.querySelector('[data-page="bg"]').insertAdjacentHTML('beforeend',`<div class="sep"></div><div class="cs"><div class="cs-title">Обои из интернета</div>
   <div class="cr"><input id="whQ" class="cp-select" placeholder="Wallhaven: anime, sakura, forest…" onkeydown="if(event.key==='Enter')whSearch()"><button class="upload-btn" onclick="whSearch()">Найти</button></div>
   <select id="whS" class="cp-select"><option value="relevance">Релевантные</option><option value="toplist">Топ</option><option value="random">Случайные</option><option value="views">По просмотрам</option></select>
   <div id="whRes" class="whgrid"></div>
   <div class="cs-title">Своя ссылка на картинку</div>
   <div class="cr"><input id="urlBg" class="cp-select" placeholder="Pinterest (i.pinimg.com), Imgur и др."><button class="upload-btn" onclick="setBgUrl()">Поставить</button></div>
   <div style="font-size:11px;color:var(--text3)">Pinterest: открой пин, ПКМ по картинке, «Копировать адрес изображения» (i.pinimg.com…). Ссылка на страницу пина не подойдёт.</div></div>`);
});
uiStep(370, () => {
renderIconPreviews();
});
