# План инкрементального рефакторинга listlist

## Задача
Переписать архитектуру с минимальными рисками: всё должно работать, сломанное починить, кастомизацию вынести в единое место, убрать конфликты между модулями.

## Текущее состояние (из кода)
- 12 JS-файлов (`main.js`, `app.js`, `util.js`, `sources.js`, `cards.js`, `details.js`, `tools.js`, `theme.js`, `fx.js`, `layout.js`, `custom.js`, `recommend.js`) + `style.css` + `index.html`
- Всё состояние глобальное: `items`, `currentTab`, `ME`, `C`, `SF`, `SEL`, `_pick` — любой модуль может перезаписать любой другой
- `custom.js` (`CD` defaults), `layout.js` (`UI0`), `style.css` (`:root` vars), `theme.js` (`THEMES`) — дублируют одни и те же настройки и конфликтуют
- `uiStep` система (порядковые номера вставки HTML) — хрупкая, modules вставляются в контейнеры друг друга
- Нет единого источника truth для конфигурации
- Работающие фичи (poster import, fuzzy search, офлайн-очередь, realtime, темы, pill-фильтры) нужно сохранить без регрессий

## Решение
Инкрементальный рефактор: модуль за модулем выносим состояние в локальные переменные, конфигурацию — в `custom.js`, стили — в `style.css`. Каждый шаг коммитится отдельно, откат возможен на любой коммит.

## Последовательность работ

### Шаг 1. Аудит и фиксация текущего поведения (квалификатор)
- Сохранить список всех `window`-глобалов, используемых в коде (`items`, `currentTab`, `ME`, `C`, `SF`, `SEL`, `_pick`, `realtimeChannel`, `STAT`, `isAuthed`, `sbFetch`, `upsertItem`, `patch`, `deleteItemDb`, `extrasOn`, `ST`, `EP`, `genresOf`, `normTitle`, `cleanDesc`, `itemSearchScore`, `fuzzyScore`, `toast`, `ensureMe`, `sOf`, `beep`, `playBeep`, `render`, `renderList`, `openInfo`, `closeModal`, `openModal`, `fillForm`, `saveItem`, `lookup`, `findPoster`, `findInfo`, `fillPosters`, `fromLink`, `onTitle`, `takePick`, `tasteProfile`, `tasteScore`, `uiStep`, `runUiSteps`, `switchCpTab`, `toggleCustom`, `applyUI`, `applyCustom`, `applyBg`, `applyTheme`, `saveTheme`, `renderThemes`, `drawMore`, `drawTabsEd`, `drawViews`, `updFr`, `updColl`, `frProg`, `setFr`, `cycleStatus`, `setStatus`, `toggleDone`, `toggleWant`, `bump`, `togEp`, `setSeason`, `drawGenresEdit`, `drawFranchise`, `infoArchiveButton`, `applyPosterColor`, `posterColor`, `refreshItemInfo`, `stats`, `showToday`, `showStatus`, `statusReport`, `copyStatus`, `exportData`, `doImport`, `switchMe`, `roulette`, `night`, `installApp`, `setBgUrl`, `setBgOpacity`, `setBgZoom`, `setBgSize`, `setBgOverlay`, `toggleBgGrad`, `setBgGradA`, `setBgGradB`, `setBgGradAngle`, `setBlur`, `setCardBg`, `setCardBgOpacity`, `setCardText`, `setCardMeta`, `toggleCardShadow`, `setBorderColor`, `setBorderWidth`, `setBorderOpacity`, `setBorderRadius`, `setHeaderColor`, `setHeaderOpacity`, `setPageBg`, `setAccent`, `setFont`, `setFontSize`, `setTabColor`, `toggleShowStats`, `toggleShowSearch`, `resetIcon`, `resetAllCustom`, `addPreset`, `tabMove`, `tabSet`, `togPar`, `loadVid`, `loadBg`, `loadIcon`, `whSearch`, `fxStart`, `fxSync`, `setFx`, `buildExtraUi`)
- Зафиксировать все UI-вставки через `uiStep` (порядок и целевые контейнеры)
- Зафиксировать все CSS-переменные, которые переопределяются из JS

**Критерий приёма:** полный список глобалов и uiStep-вставок сохранён в план-файле или отдельном файле.

### Шаг 2. Единая конфигурация (custom.js как источник truth)
- Вынести `UI0` из `layout.js` в `custom.js` (в `CD`)
- Удалить `UI0` из `layout.js`, оставить только `U()` чтение из `C.ui`
- Перенести все `r.setProperty('--...', ...)` из `layout.js` в `applyCustom` в `custom.js` (убрать дублирование с `style.css`)
- Унифицировать цветовые переменные: `--cat-*` цвета категорий вынести в `custom.js` + `style.css`
- Убедиться, что `THEMES` в `theme.js` не переопределяет то же, что в `custom.js`

