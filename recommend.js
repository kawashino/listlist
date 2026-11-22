/* recommend.js: рекомендации «по вкусу».
   Считает, какие жанры и теги нравятся пользователю (по оценкам >= 6 у просмотренного),
   и поднимает из «Хочу» то, что совпадает с этим профилем. Внешних вызовов нет — только свои данные. */

function tasteProfile() {
  const genres = {}, tags = {};
  Object.values(items).forEach(i => {
    if (sOf(i) !== 'done') return;
    const r = avgR(i), w = r - 5;          // 6 → 1, 10 → 5; ниже 6 не учитываем
    if (!(w > 0)) return;
    String(i.info && i.info.genres || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      .forEach(g => { genres[g] = (genres[g] || 0) + w; });
    String(i.tags || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      .forEach(t => { tags[t] = (tags[t] || 0) + w; });
  });
  return { genres, tags, rated: Object.values(items).filter(i => sOf(i) === 'done' && avgR(i) > 0).length };
}

function tasteScore(i, p) {
  let s = 0;
  const g = String(i.info && i.info.genres || '').toLowerCase();
  const t = String(i.tags || '').toLowerCase();
  for (const k in p.genres) if (g.indexOf(k) >= 0) s += p.genres[k];
  for (const k in p.tags) if (t.indexOf(k) >= 0) s += p.tags[k] * 1.5;   // теги точнее жанра
  return s;
}

function tasteWhy(i, p) {
  const g = String(i.info && i.info.genres || '').toLowerCase();
  const t = String(i.tags || '').toLowerCase();
  const hitG = Object.keys(p.genres).filter(k => g.indexOf(k) >= 0).sort((a, b) => p.genres[b] - p.genres[a])[0];
  const hitT = Object.keys(p.tags).filter(k => t.indexOf(k) >= 0).sort((a, b) => p.tags[b] - p.tags[a])[0];
  if (hitT) return 'по тегу «' + hitT + '»';
  if (hitG) return 'по жанру «' + hitG + '»';
  return '';
}

function drawReco() {
  const box = $('recoBody');
  if (!box) return;
  const p = tasteProfile();

  if (!p.rated) {
    box.innerHTML = '<div class="modal-title">✨ Рекомендации</div>'
      + '<p style="color:var(--text3);font-size:13px">Пока нечего учитывать: оцени хотя бы пару просмотренных карточек (6+), '
      + 'и здесь появится подборка по вкусу.</p>';
    return;
  }

  const want = Object.values(items).filter(i => sOf(i) === 'want' && !i.archived);
  const scored = want.map(i => ({ i, s: tasteScore(i, p) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 8);
  const fresh = want.filter(i => !scored.some(x => x.i.id === i.id)).sort((a, b) => (a.ts || 0) - (b.ts || 0)).slice(0, 3);

  const row = (i, note) => `<div class="br" style="gap:10px;margin:8px 0">
    ${i.poster ? `<img class="poster" style="width:36px;height:50px" src="${esc(i.poster)}" onerror="this.remove()">` : ''}
    <span style="flex:1;width:auto;white-space:normal">
      <span style="cursor:pointer" onclick="openInfo('${i.id}')">${esc(i.title)}</span>
      ${note ? `<small style="color:var(--text3)"> · ${esc(note)}</small>` : ''}
    </span>
    <button class="pp" onclick="setStatus('${i.id}','watching');drawReco()">▶</button>
  </div>`;

  let html = '<div class="modal-title">✨ Рекомендации</div>';
  html += '<p style="color:var(--text3);font-size:12px">Профиль вкуса собран по ' + p.rated + ' оценкам.</p>';

  html += '<div class="cs-title">Подходит по вкусу</div>';
  html += scored.length
    ? scored.map(x => row(x.i, tasteWhy(x.i, p))).join('')
    : '<p style="color:var(--text3);font-size:13px">В «Хочу» нет совпадений с твоими оценками.</p>';

  if (fresh.length) {
    html += '<div class="cs-title" style="margin-top:14px">Давно ждёт в «Хочу»</div>';
    html += fresh.map(i => row(i, 'с ' + new Date(i.ts || Date.now()).toLocaleDateString('ru-RU'))).join('');
  }

  html += '<div class="btn-row"><button class="btn btn-secondary" onclick="$(\'reco\').classList.remove(\'open\')">Закрыть</button>'
    + '<button class="btn btn-primary" onclick="roulette()">🎲 Случайное</button></div>';
  box.innerHTML = html;
}

function showReco() {
  if (!$('reco')) {
    document.body.insertAdjacentHTML('beforeend',
      '<div id="reco" class="overlay" onclick="if(event.target===this)this.classList.remove(\'open\')"><div class="modal" id="recoBody"></div></div>');
  }
  drawReco();
  $('reco').classList.add('open');
}

/* ===== Сборка интерфейса: кнопка в панели над списком ===== */
uiStep(330, () => {
  document.querySelector('.toolbar').insertAdjacentHTML('beforeend',
    '<button class="filter-btn" onclick="showReco()" title="Подборка по твоим оценкам">✨ Рекомендации</button>');
});