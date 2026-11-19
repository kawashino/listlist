/* cards.js: Карточки и список: отрисовка, статусы, форма, сохранение, фильтры, франшизы, подгрузка по частям. */

function renderList(){
  renderTabs();
  const list=$('list'),all=Object.values(items);
  let arr=all.filter(i=>i.cat===currentTab);
  if(curStatus!=='all')arr=arr.filter(i=>sOf(i)===curStatus);
  else if(currentFilter==='done')arr=arr.filter(i=>sOf(i)==='done');
  else if(currentFilter==='todo')arr=arr.filter(i=>sOf(i)!=='done');
  if(searchQuery)arr=arr.filter(i=>(i.title+' '+(i.note||'')+' '+(i.tags||'')).toLowerCase().includes(searchQuery));
  if(curColl!=='all')arr=arr.filter(i=>i.coll===curColl);if(curFr!=='all')arr=all.filter(i=>i.franchise===curFr);arr=arr.filter(smartOk).filter(i=>showArch?i.archived:!i.archived);updFr();arr=sortItems(arr);updColl();
  getAllCats().forEach(c=>{const n=all.filter(i=>i.cat===c.id&&sOf(i)!=='done').length,el=$('badge-'+c.id);if(el){el.textContent=n;el.classList.toggle('show',n>0);}});
  const cat=all.filter(i=>i.cat===currentTab),d=cat.filter(i=>sOf(i)==='done').length;
  [['stat-total',cat.length],['stat-done',d],['stat-left',cat.length-d]].forEach(([id,v])=>{const e=$(id);if(e)e.textContent=v;});
  if(!arr.length){list.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-icon">${C.icons?.empty?`<img src="${C.icons.empty}" style="width:64px;height:64px;border-radius:14px;object-fit:cover">`:'📂'}</div><p>Здесь пока пусто</p><button class="btn btn-primary" style="margin-top:14px;max-width:200px" onclick="openModal()">+ Добавить</button></div>`;return;}
  const ic=C.icons||{};
  lastTotal=arr.length;arr=arr.slice(0,shown);list.innerHTML=arr.map(i=>{
    const st=sOf(i),rs=Object.entries(i.ratings||{}).filter(([,v])=>v>0).map(([k,v])=>esc(k)+' '+v).join(' · ');
    const prog=(st==='watching'&&EP.includes(i.cat))?`<span>${i.cat==='manga'?'гл. ':'S'+(i.season||1)+' · '}${i.episode||0}${i.total?'/'+i.total:''}<button class="pp" onclick="bump('${i.id}')">+1</button></span>`:'';
    const tags=(i.tags||'').split(',').map(t=>t.trim()).filter(Boolean).map(t=>`<span class="tg">${esc(t)}</span>`).join('');
    const w=Object.keys(i.wants||{});return `<div class="item st-${st}${w.length>1?' both':''}">
      ${i.poster?`<img class="poster" loading="lazy" src="${esc(i.poster)}" onerror="this.remove()">`:''}
      <div class="check" onclick="toggleDone('${i.id}')">${st==='done'?(ic.check?`<img src="${ic.check}">`:'✓'):''}</div>
      <div class="item-body"><div class="item-title" style="cursor:pointer" onclick="openInfo('${i.id}')">${esc(i.title)}</div>
        ${i.note?`<div class="item-meta">${esc(i.note)}</div>`:''}
        <div class="chips"><span class="stb" onclick="cycleStatus('${i.id}')">${ST[st]}</span><span class="stb" onclick="toggleWant('${i.id}')">${w.length?'💗 '+w.map(esc).join(', '):'🤍 хочу'}</span>${i.coll?'<span class="tg">📁 '+esc(i.coll)+'</span>':''}${i.franchise?`<span class="tg" style="cursor:pointer" data-f="${esc(i.franchise)}" onclick="setFr(this.dataset.f)">🔗 ${esc(i.franchise)} ${frProg(i.franchise)}</span>`:''}${i.fear?`<span>${'💀'.repeat(i.fear)}</span>`:''}${i.scary?'<span>😱 скримеры</span>':''}${prog}${rs?`<span class="rt">⭐ ${rs}</span>`:''}${i.added_by?`<span>+${esc(i.added_by)}</span>`:''}</div>
        ${tags?`<div class="chips">${tags}</div>`:''}
        ${i.link?`<a href="${esc(i.link)}" target="_blank" style="font-size:11px;color:var(--accent2);text-decoration:none">🔗 Открыть</a>`:''}
      </div>
      <div class="item-actions"><button class="btn-icon" onclick="editItem('${i.id}')">${ic.edit?`<img src="${ic.edit}">`:'✏️'}</button><button class="btn-icon del" onclick="deleteItem('${i.id}')">${ic.del?`<img src="${ic.del}">`:'🗑️'}</button></div></div>`;
  }).join('');
  if(C.rgb.text&&rgbRaf)document.querySelectorAll('.item-title').forEach(el=>el.style.color=`hsl(${rgbHue},${C.rgb.sat}%,${C.rgb.light}%)`);
}

async function setStatus(id,st){const i=items[id];if(!i)return;items[id]={...i,status:st,done:st==='done'};render();beep();try{await upsertItem(items[id]);}catch(e){setSyncState('error','ошибка');}}

async function toggleDone(id){const i=items[id];if(i)setStatus(id,sOf(i)==='done'?'want':'done');}

function cycleStatus(id){const k=Object.keys(ST);setStatus(id,k[(k.indexOf(sOf(items[id]))+1)%k.length]);}

function fillForm(i){
  const v=(id,x)=>$(id).value=x??'';
  $('modalTitle').textContent=i.id?'Редактировать':'Добавить';
  v('inputTitle',i.title);v('inputNote',i.note);v('inputLink',i.link);
  rebuildCatSelect();$('inputCat').value=i.cat||currentTab;
  v('fStatus',sOf(i));v('fSeason',i.season||'');v('fEpisode',i.episode||'');v('fTotal',i.total||'');
  v('fRating',(i.ratings||{})[ME]||'');v('fTags',i.tags);v('fPoster',i.poster);v('fColl',i.coll);_pick=null;$('sug').innerHTML='';v('fFr',i.franchise);
  $('overlay').classList.add('open');setTimeout(()=>$('inputTitle').focus(),80);
}

function openModal(){editingId=null;fillForm({});}

function editItem(id){const i=items[id];if(!i)return;editingId=id;fillForm(i);}

async function saveItem(){
  const title=$('inputTitle').value.trim();if(!title){$('inputTitle').focus();return;}
  const old=editingId?items[editingId]:null,st=$('fStatus').value,rate=parseFloat($('fRating').value)||0,cat=$('inputCat').value||currentTab;
  const ratings={...(old&&old.ratings||{})};if(rate>0)ratings[ME]=rate;else delete ratings[ME];
  const btn=$('saveBtn');btn.disabled=true;btn.textContent='Сохраняем...';
  let poster=$('fPoster').value.trim();
  if(!poster)poster=await findPoster(title,cat);
  const base=old||{id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),ts:Date.now(),added_by:ME};
  const item={...base,cat,title,note:$('inputNote').value.trim(),link:$('inputLink').value.trim(),status:st,done:st==='done',
    season:+$('fSeason').value||0,episode:+$('fEpisode').value||0,total:+$('fTotal').value||0,ratings,tags:$('fTags').value.trim(),poster,coll:$('fColl').value.trim(),franchise:$('fFr').value.trim(),...(_pick&&!old?{info:{ts:1,year:_pick.year||'',genres:_pick.genres||'',desc:_pick.desc||'',score:_pick.score||'',trailer:_pick.trailer||''}}:{})};
  items[item.id]=item;render();closeModal();
  try{await upsertItem(item);setSyncState('live','сохранено');}catch(e){setSyncState('error','ошибка сохранения');}
  btn.disabled=false;btn.textContent='Сохранить';
}

