/* layout.js: Настройки вида и расположения: панель «Ещё», вкладки, параллакс, боковая панель. */

document.head.insertAdjacentHTML('beforeend','<style id="userCss"></style>');

const UI0={glow:0,glowC:'#7c5cfc',grad:false,gA:'#7c5cfc',gB:'#ec4899',par:false,parS:20,css:'',nav:false,fabL:false,hide:true,cols:2,dens:1,vib:true,video:''};

const U=()=>{if(!C.ui)C.ui={};for(const k in UI0)if(!(k in C.ui))C.ui[k]=UI0[k];return C.ui;};

function applyUiCore(){
  const u=U(),r=document.documentElement.style,b=document.body.classList;
  r.setProperty('--glow',u.glow+'px');r.setProperty('--glowc',u.glowC);r.setProperty('--ga',u.gA);r.setProperty('--gb',u.gB);r.setProperty('--cols',u.cols);r.setProperty('--dens',u.dens);
  b.toggle('glow',u.glow>0);b.toggle('gradb',!!u.grad);b.toggle('navb',!!u.nav);b.toggle('fabl',!!u.fabL);
  $('userCss').textContent=u.css;if(!u.par)$('bgLayer').style.transform='';
  const h=document.querySelector('header');if(h)r.setProperty('--hh',h.offsetHeight+'px');
  applyVideo();
}

function setU(k,v){U()[k]=v;saveCustom();applyUI();}

function par(x,y){const s=U().parS;$('bgLayer').style.transform=`scale(1.12) translate(${x*s}px,${y*s}px)`;}

addEventListener('mousemove',e=>{if(U().par)par((e.clientX/innerWidth-.5)*-1,(e.clientY/innerHeight-.5)*-1);});

addEventListener('deviceorientation',e=>{if(U().par&&e.gamma!=null)par(-Math.max(-1,Math.min(1,e.gamma/30)),-Math.max(-1,Math.min(1,(e.beta-45)/30)));});

function togPar(v){if(v&&window.DeviceOrientationEvent&&DeviceOrientationEvent.requestPermission)DeviceOrientationEvent.requestPermission().catch(()=>{});setU('par',v);}

let ly=0;

addEventListener('scroll',()=>{const y=scrollY,hid=U().hide&&y>ly&&y>90,h=document.querySelector('header');if(h)h.classList.toggle('hid',hid);document.body.classList.toggle('hh',hid);ly=y;},{passive:true});

const tabsFull=()=>{const t=C.tabs||{};return baseCats().map((c,k)=>({...c,name:t[c.id]?.n||c.name,_o:t[c.id]?.o??k,_h:t[c.id]?.h,_c:t[c.id]?.c})).sort((a,b)=>a._o-b._o);};

function tabSet(id,k,v){C.tabs=C.tabs||{};C.tabs[id]={...(C.tabs[id]||{}),[k]:v};saveCustom();renderTabs();render();drawTabsEd();}

function tabMove(id,d){const a=tabsFull(),i=a.findIndex(c=>c.id===id),j=i+d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];C.tabs=C.tabs||{};a.forEach((c,k)=>C.tabs[c.id]={...(C.tabs[c.id]||{}),o:k});saveCustom();renderTabs();drawTabsEd();}

function drawTabsEd(){const el=$('tabsEd');if(!el)return;
  el.innerHTML=tabsFull().map(c=>`<div class="cr"><button class="upload-btn" onclick="tabMove('${c.id}',-1)">▲</button><button class="upload-btn" onclick="tabMove('${c.id}',1)">▼</button><input class="cp-select" style="flex:1" value="${esc(c.name)}" onchange="tabSet('${c.id}','n',this.value)"><input type="color" value="${c._c||'#7c5cfc'}" onchange="tabSet('${c.id}','c',this.value)"><label class="toggle" title="Показывать"><input type="checkbox" ${c._h?'':'checked'} onchange="tabSet('${c.id}','h',!this.checked)"><span class="tslider"></span></label></div>`).join('');}

