// ===== DEFAULTS =====
const CD = {
  bg:null, bgOpacity:100, bgSize:'cover', bgPosX:50, bgPosY:50, bgZoom:100,
  bgOverlay:0, bgGrad:false, bgGradA:'#1a0533', bgGradB:'#001a33', bgGradAngle:135,
  blurAmt:12,
  accent:'#7c5cfc',
  cardBgColor:'#1e2340', cardBgOpacity:80, cardTextColor:'#e8eaf6', cardMetaColor:'#9095b5',
  cardShadow:true, cardShadowColor:'#000000', cardShadowOpacity:30,
  borderColorRaw:'#2d3358', borderWidth:1, borderOpacity:100, borderRadius:12,
  headerColor:'#131629', headerOpacity:85, pageBgColor:'#0d0f1a',
  font:'Inter', fontSize:15,
  tabAnime:'#f97316', tabGames:'#06b6d4', tabSeries:'#a855f7', tabFilms:'#ec4899',
  showStats:true, showSearch:true,
  icons:{
    anime:null, games:null, series:null, films:null,
    fab:null, check:null, edit:null, del:null, logo:null,
    search:null
  },
  customCats:[],
  rgb:{ border:false, text:false, accent:false, header:false, card:false, metaText:false, speed:3, sat:80, light:55 }
};
let C = JSON.parse(JSON.stringify(CD));

// ===== RGB ENGINE =====
let rgbHue = 0, rgbRaf = null;
function anyRgbOn(){ return ['border','text','accent','header','card','metaText'].some(k=>C.rgb[k]); }
function hsl(h,s,l){ return `hsl(${h},${s}%,${l}%)`; }
function hsla(h,s,l,a){ return `hsla(${h},${s}%,${l}%,${a})`; }

function startRgb(){ if(rgbRaf)return; (function tick(){ applyRgbFrame(); rgbHue=(rgbHue+360/(60*C.rgb.speed))%360; rgbRaf=requestAnimationFrame(tick); })(); }
function stopRgb(){ if(rgbRaf){cancelAnimationFrame(rgbRaf);rgbRaf=null;} }

function applyRgbFrame(){
  const h=rgbHue, s=C.rgb.sat, l=C.rgb.light, r=document.documentElement;
  if(C.rgb.border) r.style.setProperty('--border-color', hsla(h,s,l,C.borderOpacity/100));
  if(C.rgb.text)   document.querySelectorAll('.item-title').forEach(el=>el.style.color=hsl(h,s,l));
  if(C.rgb.metaText) document.querySelectorAll('.item-meta').forEach(el=>el.style.color=hsl((h+40)%360,s,l));
  if(C.rgb.accent){ r.style.setProperty('--accent',hsl(h,s,l)); r.style.setProperty('--accent2',hsl((h+30)%360,s,Math.min(l+15,90))); r.style.setProperty('--accent-glow',hsla(h,s,l,0.3)); }
  if(C.rgb.header) r.style.setProperty('--header-bg', hsla(h,s,Math.max(l-30,10),C.headerOpacity/100));
  if(C.rgb.card)   r.style.setProperty('--card-bg',   hsla(h,s,Math.max(l-30,10),C.cardBgOpacity/100));
}

function toggleRgb(key,val){ C.rgb[key]=val; saveCustom(); if(anyRgbOn())startRgb(); else{stopRgb();applyCustom();} }
function setRgbSpeed(v){ C.rgb.speed=+v; document.getElementById('rgbSpeedVal').textContent=v+'с'; saveCustom(); }
function setRgbSat(v)  { C.rgb.sat=+v;   document.getElementById('rgbSatVal').textContent=v+'%';   saveCustom(); }
function setRgbLight(v){ C.rgb.light=+v;  document.getElementById('rgbLightVal').textContent=v+'%'; saveCustom(); }

