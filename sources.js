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

/* ===== ИСТОЧНИКИ =====
   Каждый источник возвращает массив кандидатов с едиными полями:
   title, poster, year, genres (массив), desc, score, eps, trailer, franchise, relations. */
const SRC={
  // Shikimori: у аниме/манги есть поле franchise, у детальной записи — genres, description и related
  async shiki(q,cat){
    const kind=cat==='manga'?'mangas':cat==='ranobe'?'ranobe':'animes';
    for(const h of ['shikimori.one','shikimori.me','shikimori.io']){
      try{
        const a=await J(`https://${h}/api/${kind}?limit=4&search=${encodeURIComponent(q)}`);
        const r=a.map(x=>({id:x.id,title:x.russian||x.name,poster:x.image?.original?`https://${h}${x.image.original}`:'',
          year:(x.aired_on||'').slice(0,4),score:+x.score||'',eps:x.episodes||x.chapters||0,
          genres:[],desc:'',franchise:x.franchise||'',relations:[]}));
        if(a[0]){
          try{
            const d=await J(`https://${h}/api/${kind}/${a[0].id}`);
            r[0].genres=(d.genres||[]).map(g=>g.russian||g.name).filter(Boolean);
            r[0].desc=cleanDesc(d.description);
            r[0].franchise=d.franchise||r[0].franchise||'';
            r[0].relations=(d.related||[]).map(x=>({name:x.russian||x.name||'',relation:'related'}));
            if(!r[0].year)r[0].year=(d.aired_on||'').slice(0,4);
          }catch(e){}
        }
        return r;
      }catch(e){}
    }return[];
  },

  // Jikan: large_image_url вместо image_url; relations подтягиваем для первого кандидата
  async jikan(q){
    try{
      const d=await J('https://api.jikan.moe/v4/anime?limit=4&q='+encodeURIComponent(q));
      const list=(d.data||[]).map(x=>({id:x.mal_id,title:x.title_english||x.title,
        poster:x.images?.jpg?.large_image_url||x.images?.jpg?.image_url||'',
        year:x.year||'',genres:(x.genres||[]).map(g=>g.name),desc:cleanDesc(x.synopsis),
        score:x.score||'',eps:x.episodes||0,trailer:x.trailer?.embed_url||'',relations:[]}));
      if(list[0]){
        try{
          const rel=await J(`https://api.jikan.moe/v4/anime/${list[0].id}/relations`);
          list[0].relations=(rel.data||[]).flatMap(g=>(g.entry||[]).map(e=>({name:e.name||'',relation:g.relation||''})));
        }catch(e){}
      }
      return list;
    }catch(e){return[];}
  },

  // AniList: extraLarge-постер, seasonYear, averageScore (переводим в 10), relations
  async anilist(q,cat){
    const t=(cat==='manga'||cat==='ranobe'||cat==='MANGA')?'MANGA':'ANIME';
    try{
      const r=await fetch('https://graphql.anilist.co',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({query:`query($q:String,$t:MediaType){Page(perPage:4){media(search:$q,type:$t){
          id title{romaji english} coverImage{extraLarge large} description(asHtml:false)
          episodes seasonYear averageScore genres
          relations{edges{relationType node{title{romaji english}}}}
          trailer{id site}
        }}}`,variables:{q,t}})
      });
      const j=await r.json();
      return ((j.data&&j.data.Page&&j.data.Page.media)||[]).map(x=>({
        id:x.id,title:x.title?.english||x.title?.romaji||'',
        poster:x.coverImage?.extraLarge||x.coverImage?.large||'',
        year:x.seasonYear||'',genres:x.genres||[],
        desc:cleanDesc(x.description),score:x.averageScore?+(x.averageScore/10).toFixed(1):'',
        eps:x.episodes||0,
        trailer:x.trailer&&x.trailer.site==='youtube'?'https://www.youtube.com/embed/'+x.trailer.id:'',
        relations:(x.relations&&x.relations.edges||[]).map(e=>({
          name:(e.node&&e.node.title&&(e.node.title.english||e.node.title.romaji))||'',relation:e.relationType||''}))
      }));
    }catch(e){return[];}
  },

  async itunes(q,cat){
    try{
      const m=cat==='series'?'tvShow':'movie',e=cat==='series'?'tvSeason':'movie';
      return ((await J(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=${m}&entity=${e}&country=ru&limit=4`)).results||[])
        .map(x=>({title:x.trackName||x.collectionName,
          poster:(x.artworkUrl100||'').replace('100x100bb','600x600bb'),
          year:(x.releaseDate||'').slice(0,4),genres:x.primaryGenreName?[x.primaryGenreName]:[],
          desc:cleanDesc(x.longDescription||x.shortDescription||'')}));
    }catch(e){return[];}
  },

  async wiki(q,cat){
    const w={anime:'аниме',films:'фильм',series:'сериал',games:'игра'}[cat]||'';
    for(const l of ['ru','en']){
      try{const d=await J(`https://${l}.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=4&gsrsearch=${encodeURIComponent(q+' '+(l==='ru'?w:''))}&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=300&exintro=1&explaintext=1&exsentences=4&format=json&origin=*`);
        const r=Object.values(d.query?.pages||{}).sort((a,b)=>a.index-b.index).map(p=>({title:p.title,poster:p.thumbnail?.source||'',desc:cleanDesc(p.extract),genres:[]})).filter(x=>x.poster);
        if(r.length)return r;}catch(e){}
    }return[];
  }
};

/* ===== ОБЪЕДИНЕНИЕ КАНДИДАТОВ ===== */
const SRC_PRIORITY={shiki:6,shikiM:6,jikan:5,anilist:5,itunes:4,wiki:3,ol:3};

function cleanDesc(s){
  return String(s||'').replace(/<[^>]*>/g,' ').replace(/\[[^\]]*\]/g,' ').replace(/\s+/g,' ').trim();
}

