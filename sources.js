/* sources.js: Откуда берём данные о тайтлах: Shikimori, Jikan, iTunes, Википедия, Open Library; загрузка файлов; подсказки при добавлении. */

async function upload(f,kind){
  const path=`${kind}/${(ME||'x').replace(/\W/g,'')}-${Date.now()}.${(f.name.split('.').pop()||'bin').toLowerCase()}`;
  const r=await fetch(`${SUPA_URL}/storage/v1/object/media/${path}`,{method:'POST',headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`,'Content-Type':f.type||'application/octet-stream','x-upsert':'true'},body:f});
  if(!r.ok)throw new Error(await r.text());
  return `${SUPA_URL}/storage/v1/object/public/media/${path}`;
}

async function shrink(f,max){const b=await createImageBitmap(f),k=Math.min(1,max/Math.max(b.width,b.height)),c=document.createElement('canvas');c.width=Math.round(b.width*k);c.height=Math.round(b.height*k);c.getContext('2d').drawImage(b,0,0,c.width,c.height);return c.toDataURL('image/webp',.85);}

async function upPoster(inp){const f=inp.files[0];if(!f)return;try{$('fPoster').value=await upload(f,'poster');}catch(e){toast('Не вышло загрузить постер');}}

const J=async u=>(await fetch(u)).json();

const SRC={
  async shiki(q){
    for(const h of ['shikimori.one','shikimori.me','shikimori.io']){
      try{const a=await J(`https://${h}/api/animes?limit=4&search=${encodeURIComponent(q)}`);
        const r=a.map(x=>({title:x.russian||x.name,poster:x.image?.original?`https://${h}${x.image.original}`:'',year:(x.aired_on||'').slice(0,4),score:+x.score||'',eps:x.episodes||0}));
        if(a[0]){try{const d=await J(`https://${h}/api/animes/${a[0].id}`);r[0].genres=(d.genres||[]).map(g=>g.russian||g.name).join(', ');r[0].desc=(d.description||'').replace(/\[[^\]]*\]/g,'').slice(0,600);}catch(e){}}
        return r;}catch(e){}
    }return[];
  },
  async jikan(q){try{return((await J('https://api.jikan.moe/v4/anime?limit=4&q='+encodeURIComponent(q))).data||[]).map(x=>({title:x.title_english||x.title,poster:x.images?.jpg?.image_url||'',year:x.year||'',genres:(x.genres||[]).map(g=>g.name).join(', '),desc:x.synopsis||'',score:x.score||'',eps:x.episodes||0,trailer:x.trailer?.embed_url||''}));}catch(e){return[];}},
  async itunes(q,cat){try{const m=cat==='series'?'tvShow':'movie',e=cat==='series'?'tvSeason':'movie';
    return((await J(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=${m}&entity=${e}&country=ru&limit=4`)).results||[]).map(x=>({title:x.trackName||x.collectionName,poster:(x.artworkUrl100||'').replace('100x100bb','400x600bb'),year:(x.releaseDate||'').slice(0,4),genres:x.primaryGenreName||'',desc:x.longDescription||x.shortDescription||''}));}catch(e){return[];}},
  async wiki(q,cat){
    const w={anime:'аниме',films:'фильм',series:'сериал',games:'игра'}[cat]||'';
    for(const l of ['ru','en']){
      try{const d=await J(`https://${l}.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=4&gsrsearch=${encodeURIComponent(q+' '+(l==='ru'?w:''))}&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=300&exintro=1&explaintext=1&exsentences=3&format=json&origin=*`);
        const r=Object.values(d.query?.pages||{}).sort((a,b)=>a.index-b.index).map(p=>({title:p.title,poster:p.thumbnail?.source||'',desc:p.extract||''})).filter(x=>x.poster);
        if(r.length)return r;}catch(e){}
    }return[];
  }
};

async function candsStd(q,cat){
  const o=cat==='anime'?['shiki','jikan','wiki']:cat==='games'?['wiki']:['itunes','wiki'],out=[];
  for(const k of o){out.push(...(await SRC[k](q,cat)).filter(x=>x.poster));if(out.length>=6)break;}
  return out;
}

async function lookup(i){const b=(await cands(i.title,i.cat))[0]||{};return{ts:1,poster:b.poster||'',year:b.year||'',genres:b.genres||'',desc:b.desc||'',score:b.score||'',eps:b.eps||0,trailer:b.trailer||''};}

async function findPoster(q,cat){return(await lookup({title:q,cat})).poster;}

async function findInfo(i){return lookup(i);}

async function fillPosters(){
  const todo=Object.values(items).filter(i=>!i.poster);let n=0,ok=0;toast('Ищу постеры…');
  for(const i of todo){const f=await lookup(i);n++;
    if(f.poster){items[i.id]={...i,poster:f.poster,info:f,total:i.total||f.eps||0};ok++;try{await upsertItem(items[i.id]);}catch(e){}}
    if(n%4==0){render();toast(`Постеры: ${ok} из ${n} (всего ${todo.length})`);}
    await new Promise(r=>setTimeout(r,700));}
  render();toast(`Готово: найдено ${ok} из ${n}`);
}

async function pickPoster(){
  const i=items[infoId],g=$('posterPick');g.textContent='Ищу…';
  const c=await cands(($('pq').value.trim())||i.title,i.cat);
  g.innerHTML=c.map(x=>`<img src="${esc(x.poster)}" style="height:110px" onclick="patch('${i.id}',{poster:'${x.poster}'})">`).join('')||'Не нашлось. Попробуй другое название или вставь ссылку в форме.';
}

async function fromLink(u){
  try{let m;
    if(m=u.match(/shikimori\.[a-z]+\/animes\/[a-z]?(\d+)/)){const d=await J(`https://shikimori.one/api/animes/${m[1]}`);return{title:d.russian||d.name,poster:d.image?.original?'https://shikimori.one'+d.image.original:'',year:(d.aired_on||'').slice(0,4),genres:(d.genres||[]).map(g=>g.russian||g.name).join(', '),desc:(d.description||'').replace(/\[[^\]]*\]/g,'').slice(0,600),score:+d.score||'',eps:d.episodes||0,cat:'anime',url:u};}
    if(m=u.match(/myanimelist\.net\/anime\/(\d+)/)){const x=(await J(`https://api.jikan.moe/v4/anime/${m[1]}`)).data;return{title:x.title_english||x.title,poster:x.images?.jpg?.image_url||'',year:x.year||'',genres:(x.genres||[]).map(g=>g.name).join(', '),desc:x.synopsis||'',score:x.score||'',eps:x.episodes||0,trailer:x.trailer?.embed_url||'',cat:'anime',url:u};}
    if(m=u.match(/(\w+)\.wikipedia\.org\/wiki\/([^#?]+)/)){const d=await J(`https://${m[1]}.wikipedia.org/w/api.php?action=query&titles=${m[2]}&prop=pageimages|extracts|pageprops&ppprop=wikibase_item&piprop=thumbnail&pithumbsize=300&exintro=1&explaintext=1&exsentences=3&format=json&origin=*`),p=Object.values(d.query.pages)[0],w=p.pageprops?.wikibase_item?await wdItem(p.pageprops.wikibase_item).catch(()=>null):null;return{title:p.title,poster:p.thumbnail?.source||w?.poster||'',desc:p.extract||w?.desc||'',eps:w?.eps||0,year:w?.year||'',cat:w&&w.cat!=='films'?w.cat:undefined,url:u};}
    if(m=u.match(/apple\.com\/.*?\/id(\d+)/)){const x=(await J(`https://itunes.apple.com/lookup?id=${m[1]}&country=ru`)).results?.[0];if(x)return{title:x.trackName||x.collectionName,poster:(x.artworkUrl100||'').replace('100x100bb','400x600bb'),year:(x.releaseDate||'').slice(0,4),genres:x.primaryGenreName||'',desc:x.longDescription||'',cat:x.kind==='feature-movie'?'films':'series',url:u};}
    if(m=u.match(/anilist\.co\/anime\/(\d+)/)){const x=(await(await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'query($id:Int){Media(id:$id,type:ANIME){title{romaji english} episodes genres seasonYear description(asHtml:false) coverImage{large} averageScore trailer{id site}}}',variables:{id:+m[1]}})})).json()).data.Media;return{title:x.title.english||x.title.romaji,poster:x.coverImage?.large||'',year:x.seasonYear||'',genres:(x.genres||[]).join(', '),desc:(x.description||'').replace(/<[^>]+>/g,'').slice(0,600),score:x.averageScore?+(x.averageScore/10).toFixed(1):'',eps:x.episodes||0,trailer:x.trailer?.site==='youtube'?'https://www.youtube.com/embed/'+x.trailer.id:'',cat:'anime',url:u};}
    if(m=u.match(/kinopoisk\.\w+\/(?:film|series)\/(\d+)/)){const w=await wdByStatement('P2603',m[1]);if(w)return{...w,url:u};}
    if(m=u.match(/imdb\.com\/title\/(tt\d+)/)){const w=await wdByStatement('P345',m[1]);if(w)return{...w,url:u};}
    if(m=u.match(/letterboxd\.com\/film\/([^/]+)/)){const c=await cands(m[1].replace(/-/g,' '),'films');return c[0]?{...c[0],cat:'films',url:u}:null;}
  }catch(e){}
  return null;
}