// ===== SAVE / LOAD =====
function saveCustom(){ localStorage.setItem('wl_custom', JSON.stringify(C)); }
function loadCustom(){
  try{
    const s=localStorage.getItem('wl_custom');
    if(s){ const p=JSON.parse(s); C={...JSON.parse(JSON.stringify(CD)),...p}; if(!C.icons)C.icons={...CD.icons}; else C.icons={...CD.icons,...p.icons}; if(!C.rgb)C.rgb={...CD.rgb}; if(!C.customCats)C.customCats=[]; }
  }catch(e){}
  applyCustom(); syncControls();
  if(anyRgbOn()) startRgb();
}
function resetAllCustom(){ if(!confirm('Сбросить всё оформление?'))return; stopRgb(); C=JSON.parse(JSON.stringify(CD)); saveCustom(); applyCustom(); syncControls(); renderTabs(); }

// ===== HELPERS =====
function hexToRgb(hex){ const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return`${r},${g},${b}`; }
function lighten(hex,a){ const n=parseInt(hex.replace('#',''),16); const r=Math.min(255,(n>>16)+a),g=Math.min(255,((n>>8)&0xff)+a),b=Math.min(255,(n&0xff)+a); return'#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1); }

// ===== APPLY ALL =====
function applyCustom(){
  const r=document.documentElement;
  if(!C.rgb.accent){ r.style.setProperty('--accent',C.accent); r.style.setProperty('--accent2',lighten(C.accent,30)); r.style.setProperty('--accent-glow',C.accent+'40'); }
  if(!C.rgb.card)   r.style.setProperty('--card-bg',`rgba(${hexToRgb(C.cardBgColor)},${C.cardBgOpacity/100})`);
  r.style.setProperty('--card-text', C.cardTextColor);
  r.style.setProperty('--card-meta-text', C.cardMetaColor||'#9095b5');
  if(!C.rgb.border) r.style.setProperty('--border-color',`rgba(${hexToRgb(C.borderColorRaw)},${C.borderOpacity/100})`);
  r.style.setProperty('--border-width', C.borderWidth+'px');
  r.style.setProperty('--border-radius', C.borderRadius+'px');
  if(!C.rgb.header) r.style.setProperty('--header-bg',`rgba(${hexToRgb(C.headerColor)},${C.headerOpacity/100})`);
  r.style.setProperty('--bg2',`rgba(${hexToRgb(C.headerColor)},${Math.max(0.3,C.headerOpacity/100-0.1)})`);
  r.style.setProperty('--bg3',`rgba(${hexToRgb(C.headerColor)},${Math.max(0.4,C.headerOpacity/100)})`);
  r.style.setProperty('--bg', C.pageBgColor);
  document.body.style.background = C.pageBgColor;
  // shadow
  if(C.cardShadow){ r.style.setProperty('--card-shadow',`0 2px 12px rgba(${hexToRgb(C.cardShadowColor||'#000000')},${(C.cardShadowOpacity||30)/100})`); }
  else r.style.setProperty('--card-shadow','none');
  // font
  const fontMap={'Press Start 2P':"'Press Start 2P',monospace",'Fira Code':"'Fira Code',monospace",'Russo One':"'Russo One',sans-serif",'Unbounded':"'Unbounded',sans-serif",'Comfortaa':"'Comfortaa',cursive",'Raleway':"'Raleway',sans-serif",'Nunito':"'Nunito',sans-serif",'Inter':"'Inter',sans-serif"};
  r.style.setProperty('--font', fontMap[C.font]||"'Inter',sans-serif");
  document.body.style.fontSize = C.fontSize+'px';
  document.body.className = C.font==='Press Start 2P'?'font-ps2':C.font==='Fira Code'?'font-fira':'';
  // tabs
  r.style.setProperty('--tab-anime',C.tabAnime); r.style.setProperty('--tab-games',C.tabGames);
  r.style.setProperty('--tab-series',C.tabSeries); r.style.setProperty('--tab-films',C.tabFilms);
  // bg
  applyBg();
  // blur
  document.querySelectorAll('header,.body-wrap,.setup-wrap').forEach(el=>{ el.style.backdropFilter=`blur(${C.blurAmt}px)`; el.style.webkitBackdropFilter=`blur(${C.blurAmt}px)`; });
  // stats/search visibility
  const statsBar=document.getElementById('statsBar'); if(statsBar) statsBar.style.display=C.showStats?'flex':'none';
  const sw=document.getElementById('searchWrap'); if(sw) sw.style.display=C.showSearch?'block':'none';
  // icons
  applyAllIcons();
  // rgb reset if off
  if(!C.rgb.text)     document.querySelectorAll('.item-title').forEach(el=>el.style.color='');
  if(!C.rgb.metaText) document.querySelectorAll('.item-meta').forEach(el=>el.style.color='');
}

function applyBg(){
  const bgImg=document.getElementById('bgImg');
  const bgGrad=document.getElementById('bgGrad');
  const bgOverlay=document.getElementById('bgOverlay');
  if(C.bgGrad){
    bgGrad.style.background=`linear-gradient(${C.bgGradAngle}deg,${C.bgGradA},${C.bgGradB})`;
    bgGrad.classList.add('show');
    if(bgImg) bgImg.style.backgroundImage='';
  } else {
    bgGrad.classList.remove('show');
    if(C.bg && bgImg){
      const zoom = C.bgZoom/100;
      let size;
      if(C.bgSize==='contain') size=`contain`;
      else if(C.bgSize==='fill') size=`100% 100%`;
      else size=`${zoom*100}%`; // cover mode with zoom
      bgImg.style.backgroundImage=`url(${C.bg})`;
      bgImg.style.backgroundSize=size;
      bgImg.style.backgroundPosition=`${C.bgPosX}% ${C.bgPosY}%`;
      bgImg.style.opacity=C.bgOpacity/100;
      const prev=document.getElementById('bgPreview');
      if(prev){ prev.src=C.bg; prev.classList.add('show'); }
    } else {
      if(bgImg){ bgImg.style.backgroundImage=''; bgImg.style.opacity=1; }
      const prev=document.getElementById('bgPreview'); if(prev) prev.classList.remove('show');
    }
  }
  if(bgOverlay) bgOverlay.style.background=`rgba(0,0,0,${C.bgOverlay/100})`;
}

// ===== ICONS =====
const ICON_DEFS = {
  anime:'🎌', games:'🎮', series:'📺', films:'🎬',
  fab:'＋', check:'✓', edit:'✏️', del:'🗑️', logo:'', search:'🔍'
};
const ICON_LABELS = {
  anime:'Вкладка Аниме', games:'Вкладка Игры', series:'Вкладка Сериалы', films:'Вкладка Фильмы',
  fab:'Кнопка добавить (+)', check:'Галочка выполнено', edit:'Кнопка редактировать', del:'Кнопка удалить', logo:'Иконка логотипа', search:'Иконка поиска'
};

function applyAllIcons(){
  // tab icons
  ['anime','games','series','films'].forEach(cat=>{
    const ic=C.icons[cat];
    ['icon-','pi-'].forEach(pfx=>{
      const el=document.getElementById(pfx+cat);
      if(!el)return;
      if(ic) el.innerHTML=`<img src="${ic}" style="width:22px;height:22px;object-fit:cover;border-radius:4px;">`;
      else el.innerHTML=ICON_DEFS[cat]||'';
    });
    const pimg=document.getElementById('pimg-'+cat); if(pimg){if(ic){pimg.src=ic;pimg.classList.add('show');}else pimg.classList.remove('show');}
  });
  // custom cats
  if(C.customCats) C.customCats.forEach(cat=>{
    const ic=C.icons[cat.id]; const el=document.getElementById('icon-'+cat.id);
    if(el){ if(ic) el.innerHTML=`<img src="${ic}" style="width:22px;height:22px;object-fit:cover;border-radius:4px;">`; else el.innerHTML=cat.icon||'📂'; }
  });
  // fab
  const fab=document.getElementById('fab');
  if(fab){ if(C.icons.fab) fab.innerHTML=`<img src="${C.icons.fab}">`; else fab.textContent='+'; }
  // logo icon
  const logoIcon=document.getElementById('logoIcon');
  if(logoIcon){ if(C.icons.logo) logoIcon.innerHTML=`<img src="${C.icons.logo}">`; else logoIcon.innerHTML=''; logoIcon.style.display=C.icons.logo?'flex':'none'; }
  // check icons in list (re-render handled by render())
  // search icon
  const si=document.getElementById('searchIconEl');
  if(si){ if(C.icons.search) si.innerHTML=`<img src="${C.icons.search}" style="width:14px;height:14px;object-fit:cover;border-radius:2px;">`; else si.textContent='🔍'; }
  // update icon panel previews
  renderIconPreviews();
}

function renderIconPreviews(){
  const container=document.getElementById('iconRowsContainer'); if(!container)return;
  const allKeys = Object.keys(ICON_LABELS);
  if(C.customCats) C.customCats.forEach(cat=>{ if(!ICON_LABELS[cat.id]) ICON_LABELS[cat.id]='Вкладка '+cat.name; allKeys.push(cat.id); });
  container.innerHTML = allKeys.map(key=>{
    const ic=C.icons[key];
    return `<div class="icon-row">
      <div class="icon-preview-box" id="iconbox-${key}">${ic?`<img src="${ic}">`:(ICON_DEFS[key]||'📂')}</div>
      <span class="cl">${ICON_LABELS[key]||key}</span>
      <button class="upload-btn" onclick="document.getElementById('iconfile-${key}').click()">Изменить</button>
      <button class="reset-sm" onclick="resetIcon('${key}')">✕</button>
      <input type="file" id="iconfile-${key}" accept="image/*" onchange="loadIcon(this,'${key}')">
    </div>`;
  }).join('');
}

function loadIcon(inp,key){
  const f=inp.files[0]; if(!f)return;
  const reader=new FileReader();
  reader.onload=e=>{ C.icons[key]=e.target.result; saveCustom(); applyAllIcons(); };
  reader.readAsDataURL(f);
}
function resetIcon(key){ C.icons[key]=null; saveCustom(); applyAllIcons(); }

// ===== CUSTOM CATS =====
function addCustomCat(){
  const inp=document.getElementById('newCatName'), ico=document.getElementById('newCatIcon');
  const name=(inp.value||'').trim(); if(!name)return;
  const id='cat_'+Date.now();
  C.customCats.push({id,name,icon:ico.value||'📂'});
  inp.value=''; ico.value='📂';
  saveCustom(); renderTabs(); renderIconPreviews();
}
function removeCustomCat(id){
  C.customCats=C.customCats.filter(c=>c.id!==id);
  if(window.currentTab===id) window.currentTab='anime';
  saveCustom(); renderTabs(); render();
}

// ===== BG POSITION PAD =====
function initBgPosPad(){
  const pad=document.getElementById('bgPosPad'); if(!pad)return;
  const dot=document.getElementById('bgPosDot');
  function move(e){
    const rect=pad.getBoundingClientRect();
    const x=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
    const y=Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height));
    C.bgPosX=Math.round(x*100); C.bgPosY=Math.round(y*100);
    dot.style.left=(x*100)+'%'; dot.style.top=(y*100)+'%';
    applyBg(); saveCustom();
  }
  let dragging=false;
  pad.addEventListener('mousedown',e=>{dragging=true;move(e);});
  document.addEventListener('mousemove',e=>{if(dragging)move(e);});
  document.addEventListener('mouseup',()=>dragging=false);
  pad.addEventListener('touchstart',e=>{const t=e.touches[0];move(t);},{passive:true});
  pad.addEventListener('touchmove',e=>{move(e.touches[0]);},{passive:true});
  // set initial dot position
  if(dot){ dot.style.left=C.bgPosX+'%'; dot.style.top=C.bgPosY+'%'; }
}