function mergeGenres(lists){
  const out=[],seen=new Set();
  (lists||[]).forEach(list=>(list||[]).forEach(g=>{
    const s=String(g||'').trim();if(!s)return;
    const k=s.toLowerCase();if(seen.has(k))return;
    seen.add(k);out.push(s);
  }));
  return out.slice(0,12);
}

function pickLongestDesc(list){
  return((list||[]).map(c=>cleanDesc(c&&c.desc)).sort((a,b)=>b.length-a.length)[0]||'');
}

// Оценка кандидата: точное название важнее всего, дальше — постер, описание, жанры, рейтинг
function scoreCand(c,q){
  if(!c||!q)return 0;
  let s=SRC_PRIORITY[c._src]||2;
  const t=normTitle(c.title||'');
  if(t&&t===q)s+=40;
  else if(t&&(t.startsWith(q)||q.startsWith(t)))s+=18;
  else if(t&&t.indexOf(q)>=0)s+=10;
  if(c.poster)s+=8;
  if(c.desc)s+=Math.min(12,Math.round(c.desc.length/60));
  if((c.genres||[]).length)s+=4;
  if(c.year)s+=3;
  if(c.score)s+=3;
  return s;
}

// Проверка, что картинка реально открывается: CORS не нужен, хватает naturalWidth
const posterProbe=new Map();
function probeImage(url){
  if(!url)return Promise.resolve(false);
  if(posterProbe.has(url))return Promise.resolve(posterProbe.get(url));
  return new Promise(res=>{
    const im=new Image();let done=false;
    const finish=v=>{if(done)return;done=true;clearTimeout(t);posterProbe.set(url,v);res(v);};
    const t=setTimeout(()=>finish(false),4000);
    im.onload=()=>finish(im.naturalWidth>=50);
    im.onerror=()=>finish(false);
    im.src=url;
  });
}

async function pickPoster(list){
  for(const c of list){if(c&&c.poster&&typeof c.poster==='string'&&c.poster.startsWith('http')&&await probeImage(c.poster))return c.poster;}
  return '';
}

