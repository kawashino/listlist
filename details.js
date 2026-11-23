/* details.js: Окно с подробностями карточки: описание, серии, реакции, комментарии, статистика. */

function react(id,e){
  const i=items[id],r={...(i.reacts||{})},n=[...(r[e]||[])],k=n.indexOf(ME),had=k>=0;if(had)n.splice(k,1);else n.push(ME);r[e]=n;
  if(!extrasOn){patch(id,{reacts:r});return;}
  items[id]={...i,reacts:r};render();if(infoId===id)drawInfo();
  (had?xtDel('item_reacts',`item_id=eq.${encodeURIComponent(id)}&emoji=eq.${encodeURIComponent(e)}&author=eq.${encodeURIComponent(ME)}`):xtAdd('item_reacts',{item_id:id,emoji:e,author:ME})).catch(()=>setSyncState('error','ошибка'));
}

function addCmt(){
  const t=$('cmt').value.trim();if(!t)return;const c={by:ME,text:t,ts:Date.now(),id:'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)};
  if(!extrasOn){patch(infoId,{comments:[...(items[infoId].comments||[]),c]});return;}
  const id=infoId;items[id]={...items[id],comments:[...(items[id].comments||[]),c]};render();drawInfo();
  xtAdd('item_comments',{id:c.id,item_id:id,author:ME,body:t,ts:c.ts}).catch(()=>setSyncState('error','ошибка'));
}

async function refreshItemInfo(id){
  const i=items[id];if(!i)return;
  const inf=await findInfo(i);
  patch(id,{info:{...(i.info||{}),...inf,ts:1},poster:i.poster||inf.poster||'',franchise:i.franchise||inf.franchise||'',total:i.total||inf.eps||0});
  drawInfo();
  toast('Данные обновлены');
}

async function openInfo(id){
  const i=items[id];if(!i)return;infoId=id;
  if(document.body.classList.contains('split')){
    $('info').classList.add('open');
    document.body.classList.add('info-open');
    const wrap=document.querySelector('.info-overlay');
    if(!wrap){document.body.insertAdjacentHTML('beforeend','<div id="infoWrap" class="info-overlay"></div>');}
  } else {
    $('info').classList.add('open');
    document.body.classList.add('info-open');
  }
  drawInfo();
  // обновляем, если данных нет, они старше месяца или нет описания/жанров/постера
  const age=i.info&&i.info.upd?Date.now()-i.info.upd:Infinity;
  const stale=!i.info||!i.info.ts||age>30*864e5||!cleanDesc(i.info.desc)||!genresOf(i).length||(!i.poster&&!i.info.poster);
  if(stale){
    const inf=await findInfo(i),c=items[id];
    if(c)patch(id,{info:{...(c.info||{}),...inf,ts:1},poster:c.poster||inf.poster||'',franchise:c.franchise||inf.franchise||'',total:c.total||inf.eps||0});
  }
}

function showTrl(){$('trl').innerHTML=`<iframe src="${esc(items[infoId].info.trailer)}" allowfullscreen style="width:100%;aspect-ratio:16/9;border:0;border-radius:10px"></iframe>`;}

function drawInfoMain(){
  const i=items[infoId],f=i.info||{},rc=i.reacts||{},pic=i.poster||f.poster;
  const gs=genresOf(i);
  $('infoBody').innerHTML=`<div style="display:flex;gap:12px">${pic?`<img class="poster" style="width:90px;height:128px" src="${esc(pic)}">`:''}<div><div style="display:flex;align-items:center;gap:8px"><h3 style="margin:0">${esc(i.title)}</h3><button class="upload-btn" onclick="refreshItemInfo('${i.id}')" title="Обновить постер, описание, жанры, франшизу">🔄</button></div><div class="chips">${f.year?`<span>${esc(f.year)}</span>`:''}${gs.map(g=>`<span class="tg">${esc(g)}</span>`).join('')}${f.score?`<span class="rt">⭐ ${esc(f.score)}</span>`:''}</div></div></div>
  ${f.desc?`<p class="info-desc" style="font-size:13px;color:var(--text2);line-height:1.5;max-height:140px;overflow:auto">${esc(f.desc)}</p>`:(f.ts?'':'<p style="color:var(--text3)">Загружаю описание…</p>')}
  ${f.trailer?`<div id="trl"><button class="upload-btn" onclick="showTrl()">▶️ Трейлер</button></div>`:''}
  <div class="cr" style="margin:10px 0"><span class="cl">Дата просмотра</span><input type="date" value="${esc(i.watched_on||'')}" onchange="patch('${i.id}',{watched_on:this.value})"><label style="font-size:12px"><input type="checkbox" ${i.together?'checked':''} onchange="patch('${i.id}',{together:this.checked})"> вместе</label></div>
  <div class="chips">${['👍','😂','😱','😢','🔥'].map(e=>{const n=rc[e]||[];return `<span class="stb" style="${n.includes(ME)?'outline:1px solid var(--accent)':''}" onclick="react('${i.id}','${e}')">${e} ${n.length||''}</span>`;}).join('')}</div>
  <div style="margin:10px 0">${(i.comments||[]).map(c=>`<div style="font-size:12px;margin:4px 0"><b>${esc(c.by)}:</b> ${esc(c.text)}</div>`).join('')}</div>
  <div class="cr"><input id="cmt" class="cp-select" placeholder="Комментарий…" onkeydown="if(event.key==='Enter')addCmt()"><button class="upload-btn" onclick="addCmt()">➤</button></div>`;
}

function bars(o,max){return Object.entries(o).map(([k,v])=>`<div class="br"><span>${esc(k)}</span><div class="bw"><i style="width:${Math.max(3,v/max*100)}%"></i></div><b>${v}</b></div>`).join('');}

/* ===== ЖАНРЫ И ФРАНШИЗА В ОКНЕ КАРТОЧКИ ===== */
function drawGenresEdit(){
  const i=items[infoId];if(!i)return;
  const g=genresOf(i).join(', ');
  $('infoBody').insertAdjacentHTML('beforeend',`<div class="field" style="margin-top:10px"><label>Жанры (через запятую)</label>
    <input id="fGenres" class="cp-select" value="${esc(g)}" placeholder="хоррор, романтика"
      onchange="patch('${i.id}',{info:Object.assign({},items['${i.id}'].info||{},{genres:this.value.split(',').map(s=>s.trim()).filter(Boolean)})})">
  </div>`);
}

function drawFranchise(){
  const i=items[infoId];if(!i||!i.franchise)return;
  const parts=Object.values(items).filter(x=>x.franchise===i.franchise).sort((a,b)=>(a.season||1)-(b.season||1)||(a.ts||0)-(b.ts||0));
  if(parts.length<2)return;
  const done=parts.filter(x=>sOf(x)==='done').length;
  const row=x=>`<div class="br" style="gap:8px;margin:6px 0;${x.id===i.id?'outline:1px solid var(--accent);border-radius:8px':''}">
    ${x.poster?`<img class="poster" style="width:28px;height:40px" src="${esc(x.poster)}" onerror="this.remove()">`:''}
    <span style="flex:1;width:auto;cursor:pointer" onclick="openInfo('${x.id}')">${esc(x.title)}</span>
    <span class="stb" onclick="cycleStatus('${x.id}')">${ST[sOf(x)]}</span></div>`;
  $('infoBody').insertAdjacentHTML('beforeend',
    `<div class="cs-title" style="margin-top:12px">🔗 Франшиза «${esc(i.franchise)}» · ${done}/${parts.length}</div>${parts.map(row).join('')}`);
}

function stats(){
  const all=Object.values(items),done=all.filter(i=>sOf(i)==='done'),yr=new Date().getFullYear(),cats={},g={},m={},rt={};
  getAllCats().forEach(c=>cats[c.name]=done.filter(i=>i.cat===c.id).length);
  done.forEach(i=>genresOf(i).forEach(x=>g[x]=(g[x]||0)+1));
  const top=Object.fromEntries(Object.entries(g).sort((a,b)=>b[1]-a[1]).slice(0,6));
  for(let k=1;k<=12;k++)m[k]=0;done.forEach(i=>{const d=new Date(i.watched_on||i.ts);if(d.getFullYear()===yr)m[d.getMonth()+1]++;});
  all.forEach(i=>Object.entries(i.ratings||{}).forEach(([n,v])=>(rt[n]=rt[n]||[]).push(v)));
  const avg=Object.fromEntries(Object.entries(rt).map(([n,a])=>[n,+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1)]));
  const mx=o=>Math.max(1,...Object.values(o));
  $('statsBody').innerHTML=`<h3 style="margin-top:0">Итоги ${yr}</h3><p>Просмотрено всего: <b>${done.length}</b> · вместе: <b>${done.filter(i=>i.together).length}</b></p><h4>По категориям</h4>${bars(cats,mx(cats))}<h4>Жанры</h4>${bars(top,mx(top))||'<small>Открой карточки, чтобы подтянулись жанры</small>'}<h4>По месяцам</h4>${bars(m,mx(m))}<h4>Средняя оценка</h4>${bars(avg,10)||'<small>Оценок пока нет</small>'}`;
  $('stats').classList.add('open');
}

