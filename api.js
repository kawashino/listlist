// ===== API СЛОЙ: Supabase REST, офлайн-очередь, реалтайм-синхронизация =====
// Вынесено из app.js для отделения сетевого слоя от UI-логики.

const CFG = window.WL_CONFIG || {};
const SUPA_URL = CFG.SUPA_URL || '';
const SUPA_KEY = CFG.SUPA_KEY || '';

const PW_SALT = CFG.PW_SALT || '';
const PW_ITER = CFG.PW_ITER || 150000;
const PW_HASH = CFG.PW_HASH || '';

function configReady() { return !!(SUPA_URL && SUPA_KEY && PW_SALT && PW_HASH); }
function configMissing() { return !configReady(); }

async function hashPw(pw) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(PW_SALT), iterations: PW_ITER, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function isAuthed() {
  const saved = localStorage.getItem('wl_auth') || sessionStorage.getItem('wl_auth');
  return saved === PW_HASH;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// sbFetch с AbortController (таймаут 15 с) и повторными попытками на 429/5xx
async function sbFetch(path, opts = {}) {
  const { __noRetry, ...rest } = opts;
  const limit = __noRetry ? 1 : 3;
  let lastErr;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  for (let attempt = 0; attempt < limit; attempt++) {
    try {
      const res = await fetch(`${SUPA_URL}/rest/v1${path}`, {
        ...rest,
        signal: controller.signal,
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': `Bearer ${SUPA_KEY}`,
          'Content-Type': 'application/json',
          ...(rest.headers || {})
        }
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`сервер вернул ${res.status}`);
        lastErr.status = res.status;
        if (attempt < limit - 1) { await sleep(600 * Math.pow(2, attempt)); continue; }
        throw lastErr;
      }
      if (!res.ok) {
        const err = await res.text();
        const e = new Error(`${res.status}: ${err}`);
        e.status = res.status;
        throw e;
      }
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (e) {
      clearTimeout(timeout);
      lastErr = e;
      if (e.name === 'AbortError') throw e;
      if (e.status && e.status < 500 && e.status !== 429) throw e;
      if (attempt < limit - 1) { await sleep(600 * Math.pow(2, attempt)); continue; }
      throw e;
    }
  }
  clearTimeout(timeout);
  throw lastErr || new Error('запрос не удался');
}

// ===== ОФЛАЙН-ОЧЕРЕДЬ ПИСАТЕЛЕЙ =====
const OUTBOX_KEY = 'wl_outbox';
function outboxRead() { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch (e) { return []; } }
function outboxSave(q) { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(q)); } catch (e) {} }
function outboxAdd(op) {
  const q = outboxRead();
  q.push({ ...op, ts: Date.now(), _q: (op._q || 0) + 1 });
  const last = q[q.length - 1];
  if (last.method === 'PATCH' || last.method === 'POST') {
    const i = q.findIndex((x, k) => k < q.length - 1 && x.path === last.path && x.method === last.method);
    if (i >= 0) q.splice(i, 1);
  }
  outboxSave(q);
  setSyncState('error', `нет связи · в очереди ${q.length}`);
}
let outboxBusy = false;
async function outboxFlush() {
  if (outboxBusy) return;
  const q = outboxRead();
  if (!q.length) return;
  outboxBusy = true;
  const rest = [];
  for (const op of q) {
    try { await sbFetch(op.path, { method: op.method, headers: op.headers, body: op.body, __noRetry: true }); }
    catch (e) { rest.push(op); }
  }
  outboxSave(rest);
  outboxBusy = false;
  if (!rest.length) { setSyncState('live', 'онлайн'); render(); }
  else setSyncState('error', `в очереди ${rest.length}`);
}
addEventListener('online', outboxFlush);
setTimeout(outboxFlush, 4000);

// ===== ЛОКАЛЬНОЕ СОСТОЯНИЕ КАРТОЧЕК (SNAP) =====
const SNAP = {};
let isLoading = true;