function addPreset(k){const m={books:['📚','Книги'],manga:['📖','Манга'],ranobe:['📕','Ранобэ']}[k];if((C.customCats||[]).some(c=>c.kind===k)){toast('Уже есть');return;}
  C.customCats.push({id:'cat_'+Date.now(),name:m[1],icon:m[0],kind:k});saveCustom();renderTabs();renderCustomCatList();render();drawTabsEd();toast('Добавлена категория «'+m[1]+'»');}

const rw=(l,x)=>`<div class="rr"><span class="cl">${l}</span>${x}</div>`;

const rg=(k,a,b,st=1)=>`<input type="range" min="${a}" max="${b}" step="${st}" value="${U()[k]}" oninput="setU('${k}',+this.value)">`;

const tg=(k,f)=>`<label class="toggle"><input type="checkbox" ${U()[k]?'checked':''} onchange="${f||`setU('${k}',this.checked)`}"><span class="tslider"></span></label>`;

const cl=k=>`<input type="color" value="${U()[k]}" oninput="setU('${k}',this.value)">`;

function drawMoreMain(){
  $('moreBody').innerHTML=`<div class="cs"><div class="cs-title">Карточки</div>
   ${rw('Свечение',rg('glow',0,40))}${rw('Цвет свечения',cl('glowC'))}${rw('Градиентная рамка',tg('grad')+cl('gA')+cl('gB'))}
   ${rw('Колонок',`<select class="cp-select" onchange="setU('cols',+this.value)">${[1,2,3,4,5,6].map(n=>`<option ${U().cols==n?'selected':''}>${n}</option>`).join('')}</select>`)}${rw('Плотность',rg('dens',.6,1.6,.1))}</div><div class="sep"></div>
   <div class="cs"><div class="cs-title">Фон</div>${rw('Параллакс',tg('par','togPar(this.checked)'))}${rw('Сила',rg('parS',5,50))}
   <div class="cr"><button class="upload-btn" onclick="$('vidFile').click()">🎬 Видео-фон (mp4/webm)</button><button class="reset-sm" onclick="setU('video','')">Убрать</button><input type="file" id="vidFile" accept="video/mp4,video/webm" onchange="loadVid(this)"></div></div><div class="sep"></div>
   <div class="cs"><div class="cs-title">Интерфейс</div>${rw('Меню внизу (телефон)',tg('nav'))}${rw('Кнопка «+» слева',tg('fabL'))}${rw('Прятать шапку при прокрутке',tg('hide'))}${rw('Вибрация',tg('vib'))}
   <div style="font-size:11px;color:var(--text3)">Клавиши: N добавить, / поиск, R рулетка, S статистика, F фильтры, Esc закрыть. Картинку для пустого списка задай во вкладке «Иконки».</div></div><div class="sep"></div>
   <div class="cs"><div class="cs-title">Вкладки</div><div id="tabsEd"></div><div class="cr" style="flex-wrap:wrap"><button class="upload-btn" onclick="addPreset('books')">+ Книги</button><button class="upload-btn" onclick="addPreset('ranobe')">+ Ранобэ</button></div></div><div class="sep"></div>
   <div class="cs"><div class="cs-title">Свой CSS</div><textarea class="cp-select" style="height:110px;font-family:monospace;font-size:12px" placeholder=".item{border-radius:20px}" oninput="setU('css',this.value)">${esc(U().css)}</textarea></div><div class="sep"></div>
   <div class="cs"><div class="cs-title">Хранилище</div><div id="usage" style="font-size:12px;color:var(--text2)">—</div><button class="upload-btn" onclick="usage()">Проверить</button></div>`;
  drawTabsEd();
}

Object.assign(UI0,{layout:'top',tools:'collapse',toolsOpen:false,view:'list',colsM:1,galMin:150,maxw:860,gap:10,tl:1,btnS:30,pw:46,showPoster:true,showNotes:true,showChips:true,chipsWrap:false,actHover:false,showSync:true,logo:''});