async function deleteItem(id){
  const i=items[id];if(!i)return;delete items[id];render();
  try{await deleteItemDb(id);}catch(e){}
  toast('Удалено: '+i.title,async()=>{items[id]=i;render();try{await upsertItem(i);}catch(e){}});
}

let curColl='all',infoId=null;

function updColl(){const s=$('collSel');if(!s)return;const cs=[...new Set(Object.values(items).filter(i=>i.cat===currentTab&&i.coll).map(i=>i.coll))];
  const h='<option value="all">Все коллекции</option>'+cs.map(c=>`<option>${esc(c)}</option>`).join('');if(s.dataset.h!==h){s.innerHTML=h;s.dataset.h=h;}
  if(!cs.includes(curColl))curColl='all';s.value=curColl;}

function toggleWant(id){const w={...(items[id].wants||{})};if(w[ME])delete w[ME];else w[ME]=1;beep();patch(id,{wants:w});}

let _pick=null,sugT,curFr='all',SF={};

function frProg(f){const a=Object.values(items).filter(i=>i.franchise===f);return a.filter(i=>sOf(i)==='done').length+'/'+a.length;}

function setFr(f){curFr=f;render();}

function updFr(){const s=$('frSel');if(!s)return;const fs=[...new Set(Object.values(items).map(i=>i.franchise).filter(Boolean))];
  const h='<option value="all">Все франшизы</option>'+fs.map(c=>`<option>${esc(c)}</option>`).join('');
  if(s.dataset.h!==h){s.innerHTML=h;s.dataset.h=h;$('frList').innerHTML=fs.map(c=>`<option value="${esc(c)}">`).join('');}
  if(!fs.includes(curFr))curFr='all';s.value=curFr;s.style.display=fs.length?'':'none';}