async function loadAllItems() {
  try {
    const rows = await Promise.race([sbFetch('/items?select=*&order=ts.desc'), new Promise((_, no) => setTimeout(() => no(new Error('сервер не отвечает')), 12000))]);
    items = {};
    (rows || []).forEach(r => { items[r.id] = r; });
    await loadExtras();
    STAT.fetch = Date.now();
    localStorage.setItem('wl_cache', JSON.stringify(items));
  } catch(e) {
    const c = localStorage.getItem('wl_cache');
    if (!c) throw e;
    items = JSON.parse(c);
    setSyncState('error', 'офлайн');
  } finally {
    isLoading = false;
  }
  Object.values(items).forEach(i => SNAP[i.id] = JSON.stringify(i));
}

async function upsertItem(item) {
  lastLocalWrite = Date.now();
  let body = item;
  if (extrasOn) { body = { ...item }; XKEYS.forEach(k => delete body[k]); }
  const old = SNAP[item.id] ? JSON.parse(SNAP[item.id]) : null;
  const d = old ? diffBody(old, body) : body;
  if (old && !Object.keys(d).length) return;
  try {
    if (!old) {
      await sbFetch('/items', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(d)
      });
    } else {
      await sbFetch('/items?id=eq.' + encodeURIComponent(item.id), { method: 'PATCH', body: JSON.stringify(d) });
    }
  } catch (e) {
    outboxAdd(old
      ? { path: '/items?id=eq.' + encodeURIComponent(item.id), method: 'PATCH', body: JSON.stringify(d) }
      : { path: '/items', method: 'POST', headers: { 'Prefer': 'resolution=merge-duplicates' }, body: JSON.stringify(d) });
  }
  SNAP[item.id] = JSON.stringify(body);
}

function diffBody(old, body) {
  const d = {};
  for (const k in body) if (JSON.stringify(body[k]) !== JSON.stringify(old[k])) d[k] = body[k];
  return d;
}