// ===== SYNC CONTROLS =====
function syncControls(){
  const sv=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
  const st=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  const sc=(id,v)=>{const el=document.getElementById(id);if(el)el.checked=v;};
  sv('bgOpacity',C.bgOpacity);    st('bgOpacityVal',C.bgOpacity+'%');
  sv('bgZoom',C.bgZoom);          st('bgZoomVal',C.bgZoom+'%');
  sv('bgSizeSelect',C.bgSize);
  sv('bgOverlayRange',C.bgOverlay); st('bgOverlayVal',C.bgOverlay+'%');
  sc('bgGradToggle',C.bgGrad);
  sv('bgGradA',C.bgGradA); sv('bgGradB',C.bgGradB); sv('bgGradAngle',C.bgGradAngle); st('bgGradAngleVal',C.bgGradAngle+'°');
  sv('blurAmt',C.blurAmt);        st('blurVal',C.blurAmt+'px');
  sv('cardBgColor',C.cardBgColor); sv('cardBgOpacity',C.cardBgOpacity); st('cardBgOpacityVal',C.cardBgOpacity+'%');
  sv('cardTextColor',C.cardTextColor); sv('cardMetaColor',C.cardMetaColor||'#9095b5');
  sc('cardShadowToggle',C.cardShadow);
  sv('borderColorPick',C.borderColorRaw); sv('borderWidth',C.borderWidth); st('borderWidthVal',C.borderWidth+'px');
  sv('borderOpacity',C.borderOpacity); st('borderOpacityVal',C.borderOpacity+'%');
  sv('borderRadius',C.borderRadius); st('borderRadiusVal',C.borderRadius+'px');
  sv('headerColor',C.headerColor); sv('headerOpacity',C.headerOpacity); st('headerOpacityVal',C.headerOpacity+'%');
  sv('pageBgColor',C.pageBgColor); sv('accentPicker',C.accent);
  sv('fontSelect',C.font); sv('fontSize',C.fontSize); st('fontSizeVal',C.fontSize+'px');
  sv('tabAnime',C.tabAnime); sv('tabGames',C.tabGames); sv('tabSeries',C.tabSeries); sv('tabFilms',C.tabFilms);
  sc('showStatsToggle',C.showStats); sc('showSearchToggle',C.showSearch);
  ['border','text','accent','header','card','metaText'].forEach(k=>{
    const el=document.getElementById('rgb_'+k); if(el) el.checked=C.rgb[k];
  });
  sv('rgbSpeed',C.rgb.speed); st('rgbSpeedVal',C.rgb.speed+'с');
  sv('rgbSat',C.rgb.sat);     st('rgbSatVal',C.rgb.sat+'%');
  sv('rgbLight',C.rgb.light); st('rgbLightVal',C.rgb.light+'%');
  const bgPosDot=document.getElementById('bgPosDot'); if(bgPosDot){bgPosDot.style.left=C.bgPosX+'%';bgPosDot.style.top=C.bgPosY+'%';}
}