// Франшиза: явное поле источника, иначе самый частый «родственник» (обычно корень серии)
function franchiseFrom(list){
  const explicit=(list||[]).map(x=>x&&x.franchise).filter(Boolean);
  if(explicit.length){
    const c={};explicit.forEach(f=>{const k=f.toLowerCase();c[k]=(c[k]||0)+1;});
    const best=Object.keys(c).sort((a,b)=>c[b]-c[a])[0];
    return explicit.find(f=>f.toLowerCase()===best)||explicit[0];
  }
  const names=[];
  (list||[]).forEach(x=>(x&&x.relations||[]).forEach(r=>{
    if(r&&r.name&&/sequel|prequel|side|spin|alternative|character|summary|full|parent/i.test(r.relation||''))names.push(r.name);
  }));
  if(!names.length)return '';
  const c={};names.forEach(n=>{const k=n.toLowerCase();c[k]=(c[k]||0)+1;});
  const best=Object.keys(c).sort((a,b)=>c[b]-c[a])[0];
  return names.find(n=>n.toLowerCase()===best)||names[0];
}

async function candsStd(q,cat){
  const o=cat==='anime'?['shiki','jikan','anilist','wiki']:cat==='games'?['wiki']:['itunes','wiki'];
  const res=await Promise.allSettled(o.map(k=>SRC[k](q,cat)));
  const out=[];
  res.forEach((r,k)=>{if(r.status==='fulfilled')(r.value||[]).forEach(x=>out.push({...x,_src:o[k]}));});
  return out.filter(x=>x&&x.poster&&x.title);
}

// ===== КЭШ СПРАВОЧНЫХ ДАННЫХ =====
// lookup() дёргает 2–4 внешних API; без кэша одно и то же название ищется заново при каждом открытии формы.
const PCACHE_KEY='wl_pcache',PCACHE_TTL=24*60*60*1000,PCACHE_MAX=400,PCACHE_V='v2|';
function pcacheKey(q,cat){return PCACHE_V+(cat||'')+'|'+normTitle(q);}
function pcacheAll(){try{return JSON.parse(localStorage.getItem(PCACHE_KEY)||'{}');}catch(e){return {};}}
function pcacheGet(q,cat){
  const e=pcacheAll()[pcacheKey(q,cat)];
  return e&&Date.now()-e.ts<PCACHE_TTL?e.v:null;
}
function pcacheSet(q,cat,v){
  const c=pcacheAll(),k=pcacheKey(q,cat);
  c[k]={ts:Date.now(),v};
  const keys=Object.keys(c);
  if(keys.length>PCACHE_MAX)keys.slice(0,keys.length-PCACHE_MAX).forEach(x=>delete c[x]);
  try{localStorage.setItem(PCACHE_KEY,JSON.stringify(c));}catch(e){}
}

async function lookup(i){
  const hit=pcacheGet(i.title,i.cat);
  if(hit)return hit;

  const q=normTitle(i.title);
  const raw=await cands(i.title,i.cat);
  const ranked=raw.map(c=>({c,s:scoreCand(c,q)})).sort((a,b)=>b.s-a.s);
  const top=ranked.slice(0,3).map(x=>x.c);
  const first=ranked.length?ranked[0].c:{};

  const out={
    ts:1,
    poster:await pickPoster(top),
    year:first.year||'',
    genres:mergeGenres(top.map(c=>c.genres||[])),
    desc:pickLongestDesc(top),
    score:first.score||'',
    eps:Math.max(0,...top.map(c=>+c.eps||0)),
    trailer:top.map(c=>c.trailer).find(Boolean)||'',
    franchise:franchiseFrom(raw),
    upd:Date.now()
  };
  pcacheSet(i.title,i.cat,out);
  return out;
}

async function findPoster(q,cat){return(await lookup({title:q,cat})).poster;}

async function findInfo(i){return lookup(i);}