async function deleteItemDb(id) {
  lastLocalWrite = Date.now();
  try {
    await sbFetch(`/items?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (e) {
    outboxAdd({ path: `/items?id=eq.${encodeURIComponent(id)}`, method: 'DELETE' });
  }
  delete SNAP[id];
}

// ===== КОММЕНТАРИИ, РЕАКЦИИ, «ХОЧУ» =====
let extrasOn = false;
const XKEYS = ['wants', 'reacts', 'comments'];
const XTABLES = ['items', 'item_wants', 'item_reacts', 'item_comments'];
async function xtAdd(table, row) { await sbFetch('/' + table, { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify(row) }); }
async function xtDel(table, q) { await sbFetch('/' + table + '?' + q, { method: 'DELETE' }); }
async function loadExtras() {
  try {
    const [w, r, c] = await Promise.all([sbFetch('/item_wants?select=*'), sbFetch('/item_reacts?select=*'), sbFetch('/item_comments?select=*&order=ts.asc')]);
    extrasOn = true;
    Object.values(items).forEach(i => { i.wants = {}; i.reacts = {}; i.comments = []; });
    (w || []).forEach(x => { const i = items[x.item_id]; if (i) i.wants[x.author] = 1; });
    (r || []).forEach(x => { const i = items[x.item_id]; if (i) (i.reacts[x.emoji] = i.reacts[x.emoji] || []).push(x.author); });
    (c || []).forEach(x => { const i = items[x.item_id]; if (i) i.comments.push({ by: x.author, text: x.body, ts: x.ts, id: x.id }); });
  } catch (e) { extrasOn = false; }
}
function applyRemoteExtra(table, type, rec, old) {
  const r = (type === 'DELETE' ? old : rec) || {}, i = items[r.item_id]; if (!i) return;
  if (table === 'item_wants') { i.wants = { ...(i.wants || {}) }; if (type === 'DELETE') delete i.wants[r.author]; else i.wants[r.author] = 1; }
  else if (table === 'item_reacts') { i.reacts = { ...(i.reacts || {}) }; const a = new Set(i.reacts[r.emoji] || []); if (type === 'DELETE') a.delete(r.author); else a.add(r.author); i.reacts[r.emoji] = [...a]; }
  else if (table === 'item_comments') { i.comments = (i.comments || []).filter(c => c.id !== r.id); if (type !== 'DELETE') i.comments.push({ by: r.author, text: r.body, ts: r.ts, id: r.id }); i.comments.sort((a, b) => a.ts - b.ts); }
  render();
}

// ===== REALTIME =====
let lastLocalWrite = 0, rtTimer = null, rtRetry = 0;
function applyRemote(type, rec, old) {
  if (type === 'DELETE') { const id = (old && old.id) || (rec && rec.id); if (id) { delete items[id]; delete SNAP[id]; } }
  else if (rec && rec.id) { const p = items[rec.id] || {}; items[rec.id] = extrasOn ? { ...rec, wants: p.wants || {}, reacts: p.reacts || {}, comments: p.comments || [] } : rec; SNAP[rec.id] = JSON.stringify(rec); }
  render();
}
function startRealtime() {
  if (realtimeChannel) return;
  if (!SUPA_URL || !SUPA_KEY) return;
  const ws = new WebSocket(SUPA_URL.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + SUPA_KEY + '&vsn=1.0.0');
  ws.onopen = () => {
    rtRetry = 0;
    ws.send(JSON.stringify({ topic: 'realtime:items-sync', event: 'phx_join', ref: '1', join_ref: '1',
      payload: { config: { broadcast: { ack: false, self: false }, presence: { key: '' }, postgres_changes: XTABLES.map(t => ({ event: '*', schema: 'public', table: t })), private: false }, access_token: SUPA_KEY } }));
    clearInterval(rtTimer);
    rtTimer = setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(Date.now()) })); }, 25000);
  };
  ws.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      if (m.event === 'phx_reply' && m.topic === 'realtime:items-sync') {
        if (m.payload && m.payload.status === 'ok') { STAT.rt = 'подключено'; setSyncState('live', 'онлайн'); }
        else setSyncState('error', 'realtime: ' + ((m.payload && m.payload.response && m.payload.response.reason) || 'ошибка'));
      } else if (m.event === 'postgres_changes') {
        const d = m.payload && m.payload.data;
        if (d) { STAT.rtAt = Date.now(); if (d.table && d.table !== 'items') applyRemoteExtra(d.table, d.type, d.record, d.old_record); else applyRemote(d.type, d.record, d.old_record); }
      }
    } catch (err) {}
  };
  ws.onerror = () => { STAT.rt = 'ошибка'; setSyncState('error', 'ошибка соединения'); };
  ws.onclose = () => {
    STAT.rt = 'переподключение'; realtimeChannel = null; clearInterval(rtTimer);
    const delay = Math.min(30000, 1000 * Math.pow(2, rtRetry++));
    setTimeout(startRealtime, delay + Math.random() * 400);
  };
  realtimeChannel = ws;
}

// Запасной путь, если realtime не включён или соединение молчит
async function refreshItems() {
  if (Date.now() - lastLocalWrite < 5000) return;
  try {
    const rows = await sbFetch('/items?select=*&order=ts.desc');
    items = {}; (rows || []).forEach(r => { items[r.id] = r; SNAP[r.id] = JSON.stringify(r); });
    await loadExtras(); STAT.fetch = Date.now();
    try { localStorage.setItem('wl_cache', JSON.stringify(items)); } catch (e) {}
    render();
  } catch (e) {}
  finally {
    isLoading = false;
  }
}
setInterval(() => { if (!document.hidden && typeof authedNow === 'function' && authedNow()) refreshItems(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && typeof authedNow === 'function' && authedNow()) refreshItems(); });
addEventListener('online', () => { if (typeof authedNow === 'function' && authedNow()) refreshItems(); });

function setSyncState(s,l) { const d=document.getElementById('syncDot'),lb=document.getElementById('syncLabel'); if(d)d.className='sync-dot '+s; if(lb)lb.textContent=l; }