**Критерий приёма:** `grep UI0 layout.js` → пусто; `grep -c setProperty layout.js` → 0; все `--cat-*` определены в одном месте.

### Шаг 3. Локализация состояния в modules (без window)
- Выбрать 1–2 модуля с наименьшей связностью (например, `fx.js` + `recommend.js`)
- Заменить обращение к глобальным переменным на параметры функций и локальное состояние
- Не менять внешний API (имена функций, которые вызываются извне, оставить)

**Критерий приёма:** `fx.js` и `recommend.js` не обращаются к `window.items`, `window.C` напрямую (кроме функций-входных точек).

### Шаг 4. Исправление сломанного (из недавних багов)
- `cards.js:192` `Assignment to constant variable` — `title` и `poster0` в `saveItem` → `let` (уже исправлено, проверить в коммите)
- `cards.js:368` `Cannot read properties of null (reading 'dataset')` — защита `hoverShow` от `null` (уже исправлено, проверить)
- `tools.js` `Cannot read properties of undefined (reading 'toLowerCase')` — защита `e.key` (уже исправлено, проверить)
- `sources.js` `textContent` на `null` в `usage`, `whSearch`, `pickPoster`, `onTitle` (уже исправлено, проверить)

**Критерий приёма:** в консоли браузера нет ошибок `TypeError` при открытии страницы, добавлении карточки, наведении на карточку.

### Шаг 5. Хрупкие места uiStep
- Переименовать магические числа uiStep в именованные константы или комментарии с объяснением, зачем порядок важен
- Добавить защиту: если целевой контейнер не найден (`$('...')` вернул `null`), не падать, а логировать предупреждение

**Критерий приёма:** все `uiStep` вызовы обёрнуты в проверку существования целевого элемента.

### Шаг 6. Визуальные улучшения (уже частично применено, закрепить)
- Цветовая кодировка карточек по категории (левая граница) — закрепить в `style.css`
- Pill-фильтры жанров/тегов — закрепить в `cards.js` + `style.css`
- Двухколоночное окно карточки на десктопе — закрепить в `details.js` + `style.css`
- Авто-цвет из постера — уже через `applyPosterColor`, убедиться что не конфликтует с категорийными цветами

**Критерий приёма:** карточки имеют цветные границы по категориям; фильтры — pills; окно карточки — 2 колонки на宽 экранах.

### Шаг 7. Новые визуальные улучшения (опционально, по выбору)
- Баджи-ленты на постере со статусом
- Прогресс-бар под постером для watching
- Пустые состояния с иллюстрацией
- Скелетон-загрузка карточек

**Критерий приёма:** каждый пункт отдельным коммитом, не ломает существующее.

### Шаг 8. Финальная валидация
- Проверить все сценарии из пользовательских жалоб: очередь не растёт, 400 ошибок нет, постеры подтягиваются, жанры через Wikipedia подтягиваются, перевод убран
- Проверить горячие клавиши (N, /, R, S, F, T, Esc, Enter, пробел, x, стрелки)
- Проверить импорт/экспорт JSON
- Проверить рулетку и "3 варианта на вечер"
- Проверить фильтры pill-кнопки
- Проверить добавление/редактирование/удаление карточки
- Проверить окно карточки (инфо, серии, franchise, 반응ы, комментарии)

## Риски и откат
- Каждый шаг — отдельный коммит. Если что-то сломалось — `git revert <коммит>`.
- Не делать коммитов с изменениями более 2–3 файлов сразу (кроме шага 2 конфигурации, который ограничен `custom.js` + `layout.js`).
- Не менять имена функций, которые вызываются из HTML (`onclick`) — только внутреннюю реализацию.

## Открытые вопросы (решить перед стартом реализации)
1. Сохранить ли текущую структуру файлов или объединить связанные модули? (Рекомендация: сохранить, чтобы не ломать `<script>` порядок в `index.html`)
2. Вводить ли ES-модули (`type="module"`)? (Рекомендация: нет, оставить globals для минимума изменений)
3. Какой порядок приоритета у визуальных улучшений в шаге 6–7? (пользователь уже выбрал: цвета категорий, pill-фильтры, двухколоночное окно карточки — уже применено)

## Файлы плана
- `D:\listlist/.kilo/plans/1795592140000-listlist-refactor.md` — этот план