function infoPosterPicker(){
  $('infoBody').insertAdjacentHTML('beforeend','<div style="margin-top:12px"><div class="cr"><input id="pq" class="cp-select" placeholder="Название для поиска (англ. или оригинал)"><button class="upload-btn" onclick="pickPoster()">🖼 Найти</button></div><div id="posterPick" class="whgrid" style="margin-top:8px"></div></div>');}

function togEp(n){
  const i=items[infoId],S=i.season||1,seen={...(i.seen||{})},a=new Set(seen[S]||[]);a.has(n)?a.delete(n):a.add(n);seen[S]=[...a].sort((x,y)=>x-y);
  const o={seen,episode:seen[S].length?Math.max(...seen[S]):0};if(a.size&&sOf(i)==='want')o.status='watching';
  if(i.total&&a.size>=i.total)toast('Сезон '+S+' досмотрен 🎉');patch(infoId,o);beep();
}

function setSeason(d){const i=items[infoId],S=Math.max(1,(i.season||1)+d);patch(infoId,{season:S,episode:Math.max(0,...((i.seen||{})[S]||[0]))});}

function setFear(n){patch(infoId,{fear:n});}

function infoEpisodesAndFear(){
  const i=items[infoId];if(!i)return;
  const S=i.season||1,seen=new Set((i.seen||{})[S]||[]),T=Math.min(+i.total||0,300);let h='';
  if(EP.includes(i.cat))h+=`<div class="cs-title" style="margin-top:12px">Сезон <button class="upload-btn" onclick="setSeason(-1)">◀</button> ${S} <button class="upload-btn" onclick="setSeason(1)">▶</button> · просмотрено ${seen.size}${T?'/'+T+', осталось '+Math.max(0,T-seen.size):''}</div>`+(T?`<div class="eg">${Array.from({length:T},(_,k)=>`<b class="${seen.has(k+1)?'on':''}" onclick="togEp(${k+1})">${k+1}</b>`).join('')}</div>`:'<small style="color:var(--text3)">Укажи «Всего серий» в форме редактирования</small>');
  h+=`<div class="cs-title" style="margin-top:12px">Насколько страшно</div><div class="chips">${[1,2,3,4,5].map(n=>`<span class="stb" style="${(i.fear||0)>=n?'background:var(--accent-glow)':''}" onclick="setFear(${n})">💀</span>`).join('')}<span class="stb" onclick="setFear(0)">сброс</span><label style="font-size:12px"><input type="checkbox" ${i.scary?'checked':''} onchange="patch(infoId,{scary:this.checked})"> скримеры</label></div>`;
  $('infoBody').firstElementChild.insertAdjacentHTML('afterend',h);
}