// Дозаполняет всё, чего не хватает: постер, описание, жанры, франшизу, число серий
async function fillPosters(){
  const need=i=>!i.poster||!i.info||!i.info.ts||!cleanDesc(i.info.desc)||!genresOf(i).length||!i.franchise;
  const todo=Object.values(items).filter(need);
  if(!todo.length){toast('Всё уже заполнено');return;}
  let n=0,ok=0;toast('Дозаполняю данные…');
  for(const i of todo){
    const cur=items[i.id];if(!cur)continue;
    try{
      const f=await lookup(cur);n++;
      const nz=Object.fromEntries(Object.entries(f).filter(([,v])=>v!==''&&v!=null&&!(Array.isArray(v)&&!v.length)));
      const info={...(cur.info||{}),...nz,ts:1};
      items[i.id]={...cur,poster:cur.poster||nz.poster||'',franchise:cur.franchise||nz.franchise||'',total:cur.total||nz.eps||0,info};
      if(nz.poster||nz.desc||nz.genres)ok++;
      try{await upsertItem(items[i.id]);}catch(e){}
    }catch(e){console.warn('fillPosters failed for',i.id,e);}
    if(n%4===0){try{render();}catch(e){}toast(`Дозаполнено: ${ok} из ${n} (всего ${todo.length})`);}
    await new Promise(r=>setTimeout(r,600));
  }
  try{render();}catch(e){}
  toast(`Готово: обновлено ${ok} из ${n}`);
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
    if(c.length===1&&c[0].exact){window._cs=c;takePick(0);toast('Распознано: '+c[0].title);return;}
    window._cs=c;box.innerHTML=c.slice(0,6).map((x,k)=>`<div class="pick2" onclick="takePick(${k})"><img src="${esc(x.poster)}"><span>${esc(x.title||'')}${x.year?' · '+x.year:''}</span></div>`).join('');
  },450);
}

function takePick(k){
  const x=window._cs[k];_pick=x;$('inputTitle').value=x.title||$('inputTitle').value;$('fPoster').value=x.poster||'';
  if(!$('fTotal').value&&x.eps)$('fTotal').value=x.eps;
  if(x.cat)$('inputCat').value=x.cat;
  if(x.url&&!$('inputLink').value)$('inputLink').value=x.url;
  // франшизу подставляем только если поле пустое: ручное значение важнее
  const fr=$('fFr');
  if(fr&&!fr.value.trim()&&x.franchise)fr.value=x.franchise;
  $('sug').innerHTML='';
}

SRC.ol=async q=>{try{return((await J('https://openlibrary.org/search.json?limit=4&q='+encodeURIComponent(q))).docs||[]).filter(d=>d.cover_i).map(d=>({title:d.title,poster:`https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`,year:d.first_publish_year||'',genres:(d.author_name||[]).slice(0,2),desc:'',eps:0}));}catch(e){return[];}};

SRC.shikiM=async(q,k)=>{try{return(await J(`https://shikimori.one/api/${k==='ranobe'?'ranobe':'mangas'}?limit=4&search=${encodeURIComponent(q)}`)).map(x=>({title:x.russian||x.name,poster:x.image?.original?'https://shikimori.one'+x.image.original:'',year:(x.aired_on||'').slice(0,4),score:+x.score||'',eps:x.chapters||0,genres:[],desc:'',franchise:x.franchise||''}));}catch(e){return[];}};

async function cands(q,cat){
  const k=cat==='manga'?'manga':(C.customCats||[]).find(c=>c.id===cat)?.kind;
  if(k==='books')return(await SRC.ol(q)).filter(x=>x&&x.poster&&typeof x.poster==='string'&&x.poster.startsWith('http')).map(x=>({...x,_src:'ol'}));
  if(k==='manga'||k==='ranobe'){
    const src=[['shikiM',SRC.shikiM],['shiki',SRC.shiki],['anilist',SRC.anilist]];
    const res=await Promise.allSettled(src.map(([,fn])=>fn(q,k)));
    const out=[];
    res.forEach((r,i)=>{if(r.status==='fulfilled')(r.value||[]).forEach(x=>out.push({...x,_src:src[i][0]}));});
    return out.filter(x=>x.poster);
  }
  return candsStd(q,cat);
}