function applyUiLayout(){
  const u=U(),r=document.documentElement.style,b=document.body.classList;
  r.setProperty('--colsm',u.colsM);r.setProperty('--gal',u.galMin+'px');r.setProperty('--maxw',u.maxw+'px');r.setProperty('--gap',u.gap+'px');
  r.setProperty('--tl',u.tl);r.setProperty('--bs',u.btnS+'px');r.setProperty('--pw',u.pw+'px');r.setProperty('--ph',Math.round(u.pw*1.4)+'px');
  b.toggle('side',u.layout==='side');b.toggle('gal',u.view==='gal');b.toggle('cmp',u.view==='cmp');b.toggle('nop',!u.showPoster);b.toggle('non',!u.showNotes);
  b.toggle('nch',!u.showChips);b.toggle('chipsw',!!u.chipsWrap);b.toggle('acth',!!u.actHover);b.toggle('tools-open',u.tools==='show'||!!u.toolsOpen);
  const lg=document.querySelector('.logo > span:not(.logo-icon)');if(lg)lg.innerHTML=u.logo?esc(u.logo):'наш <span>список</span>';
  document.title=u.logo||'Наш список';const sy=document.querySelector('.sync-row');if(sy)sy.style.display=u.showSync?'':'none';
  placeSide();
}

function applyUI(){applyUiCore();applyUiLayout();}

function placeSide(){
  const sb=$('sideBox'),tl=$('tools');if(!sb||!tl)return;
  const side=document.body.classList.contains('side')&&innerWidth>=1000,ct=document.querySelector('.content'),st=$('statsBar'),tb=document.querySelector('.toolbar');
  if(side){sb.append(st,tl);}else if(tl.parentElement===sb){ct.insertBefore(st,tb);tb.after(tl);}
  document.body.classList.toggle('sideon',side);
}

addEventListener('resize',placeSide);

const sl=(k,o)=>`<select class="cp-select" onchange="setU('${k}',this.value)">${o.map(([v,t])=>`<option value="${v}" ${U()[k]==v?'selected':''}>${t}</option>`).join('')}</select>`;

function drawMoreLayout(){
  $('moreBody').insertAdjacentHTML('afterbegin',`<div class="cs"><div class="cs-title">Вид и расположение</div>
   ${rw('Расположение',sl('layout',[['top','Классика'],['side','Боковая панель (ПК)']]))}
   ${rw('Инструменты',sl('tools',[['collapse','Сворачиваемые (⋯)'],['show','Всегда видны']]))}
   ${rw('Вид карточек',sl('view',[['list','Список'],['gal','Галерея постеров'],['cmp','Компактно']]))}
   ${rw('Колонок на телефоне',sl('colsM',[[1,'1'],[2,'2']]))}
   ${rw('Постер в галерее',rg('galMin',110,260,10))}${rw('Постер в списке',rg('pw',30,120,2))}
   ${rw('Ширина страницы (ПК)',rg('maxw',700,1600,20))}${rw('Отступ карточек',rg('gap',4,24,2))}
   ${rw('Строк в названии',rg('tl',1,3))}${rw('Размер кнопок',rg('btnS',22,42,2))}
   ${rw('Постеры',tg('showPoster'))}${rw('Заметки',tg('showNotes'))}${rw('Метки (статус, оценки…)',tg('showChips'))}
   ${rw('Метки в несколько строк',tg('chipsWrap'))}${rw('Кнопки по наведению (ПК)',tg('actHover'))}${rw('Статус синхронизации',tg('showSync'))}
   ${rw('Название',`<input class="cp-select" style="flex:1" placeholder="наш список" value="${esc(U().logo)}" oninput="setU('logo',this.value)">`)}
   <div style="font-size:11px;color:var(--text3)">Боковая панель включается на экранах шире 1000 px: вкладки, статистика и инструменты уходят влево.</div></div><div class="sep"></div>`);
}

function drawMore(){drawMoreMain();drawMoreLayout();}
