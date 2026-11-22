/* config.example.js — шаблон. Скопируй в config.js и подставь свои значения.
   config.js в .gitignore: пароль и ключи не должны попадать в репозиторий. */

window.WL_CONFIG = {
  // Supabase: Project Settings → API
  SUPA_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPA_KEY: 'sb_publishable_...',

  // Пароль: сгенерируй на makehash.html
  // ВАЖНО: после смены соли все ранее выданные хеши и «запомнить меня» станут недействительны
  PW_SALT: 'wl-0123456789abcdef',
  PW_ITER: 150000,
  PW_HASH: 'сгенерированный-хеш'
};