function bump(id){const i=items[id],S=i.season||1,seen={...(i.seen||{})},a=new Set(seen[S]||[]),n=(i.episode||0)+1;a.add(n);seen[S]=[...a].sort((x,y)=>x-y);patch(id,{episode:n,seen});beep();}

const avgR=i=>{const r=Object.values(i.ratings||{}).filter(v=>v>0);return r.length?r.reduce((a,b)=>a+b,0)/r.length:(+i.info?.score||0);};

function smartOk(i){
  const f=SF,y=+i.info?.year||0;
  if(f.r&&avgR(i)<f.r)return false;if(f.y1&&(!y||y<f.y1))return false;if(f.y2&&(!y||y>f.y2))return false;
  if(f.g&&!(i.info?.genres||'').toLowerCase().includes(f.g))return false;if(f.t&&!(i.tags||'').toLowerCase().includes(f.t))return false;
  if(f.f&&(i.fear||0)<f.f)return false;if(f.s==='1'&&!i.scary)return false;if(f.s==='0'&&i.scary)return false;return true;
}

function readFlt(){SF={r:+$('sfR').value||0,y1:+$('sfY1').value||0,y2:+$('sfY2').value||0,g:$('sfG').value.trim().toLowerCase(),t:$('sfT').value.trim().toLowerCase(),f:+$('sfF').value||0,s:$('sfS').value};}

function writeFlt(){$('sfR').value=SF.r||'';$('sfY1').value=SF.y1||'';$('sfY2').value=SF.y2||'';$('sfG').value=SF.g||'';$('sfT').value=SF.t||'';$('sfF').value=SF.f||'';$('sfS').value=SF.s||'';}

function applyFlt(){readFlt();$('flt').classList.remove('open');render();$('fltBtn').style.outline=Object.values(SF).some(Boolean)?'2px solid var(--accent)':'';}