// ===== INDIVIDUAL SETTERS =====
function setBgOpacity(v){ C.bgOpacity=+v; document.getElementById('bgOpacityVal').textContent=v+'%'; applyBg(); saveCustom(); }
function setBgZoom(v){ C.bgZoom=+v; document.getElementById('bgZoomVal').textContent=v+'%'; applyBg(); saveCustom(); }
function setBgSize(v){ C.bgSize=v; applyBg(); saveCustom(); }
function setBgOverlay(v){ C.bgOverlay=+v; document.getElementById('bgOverlayVal').textContent=v+'%'; applyBg(); saveCustom(); }
function toggleBgGrad(v){ C.bgGrad=v; applyBg(); saveCustom(); }
function setBgGradA(v){ C.bgGradA=v; if(C.bgGrad)applyBg(); saveCustom(); }
function setBgGradB(v){ C.bgGradB=v; if(C.bgGrad)applyBg(); saveCustom(); }
function setBgGradAngle(v){ C.bgGradAngle=+v; document.getElementById('bgGradAngleVal').textContent=v+'°'; if(C.bgGrad)applyBg(); saveCustom(); }
function setBlur(v){ C.blurAmt=+v; document.getElementById('blurVal').textContent=v+'px'; document.querySelectorAll('header,.body-wrap,.setup-wrap').forEach(el=>{el.style.backdropFilter=`blur(${v}px)`;el.style.webkitBackdropFilter=`blur(${v}px)`;}); saveCustom(); }
function setCardBg(v){ C.cardBgColor=v; if(!C.rgb.card) document.documentElement.style.setProperty('--card-bg',`rgba(${hexToRgb(v)},${C.cardBgOpacity/100})`); saveCustom(); }
function setCardBgOpacity(v){ C.cardBgOpacity=+v; document.getElementById('cardBgOpacityVal').textContent=v+'%'; if(!C.rgb.card) document.documentElement.style.setProperty('--card-bg',`rgba(${hexToRgb(C.cardBgColor)},${v/100})`); saveCustom(); }
function setCardText(v){ C.cardTextColor=v; document.documentElement.style.setProperty('--card-text',v); saveCustom(); }
function setCardMeta(v){ C.cardMetaColor=v; document.documentElement.style.setProperty('--card-meta-text',v); saveCustom(); }
function toggleCardShadow(v){ C.cardShadow=v; applyCustom(); saveCustom(); }
function setBorderColor(v){ C.borderColorRaw=v; if(!C.rgb.border) document.documentElement.style.setProperty('--border-color',`rgba(${hexToRgb(v)},${C.borderOpacity/100})`); saveCustom(); }
function setBorderWidth(v){ C.borderWidth=+v; document.getElementById('borderWidthVal').textContent=v+'px'; document.documentElement.style.setProperty('--border-width',v+'px'); saveCustom(); }
function setBorderOpacity(v){ C.borderOpacity=+v; document.getElementById('borderOpacityVal').textContent=v+'%'; if(!C.rgb.border) document.documentElement.style.setProperty('--border-color',`rgba(${hexToRgb(C.borderColorRaw)},${v/100})`); saveCustom(); }
function setBorderRadius(v){ C.borderRadius=+v; document.getElementById('borderRadiusVal').textContent=v+'px'; document.documentElement.style.setProperty('--border-radius',v+'px'); saveCustom(); }
function setHeaderColor(v){ C.headerColor=v; if(!C.rgb.header)applyCustom(); saveCustom(); }
function setHeaderOpacity(v){ C.headerOpacity=+v; document.getElementById('headerOpacityVal').textContent=v+'%'; if(!C.rgb.header)applyCustom(); saveCustom(); }
function setPageBg(v){ C.pageBgColor=v; document.documentElement.style.setProperty('--bg',v); document.body.style.background=v; saveCustom(); }
function setAccent(v){ C.accent=v; if(!C.rgb.accent){document.documentElement.style.setProperty('--accent',v);document.documentElement.style.setProperty('--accent2',lighten(v,30));document.documentElement.style.setProperty('--accent-glow',v+'40');} saveCustom(); }
function setFont(v){ C.font=v; applyCustom(); saveCustom(); }
function setFontSize(v){ C.fontSize=+v; document.getElementById('fontSizeVal').textContent=v+'px'; document.body.style.fontSize=v+'px'; saveCustom(); }
function setTabColor(cat,v){ C['tab'+cat.charAt(0).toUpperCase()+cat.slice(1)]=v; document.documentElement.style.setProperty('--tab-'+cat,v); saveCustom(); }
function toggleShowStats(v){ C.showStats=v; applyCustom(); saveCustom(); }
function toggleShowSearch(v){ C.showSearch=v; applyCustom(); saveCustom(); }

function loadBg(inp){ const f=inp.files[0]; if(!f)return; const r=new FileReader(); r.onload=e=>{C.bg=e.target.result;C.bgGrad=false;document.getElementById('bgGradToggle').checked=false;saveCustom();applyBg();}; r.readAsDataURL(f); }
function removeBg(){ C.bg=null; saveCustom(); applyBg(); }

// ===== CUSTOM PANEL TABS =====
function switchCpTab(name){
  document.querySelectorAll('.cp-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));
  document.querySelectorAll('.cp-page').forEach(p=>p.classList.toggle('active',p.dataset.page===name));
}
function toggleCustom(){ document.getElementById('customPanel').classList.toggle('open'); document.getElementById('panelDim').classList.toggle('show'); }
