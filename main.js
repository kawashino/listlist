/* main.js: порядок запуска страницы. Подключается последним. */
// связь ядра (app.js, custom.js) с модулями: ядро только объявляет события, подписки собраны здесь
on('beforeInit', ensureMe);
on('itemsLoaded', migrateManga);
on('afterInit', () => {
  if ($('meName')) $('meName').textContent = ME;
  pullTheme();                          // оформление из облака
  setTimeout(autoRefresh, 6000);        // фоновое обновление данных карточек
  setTimeout(() => usage(true), 9000);  // предупреждение о заполнении хранилища
  handleShare();                        // ссылка, присланная через «Поделиться»
  setTimeout(repairLinkTitles, 3000);   // карточки, где вместо названия осталась ссылка
});
let _pushT;
on('customSaved', () => { clearTimeout(_pushT); _pushT = setTimeout(pushTheme, 1500); });  // копия оформления в облако
on('customApplied', applyUI);
on('panelOpen', drawMore);

window.addEventListener('load',()=>{
  runUiSteps();   // вставка полей, кнопок и панелей: шаги лежат в модулях, порядок задают их номера
});

// ===== ЦЕНТРАЛИЗОВАННЫЙ ОБРАБОТЧИК ОШИБОК =====
// Ловит ошибки, которые терялись в пустых catch-блоках по всем модулям.
// Показывает toast вместо молчаливого падения, не прерывая работу приложения.
window.addEventListener('unhandledrejection', e => {
  const msg = e.reason?.message || String(e.reason || '').slice(0, 120);
  console.error('Unhandled rejection:', msg);
  toast('Ошибка: ' + msg);
  e.preventDefault();
});
window.addEventListener('error', e => {
  const msg = e.message || String(e || '').slice(0, 120);
  console.error('Script error:', e.filename, e.lineno, msg);
  toast('Ошибка скрипта: ' + msg);
});
