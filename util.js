/* util.js: Общие мелочи: статусы, текущий пользователь, помощники. */

const ST={want:'🕒 Хочу',watching:'▶️ Смотрю',done:'✅ Посмотрел',dropped:'❌ Брошено',later:'⏸ Отложено'};

const EP=['anime','series','manga'];

let ME=localStorage.getItem('wl_me')||'',curStatus='all';

const FX=()=>C.fx||(C.fx={type:'none',n:60,speed:1,trail:false,sound:false});

const sOf=i=>i.status||(i.done?'done':'want');

const $=id=>document.getElementById(id);

function ensureMe(){if(!ME){ME=(prompt('Как тебя зовут? (для оценок и пометки «кто добавил»)')||'').trim()||'Я';localStorage.setItem('wl_me',ME);}}

/* ===== ПОИСК =====
   fuzzyScore: 0 — не подходит, 1 — по подстроке, 2 — по подстроке в начале слова,
   >2 — по подпоследовательности: «атк» найдёт «Атака титанов».
   Порядок символов сохраняется, поэтому «naruto» находится в «Naruto Shippuuden». */
function fuzzyScore(q, text) {
  q = String(q || '').toLowerCase().trim();
  if (!q) return 1;
  const t = String(text || '').toLowerCase();
  if (!t) return 0;
  const at = t.indexOf(q);
  if (at === 0) return 3;
  if (at > 0) return t[at - 1] === ' ' ? 2 : 1;
  if (q.length < 3) return 0;   // короткий запрос вроде «на» иначе совпал бы почти со всем

  let qi = 0, streak = 0, score = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) { qi++; streak++; score += streak; } else streak = 0;
  }
  return qi === q.length ? score / (q.length * 2) : 0;
}

// Ищем по названию, заметке, тегам, жанрам и коллекции: так «хоррор» находит карточки по жанру
function itemSearchScore(query, i) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return 1;
  const title = String(i.title || '').toLowerCase();
  const fields = [title, String(i.note || ''), String(i.tags || ''), genresOf(i).join(' ').toLowerCase(), String(i.coll || '')];
  let best = fuzzyScore(q, title) * 2;   // совпадение в названии важнее
  for (let k = 1; k < fields.length; k++) best = Math.max(best, fuzzyScore(q, fields[k]));
  return best;
}

/* ===== ЖАНРЫ =====
   Раньше info.genres был строкой через запятую. Теперь источники отдают массив,
   а старые записи в базе — строку. genresOf() скрывает эту разницу. */
function genresOf(i) {
  const g = i && i.info && i.info.genres;
  if (Array.isArray(g)) return g.map(x => String(x || '').trim()).filter(Boolean);
  return String(g || '').split(',').map(s => s.trim()).filter(Boolean);
}

// жанры одной строкой — для поиска, фильтров и подписей
function genresText(i) { return genresOf(i).join(', '); }

function normTitle(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function toast(msg,undo){
  const t=$('toast');if(!t)return;
  t.innerHTML=`<span>${esc(msg)}</span>${undo?'<button>Отменить</button>':''}`;t.classList.add('show');
  if(undo)t.querySelector('button').onclick=()=>{undo();t.classList.remove('show');};
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),6000);
}

/* Шаги сборки интерфейса: каждый модуль регистрирует свои вставки в страницу (поля, кнопки, панели) через uiStep(номер, функция).
   Номер задаёт порядок запуска: он важен там, где несколько модулей вставляют элементы в одно место (например, кнопки в панель над списком). */
const UI_STEPS=[];
function uiStep(order,fn){UI_STEPS.push([order,fn]);}
function runUiSteps(){
  UI_STEPS.sort((a,b)=>a[0]-b[0]).forEach(([order,fn])=>{
    try{fn();}catch(e){console.warn('uiStep '+order+' failed:',e.message||e);}
  });
}