async function autoRefresh(){
  const week=6048e5,todo=Object.values(items).filter(i=>sOf(i)!=='done'&&(!i.info||!i.info.upd||Date.now()-i.info.upd>week)).slice(0,6);
  for(const i of todo){
    try{const f=await lookup(i),cur=items[i.id];if(!cur)continue;
      const nz=Object.fromEntries(Object.entries(f).filter(([,v])=>v!==''&&v!=null&&!(Array.isArray(v)&&!v.length)));
      items[i.id]={...cur,info:{...cur.info,...nz,ts:1,upd:Date.now()},poster:cur.poster||f.poster||'',franchise:cur.franchise||f.franchise||'',total:cur.total||f.eps||0};
      try{await upsertItem(items[i.id]);}catch(e){}}catch(e){console.warn('autoRefresh failed for',i.id,e);}
    await new Promise(r=>setTimeout(r,1500));}
  try{render();}catch(e){}
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
  const x=await fromLink(u);if(x){x.exact=true;return[x];}
  let slug='';try{slug=decodeURIComponent(u.split('?')[0].replace(/\/+$/,'').split('/').pop()||'');}catch(e){}
  slug=slug.replace(/\.\w+$/,'').replace(/^\d+[-_]/,'').replace(/[-_+]+/g,' ').trim();
  return slug.length>2?cands(slug,$('inputCat').value||currentTab):[];
}

/* ===== Название-ссылка: превращаем в настоящее название и подтягиваем описание ===== */
const isUrl=s=>/^https?:\/\/\S+$/.test((s||'').trim());
function slugTitle(u){   // читаемое название из адреса, если распознать не удалось
  let s='';try{s=decodeURIComponent(u.split('?')[0].replace(/\/+$/,'').split('/').pop()||'');}catch(e){}
  s=s.replace(/\.\w+$/,'').replace(/^\d+[-_]/,'').replace(/[-_+]+/g,' ').trim();
  if(s.length<3){try{s=new URL(u).hostname.replace(/^www\./,'');}catch(e){s=u;}}
  return s;
}
async function resolveTitleLink(){   // вызывается перед сохранением карточки из формы
  const v=$('inputTitle').value.trim();if(!isUrl(v)||_pick)return;
  if(!$('inputLink').value)$('inputLink').value=v;
  const c=await linkCands(v);
  if(c.length){window._cs=c;takePick(0);}
  if(isUrl($('inputTitle').value))$('inputTitle').value=slugTitle(v);
}
async function repairLinkTitles(){   // уже сохранённые карточки, где вместо названия осталась ссылка
  const bad=Object.values(items).filter(i=>isUrl(i.title)).slice(0,5);
  for(const i of bad){
    const c=(await linkCands(i.title))[0],cur=items[i.id];if(!cur)continue;
    items[i.id]={...cur,link:cur.link||i.title,title:(c&&c.title)||slugTitle(i.title),poster:cur.poster||(c&&c.poster)||'',cat:(c&&c.cat)||cur.cat,total:cur.total||(c&&c.eps)||0,
      franchise:cur.franchise||(c&&c.franchise)||'',
      info:c?{ts:1,year:c.year||'',genres:c.genres||[],desc:c.desc||'',score:c.score||'',trailer:c.trailer||''}:cur.info};
    try{await upsertItem(items[i.id]);}catch(e){}
  }
  if(bad.length){render();toast('Исправлены названия-ссылки: '+bad.length);}
}

/* ===== Сборка интерфейса этого модуля: шаги выполняются в порядке номеров (uiStep, см. util.js), номера хранят исходный порядок вставки элементов ===== */
uiStep(190, () => {
$('fPoster').insertAdjacentHTML('afterend','<button type="button" class="upload-btn" style="margin-top:6px" onclick="$(\'fPosterFile\').click()">📁 Загрузить с устройства</button><input type="file" id="fPosterFile" accept="image/*" onchange="upPoster(this)">');
});
