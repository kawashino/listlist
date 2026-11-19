/* main.js: порядок запуска страницы. Подключается последним. */
window.addEventListener('load',()=>{
  buildInterface();
  buildMediaUi();
  buildInfoToolsUi();
  buildSmartUi();
  buildSettingsUi();
  buildLayoutUi();
});
