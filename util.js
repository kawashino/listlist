/* util.js: Общие мелочи: статусы, текущий пользователь, помощники. */

const ST={want:'🕒 Хочу',watching:'▶️ Смотрю',done:'✅ Посмотрел',dropped:'❌ Брошено',later:'⏸ Отложено'};

const EP=['anime','series','manga'];

let ME=localStorage.getItem('wl_me')||'',curStatus='all';

const FX=()=>C.fx||(C.fx={type:'none',n:60,speed:1,trail:false,sound:false});

const sOf=i=>i.status||(i.done?'done':'want');

const $=id=>document.getElementById(id);

function ensureMe(){if(!ME){ME=(prompt('Как тебя зовут? (для оценок и пометки «кто добавил»)')||'').trim()||'Я';localStorage.setItem('wl_me',ME);}}

function toast(msg,undo){
  const t=$('toast');t.innerHTML=`<span>${esc(msg)}</span>${undo?'<button>Отменить</button>':''}`;t.classList.add('show');
  if(undo)t.querySelector('button').onclick=()=>{undo();t.classList.remove('show');};
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),6000);
}