function onTitle(){
  clearTimeout(sugT);_pick=null;const v=$('inputTitle').value.trim(),box=$('sug');
  if(editingId||v.length<2){box.innerHTML='';return;}
  sugT=setTimeout(async()=>{
    box.textContent='Ищу…';
    const c=/^https?:\/\//.test(v)?await linkCands(v):await cands(v,$('inputCat').value||currentTab);
    if(!c.length){box.textContent=/^https?:/.test(v)?'Для этой ссылки нет открытого API. Введи название':'Ничего не нашлось';return;}
    window._cs=c;box.innerHTML=c.slice(0,6).map((x,k)=>`<div class="pick2" onclick="takePick(${k})"><img src="${esc(x.poster)}"><span>${esc(x.title||'')}${x.year?' · '+x.year:''}</span></div>`).join('');
  },450);
}

function takePick(k){
  const x=window._cs[k];_pick=x;$('inputTitle').value=x.title||$('inputTitle').value;$('fPoster').value=x.poster||'';
  if(!$('fTotal').value&&x.eps)$('fTotal').value=x.eps;if(x.cat)$('inputCat').value=x.cat;if(x.url&&!$('inputLink').value)$('inputLink').value=x.url;
  $('sug').innerHTML='';
}

SRC.ol=async q=>{try{return((await J('https://openlibrary.org/search.json?limit=4&q='+encodeURIComponent(q))).docs||[]).filter(d=>d.cover_i).map(d=>({title:d.title,poster:`https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`,year:d.first_publish_year||'',genres:(d.author_name||[]).slice(0,2).join(', ')}));}catch(e){return[];}};