function infoArchiveButton(){const i=items[infoId];if(i)$('infoBody').insertAdjacentHTML('beforeend',`<div style="margin-top:12px"><button class="upload-btn" onclick="patch(infoId,{archived:!items[infoId].archived})">📦 ${i.archived?'Вернуть из архива':'В архив'}</button></div>`);}

function drawInfo(){drawInfoMain();infoPosterPicker();infoEpisodesAndFear();drawFranchise();drawGenresEdit();infoArchiveButton();applyPosterColor();if(document.body.classList.contains('split')&&!document.getElementById('infoClose')){const b=document.createElement('button');b.id='infoClose';b.className='btn-icon del';b.title='Закрыть карточку';b.textContent='✕';b.onclick=closeModal;b.style.position='absolute';b.style.top='10px';b.style.right='12px';b.style.zIndex='2';$('infoBody')?.parentElement?.insertAdjacentElement('beforebegin',b);}}

/* Цвета из постера: средний яркий цвет обложки подкрашивает окно карточки. Работает, если сайт-источник картинки разрешает чтение пикселей. */
function posterColor(url){
  return new Promise(res=>{
    if(!url)return res(null);
    try{const c=localStorage.getItem('wl_pc_'+url);if(c)return res(c==='-'?null:c);}catch(e){}
    const im=new Image(),done=col=>{try{localStorage.setItem('wl_pc_'+url,col||'-');}catch(e){}res(col);};
    im.crossOrigin='anonymous';im.onerror=()=>res(null);
    im.onload=()=>{try{const cv=document.createElement('canvas');cv.width=cv.height=24;const x=cv.getContext('2d');x.drawImage(im,0,0,24,24);const d=x.getImageData(0,0,24,24).data;let r=0,g=0,b=0,n=0;
      for(let k=0;k<d.length;k+=4){const mx=Math.max(d[k],d[k+1],d[k+2]),mn=Math.min(d[k],d[k+1],d[k+2]);if(mx-mn>30&&mx>60){r+=d[k];g+=d[k+1];b+=d[k+2];n++;}}
      done(n?'#'+[r,g,b].map(v=>Math.round(v/n).toString(16).padStart(2,'0')).join(''):null);}catch(e){done(null);}};
    im.src=url;
  });
}
async function applyPosterColor(){
  const box=$('infoBody'),i=items[infoId];if(!box||!i)return;
  if(!U().posterColor){box.style.removeProperty('--accent');box.style.background='';return;}
  const col=await posterColor(i.poster||(i.info&&i.info.poster));if(infoId!==i.id)return;
  if(col){box.style.setProperty('--accent',col);box.style.background=`linear-gradient(160deg,${col}40,#1a1e35 55%)`;}else{box.style.removeProperty('--accent');box.style.background='';}
}