function resetFlt(){SF={};writeFlt();applyFlt();}

function saveView(){readFlt();const n=(prompt('Название вида?')||'').trim();if(!n)return;const v=JSON.parse(localStorage.getItem('wl_views')||'{}');v[n]=SF;localStorage.setItem('wl_views',JSON.stringify(v));drawViews();}

function useView(n){SF=JSON.parse(localStorage.getItem('wl_views')||'{}')[n]||{};writeFlt();applyFlt();}

function drawViews(){$('views').innerHTML=Object.keys(JSON.parse(localStorage.getItem('wl_views')||'{}')).map(n=>`<span class="stb" data-n="${esc(n)}" onclick="useView(this.dataset.n)">${esc(n)}</span>`).join('');}

let shown=60,lastTotal=0,sig='',showArch=false,px=0;

const io=new IntersectionObserver(e=>{if(e[0].isIntersecting){io.disconnect();shown+=60;render();}});

function mergeShared(k,cur,mine){
  if(k==='wants'){const r={...(cur||{})};if(mine[ME])r[ME]=1;else delete r[ME];return r;}
  if(k==='reacts'){const r={};cur=cur||{};new Set([...Object.keys(cur),...Object.keys(mine)]).forEach(e=>{const s=new Set(cur[e]||[]);(mine[e]||[]).includes(ME)?s.add(ME):s.delete(ME);r[e]=[...s];});return r;}
  const key=c=>c.by+c.ts+c.text,have=new Set((cur||[]).map(key));return[...(cur||[]),...mine.filter(c=>!have.has(key(c)))];
}

async function patch(id,o){
  const old=items[id];if(!old)return;items[id]={...old,...o};render();if(infoId===id&&$('info').classList.contains('open'))drawInfo();
  try{for(const k of ['wants','reacts','comments'])if(k in o){const r=await sbFetch(`/items?id=eq.${encodeURIComponent(id)}&select=${k}`);items[id][k]=mergeShared(k,r?.[0]?.[k],o[k]);}
    await upsertItem(items[id]);render();}catch(e){setSyncState('error','ошибка');}
}

function render(){
  const sg=[currentTab,currentFilter,curStatus,searchQuery,curColl,curFr,currentSort,JSON.stringify(SF),showArch].join('|');if(sg!==sig){sig=sg;shown=60;}
  lastTotal=0;renderList();
  if(lastTotal>shown){$('list').insertAdjacentHTML('beforeend',`<div id="more" class="stb" style="grid-column:1/-1;text-align:center;padding:12px;cursor:pointer" onclick="shown+=60;render()">Показать ещё (${lastTotal-shown})</div>`);io.observe($('more'));}
  try{localStorage.setItem('wl_state',JSON.stringify({t:currentTab,f:currentFilter,s:currentSort}));}catch(e){}
}

/* Встроенная вкладка «Манга» есть у всех. Карточки из старой личной категории (она жила только на одном устройстве) переносим в неё. */
async function migrateManga(){
  const ids=(C.customCats||[]).filter(c=>c.kind==='manga'||c.name==='Манга').map(c=>c.id);
  if(!ids.length)return;
  let n=0;
  for(const i of Object.values(items))if(ids.includes(i.cat)){items[i.id]={...i,cat:'manga'};n++;try{await upsertItem(items[i.id]);}catch(e){}}
  C.customCats=C.customCats.filter(c=>!ids.includes(c.id));
  for(const id of ids){if(C.tabs&&C.tabs[id]){C.tabs.manga=C.tabs.manga||C.tabs[id];delete C.tabs[id];}if(C.icons&&C.icons[id]&&!C.icons.manga)C.icons.manga=C.icons[id];if(currentTab===id)currentTab='manga';}
  saveCustom();renderTabs();render();renderCustomCatList();renderIconPreviews();if(n)toast('Манга перенесена во встроенную вкладку: '+n);
}