SRC.shikiM=async(q,k)=>{try{return(await J(`https://shikimori.one/api/${k==='ranobe'?'ranobe':'mangas'}?limit=4&search=${encodeURIComponent(q)}`)).map(x=>({title:x.russian||x.name,poster:x.image?.original?'https://shikimori.one'+x.image.original:'',year:(x.aired_on||'').slice(0,4),score:+x.score||'',eps:x.chapters||0}));}catch(e){return[];}};

async function cands(q,cat){const k=cat==='manga'?'manga':(C.customCats||[]).find(c=>c.id===cat)?.kind;if(k==='books')return(await SRC.ol(q)).filter(x=>x.poster);if(k==='manga'||k==='ranobe')return(await SRC.shikiM(q,k)).filter(x=>x.poster);return candsStd(q,cat);}

async function autoRefresh(){
  const week=6048e5,todo=Object.values(items).filter(i=>sOf(i)!=='done'&&(!i.info||!i.info.upd||Date.now()-i.info.upd>week)).slice(0,6);
  for(const i of todo){const f=await lookup(i),cur=items[i.id];if(!cur)continue;const nz=Object.fromEntries(Object.entries(f).filter(([,v])=>v));
    items[i.id]={...cur,info:{...cur.info,...nz,ts:1,upd:Date.now()},poster:cur.poster||f.poster||'',total:cur.total||f.eps||0};
    try{await upsertItem(items[i.id]);}catch(e){}await new Promise(r=>setTimeout(r,1500));}
  render();
}

/* Данные из Викидаты по номеру в Кинопоиске / IMDb / статье Википедии: русское название, число серий и сезонов, год, постер. Без ключей. */
async function wdItem(qid){
  const d=await J(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=labels|descriptions|claims&languages=ru|en&format=json&origin=*`),e=d.entities&&d.entities[qid];
  if(!e)return null;
  const cl=e.claims||{},val=p=>cl[p]&&cl[p][0]&&cl[p][0].mainsnak&&cl[p][0].mainsnak.datavalue&&cl[p][0].mainsnak.datavalue.value,ids=p=>(cl[p]||[]).map(x=>x.mainsnak&&x.mainsnak.datavalue&&x.mainsnak.datavalue.value&&x.mainsnak.datavalue.value.id).filter(Boolean);
  const num=p=>{const v=val(p);return v&&v.amount?+v.amount:0},eps=num('P1113'),seasons=num('P2437'),img=val('P3383')||val('P18'),date=(val('P577')||{}).time||'';
  const anime=ids('P136').includes('Q1107')||ids('P31').some(x=>['Q63952888','Q100269041'].includes(x));
  return{title:(e.labels.ru||e.labels.en||{}).value||'',desc:(e.descriptions.ru||e.descriptions.en||{}).value||'',eps,seasons,year:date.slice(1,5),
    poster:img?`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(img)}?width=300`:'',
    cat:anime?'anime':(eps||seasons||ids('P31').includes('Q5398426'))?'series':'films'};
}
async function wdByStatement(prop,v){
  const d=await J(`https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent('haswbstatement:'+prop+'='+v)}&format=json&origin=*`),q=d.query&&d.query.search&&d.query.search[0]&&d.query.search[0].title;
  return q?wdItem(q):null;
}
/* Ссылка с точным определением, а если сайт незнакомый, ищем по словам из адреса и даём выбрать */
async function linkCands(u){
  const x=await fromLink(u);if(x)return[x];
  let slug='';try{slug=decodeURIComponent(u.split('?')[0].replace(/\/+$/,'').split('/').pop()||'');}catch(e){}
  slug=slug.replace(/\.\w+$/,'').replace(/^\d+[-_]/,'').replace(/[-_+]+/g,' ').trim();
  return slug.length>2?cands(slug,$('inputCat').value||currentTab):[];
}
