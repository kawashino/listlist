/* config.example.js — шаблон. Скопируй в config.js и подставь свои значения.
   config.js в .gitignore: пароль и ключи не должны попадать в репозиторий. */

window.WL_CONFIG = {
  // Supabase: Project Settings → API
  SUPA_URL: 'https://dspniootbeoebxefopia.supabase.co',
  SUPA_KEY: 'sb_publishable_XvUI2M2jmfixsE3d_ikJZQ_DXp5WyKY',

  // Пароль: сгенерируй на makehash.html
  // ВАЖНО: после смены соли все ранее выданные хеши и «запомнить меня» станут недействительны
  PW_SALT: 'wl-a00e84dea84412e4',
  PW_ITER: 150000,
  PW_HASH: '1ba1c8fa0387cfc44eea7169dd568f015103279dc32a45c2526acec241e06aad'
};
