import * as D from './data.js';
import { createSupabaseBackend, createDemoBackend } from './backend.js';
import * as C from './crypto.js';

// ================================================================
//  Helfer
// ================================================================
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ds = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ds(new Date());
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ds(d); };
const weekStart = s => { const d = parseD(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return ds(d); };
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const fmtDay = s => parseD(s).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtNum = n => Number(n || 0).toLocaleString('de-DE', { maximumFractionDigits: 1 });

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}
const pick = (arr, seed) => arr[hashSeed(seed) % arr.length];

function timeAgo(iso) {
  const t = new Date(iso), diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  const hm = `${pad(t.getHours())}:${pad(t.getMinutes())}`;
  if (ds(t) === today()) return `heute ${hm}`;
  if (ds(t) === addDays(today(), -1)) return `gestern ${hm}`;
  return `${t.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} ${hm}`;
}

const POINTS = { daily: 15, habit: 10, workout: 25, log: 5, custom: 5, joker: 0 };
const LEVEL_XP = 150;

// ================================================================
//  Zustand
// ================================================================
const S = {
  user: null, me: null, partner: null, couple: null, profiles: [],
  completions: [], custom_challenges: [], rewards: [], nudges: [], shopping_items: [], weights: [],
  tab: localStorage.getItem('duo-tab') || 'heute',
  screen: 'loading', authMode: 'login', recipeFilter: 'all', loaded: false,
};
let api;
let renderPending = false;

// ================================================================
//  Challenges & Berechnungen
// ================================================================
const coupleStart = () => ds(new Date(S.couple.created_at));
const levelAt = (date = today()) => Math.min(8, 1 + Math.floor(Math.max(0, daysBetween(coupleStart(), date)) / 14));
const diffMul = () => ({ leicht: 0.8, normal: 1, stark: 1.25 })[S.couple.settings.difficulty || 'normal'] || 1;
const factor = (date) => (1 + 0.15 * (levelAt(date) - 1)) * diffMul();

function scaleAmount(base, unit, date) {
  const v = base * factor(date);
  return unit === 'sec' ? Math.max(5, Math.round(v / 5) * 5) : Math.max(1, Math.round(v));
}
function niceTarget(base, date) {
  const v = base * factor(date);
  if (v >= 100) return Math.round(v / 25) * 25;
  if (v >= 20) return Math.round(v / 5) * 5;
  return Math.max(1, Math.round(v));
}

function dailyChallenge(date = today()) {
  const pool = D.DAILY_POOL;
  let k = pick(pool, S.couple.id + '|d|' + date);
  if (k === pick(pool, S.couple.id + '|d|' + addDays(date, -1))) k = pool[(pool.indexOf(k) + 1) % pool.length];
  const ex = D.EXERCISES[k];
  const per = scaleAmount(ex.base, ex.unit, date), sets = 3;
  const unitTxt = ex.unit === 'sec' ? ' Sek.' : '';
  return { key: k, ex, per, sets, amount: per * sets, title: `${sets} × ${per}${unitTxt} ${ex.name}` };
}
const dailyHabit = (date = today()) => pick(D.HABITS, S.couple.id + '|h|' + date);

function weeklyGoal(wk) {
  const g = pick(D.WEEKLY_GOALS, S.couple.id + '|g|' + wk);
  const target = niceTarget(g.base, wk);
  return { ...g, target, title: g.title.replace('{t}', fmtNum(target)) };
}
function weeklyDuel(wk) {
  const goal = pick(D.WEEKLY_GOALS, S.couple.id + '|g|' + wk);
  let d = pick(D.DUELS, S.couple.id + '|v|' + wk);
  if (d.id === goal.id) d = D.DUELS[(D.DUELS.indexOf(d) + 1) % D.DUELS.length];
  return d;
}

const rowsInWeek = (wk) => { const end = addDays(wk, 6); return S.completions.filter(r => r.date >= wk && r.date <= end); };

function metricValue(m, rows) {
  if (m === 'activeDays') return new Set(rows.filter(r => r.kind !== 'joker').map(r => r.user_id + '|' + r.date)).size;
  if (m.count) return rows.filter(r => m.count.includes(r.kind)).length;
  if (m.sum) return rows.filter(r => (r.kind === 'daily' || r.kind === 'log') && m.sum.includes(r.key))
    .reduce((a, r) => a + Number(r.amount || 0), 0);
  return 0;
}

function activeDates(uid) {
  return new Set(S.completions.filter(r => r.user_id === uid).map(r => r.date));
}
function currentStreak(set) {
  let d = today(); if (!set.has(d)) d = addDays(d, -1);
  let n = 0; while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
function maxStreak(set) {
  const arr = [...set].sort(); let best = 0, run = 0, prev = null;
  for (const d of arr) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}
const intersect = (a, b) => new Set([...a].filter(x => b.has(x)));

function weeksSinceStart() {
  const out = []; const cur = weekStart(today());
  for (let w = weekStart(coupleStart()); w <= cur; w = addDays(w, 7)) out.push(w);
  return out;
}

function weekResults() {
  const ids = [S.me?.id, S.partner?.id];
  return weeksSinceStart().map(wk => {
    const rows = rowsInWeek(wk);
    const goal = weeklyGoal(wk), duel = weeklyDuel(wk);
    const goalVal = metricValue(goal.metric, rows);
    const vals = ids.map(id => id ? metricValue(duel.metric, rows.filter(r => r.user_id === id)) : 0);
    const finished = addDays(wk, 6) < today();
    let winner = null;
    if (finished && S.partner) winner = vals[0] > vals[1] ? S.me.id : vals[1] > vals[0] ? S.partner.id : 'tie';
    return { wk, goal, goalVal, goalDone: goalVal >= goal.target, duel, vals, finished, winner };
  });
}

// Punkte, Level, Statistiken pro Person
function computeStats() {
  const users = [S.me, S.partner].filter(Boolean);
  const weeks = weekResults();
  const out = {};
  const dailyDates = {};
  for (const u of users) dailyDates[u.id] = new Set(S.completions.filter(r => r.user_id === u.id && r.kind === 'daily').map(r => r.date));
  for (const u of users) {
    const own = S.completions.filter(r => r.user_id === u.id);
    let xp = 0; const logPerDay = {};
    for (const r of own) {
      if (r.kind === 'log') { const k = r.date; logPerDay[k] = (logPerDay[k] || 0) + r.points; if (logPerDay[k] > 20) continue; }
      xp += r.points || 0;
    }
    let teamDays = 0;
    if (S.partner) { const other = users.find(x => x.id !== u.id); teamDays = intersect(dailyDates[u.id], dailyDates[other.id]).size; }
    xp += teamDays * 10;
    const goals = weeks.filter(w => w.goalDone).length; xp += goals * 50;
    const duelsWon = weeks.filter(w => w.winner === u.id).length;
    const duelsTie = weeks.filter(w => w.winner === 'tie').length;
    xp += duelsWon * 30 + duelsTie * 15;
    const sum = (keys) => own.filter(r => (r.kind === 'daily' || r.kind === 'log') && keys.includes(r.key)).reduce((a, r) => a + Number(r.amount), 0);
    const count = (k) => own.filter(r => r.kind === k).length;
    const act = activeDates(u.id);
    const hours = own.map(r => new Date(r.created_at).getHours());
    out[u.id] = {
      xp, level: 1 + Math.floor(xp / LEVEL_XP), levelProgress: (xp % LEVEL_XP) / LEVEL_XP,
      streak: currentStreak(act), maxStreak: maxStreak(act),
      activeDays: [...act].length,
      squats: sum(['squats']), pushups: sum(['pushups']), plank: sum(['plank']),
      move: sum(['walk', 'run', 'bike', 'swim', 'dance', 'yoga']),
      workouts: count('workout'), habits: count('habit'), dailies: count('daily'),
      total: own.filter(r => r.kind !== 'joker').length,
      early: hours.some(h => h < 8), late: hours.some(h => h >= 21),
      goals, duelsWon, weights: S.weights.filter(w => w.user_id === u.id).length,
    };
  }
  const teamAct = S.partner ? intersect(activeDates(S.me.id), activeDates(S.partner.id)) : new Set();
  return { users: out, weeks, teamStreak: currentStreak(teamAct), teamXp: Object.values(out).reduce((a, s) => a + s.xp, 0) };
}

const BADGES = [
  { id: 'first', emoji: '👣', name: 'Erster Schritt', desc: 'Erste Aktivität eingetragen', ok: s => s.total >= 1 },
  { id: 'wo1', emoji: '🏋️', name: 'Workout-Neuling', desc: 'Erstes geführtes Workout', ok: s => s.workouts >= 1 },
  { id: 'wo10', emoji: '🎖️', name: 'Routine', desc: '10 Workouts', ok: s => s.workouts >= 10 },
  { id: 'wo50', emoji: '🏅', name: 'Maschine', desc: '50 Workouts', ok: s => s.workouts >= 50 },
  { id: 's3', emoji: '🔥', name: 'Angezündet', desc: '3 Tage am Stück aktiv', ok: s => s.maxStreak >= 3 },
  { id: 's7', emoji: '⚡', name: 'Eine Woche!', desc: '7 Tage am Stück aktiv', ok: s => s.maxStreak >= 7 },
  { id: 's30', emoji: '🏆', name: 'Unaufhaltsam', desc: '30 Tage am Stück aktiv', ok: s => s.maxStreak >= 30 },
  { id: 'sq100', emoji: '🦵', name: 'Beinarbeit', desc: '100 Kniebeugen', ok: s => s.squats >= 100 },
  { id: 'sq1000', emoji: '🦿', name: 'Stahlbeine', desc: '1.000 Kniebeugen', ok: s => s.squats >= 1000 },
  { id: 'pu100', emoji: '💪', name: 'Liegestütz-Profi', desc: '100 Liegestütze', ok: s => s.pushups >= 100 },
  { id: 'pl600', emoji: '🧱', name: 'Fels', desc: '10 Minuten Plank gesamt', ok: s => s.plank >= 600 },
  { id: 'mv600', emoji: '🚶', name: 'Unterwegs', desc: '10 Stunden Bewegung', ok: s => s.move >= 600 },
  { id: 'hab20', emoji: '🌱', name: 'Gute Gewohnheiten', desc: '20 Gewohnheiten erledigt', ok: s => s.habits >= 20 },
  { id: 'early', emoji: '🌅', name: 'Frühaufsteher', desc: 'Aktiv vor 8 Uhr', ok: s => s.early },
  { id: 'late', emoji: '🦉', name: 'Nachteule', desc: 'Aktiv nach 21 Uhr', ok: s => s.late },
  { id: 'team3', emoji: '🤝', name: 'Dream-Team', desc: '3 Wochenziele zusammen geschafft', ok: s => s.goals >= 3 },
  { id: 'duel3', emoji: '⚔️', name: 'Duell-Champion', desc: '3 Duelle gewonnen', ok: s => s.duelsWon >= 3 },
  { id: 'lvl5', emoji: '⭐', name: 'Level 5', desc: 'Level 5 erreicht', ok: s => s.level >= 5 },
  { id: 'lvl10', emoji: '🌟', name: 'Level 10', desc: 'Level 10 erreicht', ok: s => s.level >= 10 },
  { id: 'weigh', emoji: '⚖️', name: 'Am Ball', desc: '5× Körperwerte eingetragen', ok: s => s.weights >= 5 },
];

// ================================================================
//  Rezepte
// ================================================================
const cs = () => S.couple.settings || {};
function recipeAllowed(r) {
  const s = cs();
  if ((s.excludedRecipes || []).includes(r.id)) return false;
  if (r.tags.some(t => (s.excludedTags || []).includes(t))) return false;
  if (r.ing.some(([n]) => (s.excludedIngredients || []).includes(n))) return false;
  return true;
}
const allowedRecipes = (meal) => D.RECIPES.filter(r => (!meal || r.meal === meal) && recipeAllowed(r));
function recipeOfDay(meal, date = today()) {
  const list = allowedRecipes(meal); if (!list.length) return null;
  return pick(list, S.couple.id + '|r|' + meal + date);
}
function generatePlan(wk) {
  const list = allowedRecipes('main').slice(); const ids = [];
  let seed = hashSeed(S.couple.id + '|plan|' + wk);
  while (ids.length < 4 && list.length) { const i = seed % list.length; ids.push(list.splice(i, 1)[0].id); seed = hashSeed(String(seed)); }
  return ids;
}
function mealPlan() {
  const wk = weekStart(today()); const mp = cs().mealPlan;
  if (mp && mp.week === wk) {
    const ids = mp.ids.filter(id => { const r = D.RECIPES.find(x => x.id === id); return r && recipeAllowed(r); });
    const extra = generatePlan(wk).filter(id => !ids.includes(id));
    while (ids.length < 4 && extra.length) ids.push(extra.shift());
    return ids;
  }
  return generatePlan(wk);
}

// ================================================================
//  Daten laden & Sync
// ================================================================
async function loadAll() {
  const cid = S.couple.id;
  const [coupleRaw, profiles, ...lists] = await Promise.all([
    api.getCoupleRaw(cid), api.listProfiles(cid),
    ...['completions', 'custom_challenges', 'rewards', 'nudges', 'shopping_items', 'weights'].map(t => api.list(t, cid)),
  ]);
  if (coupleRaw) { S.coupleRaw = coupleRaw; S.couple = await api.decodeCouple(coupleRaw); }
  S.profiles = profiles;
  S.me = profiles.find(p => p.id === S.user.id) || S.me;
  S.partner = profiles.find(p => p.id !== S.user.id) || null;
  [S.completions, S.custom_challenges, S.rewards, S.nudges, S.shopping_items, S.weights] = lists;
  S.loaded = true;
}

function onRemoteChange(table, ev, row) {
  if (!row) return;
  if (table === 'couples') { S.couple = { ...S.couple, ...row }; return scheduleRender(); }
  if (table === 'profiles') {
    const i = S.profiles.findIndex(p => p.id === row.id);
    if (i >= 0) S.profiles[i] = { ...S.profiles[i], ...row };
    else if (row.id && row.couple_id === S.couple.id) { S.profiles.push(row); if (row.id !== S.user.id) { toast(`🎉 ${esc(row.name || 'Dein Partner')} ist jetzt dabei!`); confetti(); } }
    S.me = S.profiles.find(p => p.id === S.user.id); S.partner = S.profiles.find(p => p.id !== S.user.id) || null;
    return scheduleRender();
  }
  const arr = S[table]; if (!arr) return;
  const i = arr.findIndex(r => r.id === row.id);
  if (ev === 'DELETE') { if (i >= 0) arr.splice(i, 1); return scheduleRender(); }
  if (i >= 0) { arr[i] = { ...arr[i], ...row }; return scheduleRender(); }
  if (ev !== 'INSERT') return;
  arr.push(row);
  if (table === 'completions' && row.user_id !== S.user.id) toast(`${S.partner?.avatar || ''} ${esc(S.partner?.name || '')} ${esc(describe(row))}`);
  if (table === 'nudges' && row.to_user === S.user.id) toast(`👋 ${esc(S.partner?.name || '')}: ${esc(row.message)}`, 5000);
  if (table === 'rewards' && row.created_by !== S.user.id) toast(`🎁 Neue Belohnung: ${esc(row.title)}`);
  if (table === 'custom_challenges' && row.created_by !== S.user.id) toast(`🎯 Neue Challenge: ${esc(row.title)}`);
  scheduleRender();
}

function describe(r) {
  if (r.kind === 'daily') { const ex = D.EXERCISES[r.key]; return `hat die Tages-Challenge geschafft (${fmtNum(r.amount)} ${ex ? (ex.unit === 'sec' ? 'Sek. ' : '') + ex.name : ''}) 💪`; }
  if (r.kind === 'habit') { const h = D.HABITS.find(x => x.id === r.key); return `hat die Gewohnheit erledigt: ${h ? h.emoji + ' ' + h.title : ''}`; }
  if (r.kind === 'workout') { const w = D.WORKOUTS.find(x => x.id === r.key); return `hat das Workout „${w ? w.name : r.key}“ gemacht 🔥`; }
  if (r.kind === 'log') { const a = D.EXERCISES[r.key] || D.ACTIVITIES[r.key]; if (!a) return `hat ${fmtNum(r.amount)} eingetragen`;
    const label = a.unit === 'steps' ? 'Schritte' : a.unit === 'reps' ? a.name : D.UNIT_LABEL[a.unit] + ' ' + a.name;
    return `hat ${fmtNum(r.amount)} ${label} eingetragen`; }
  if (r.kind === 'custom') { const c = S.custom_challenges.find(x => x.id === r.key); return `+${fmtNum(r.amount)} ${c ? c.unit : ''} bei „${c ? c.title : 'Challenge'}“`; }
  if (r.kind === 'joker') return 'hat einen Joker eingesetzt 🃏';
  return 'war aktiv';
}

// ================================================================
//  Aktionen
// ================================================================
async function addCompletion(row, pushText = true) {
  const full = { couple_id: S.couple.id, user_id: S.user.id, date: today(), amount: 0, points: POINTS[row.kind] ?? 0, ...row };
  const tmpId = 'tmp-' + Math.random();
  S.completions.push({ ...full, id: tmpId, created_at: new Date().toISOString() }); render();
  try {
    const saved = await api.insert('completions', full);
    const i = S.completions.findIndex(r => r.id === tmpId);
    if (S.completions.some(r => r.id === saved.id)) S.completions.splice(i, 1); else S.completions[i] = saved;
    render();
    if (pushText && S.partner && S.partner.settings?.notifyActivity !== false) {
      api.sendPush({ title: `${S.me.avatar} ${S.me.name} war aktiv`, body: `${S.me.name} ${describe(saved)}`, tag: 'activity' });
    }
    return saved;
  } catch (e) {
    S.completions = S.completions.filter(r => r.id !== tmpId); render(); toast('⚠️ ' + e.message);
  }
}
async function removeCompletion(id) {
  const r = S.completions.find(x => x.id === id); if (!r) return;
  S.completions = S.completions.filter(x => x.id !== id); render();
  try { await api.remove('completions', id); } catch (e) { S.completions.push(r); render(); toast('⚠️ ' + e.message); }
}
async function setCoupleSettings(patch) {
  S.couple.settings = { ...cs(), ...patch }; render();
  try { await api.updateCouple(S.couple.id, S.couple.settings); } catch (e) { toast('⚠️ ' + e.message); }
}
async function setMySettings(patch) {
  S.me.settings = { ...(S.me.settings || {}), ...patch }; render();
  try { await api.updateProfile(S.me.id, S.me); } catch (e) { toast('⚠️ ' + e.message); }
}
async function insertRow(table, row) {
  try { const saved = await api.insert(table, { couple_id: S.couple.id, ...row });
    if (!S[table].some(r => r.id === saved.id)) S[table].push(saved); render(); return saved;
  } catch (e) { toast('⚠️ ' + e.message); }
}
async function updateRow(table, id, patch) {
  const r = S[table].find(x => x.id === id); if (!r) return;
  Object.assign(r, patch); render();
  try { await api.update(table, id, { ...r }); } catch (e) { toast('⚠️ ' + e.message); }
}
async function deleteRow(table, id) {
  S[table] = S[table].filter(x => x.id !== id); render();
  try { await api.remove(table, id); } catch (e) { toast('⚠️ ' + e.message); }
}

function confetti() {
  const box = document.createElement('div'); box.className = 'confetti';
  const em = ['🎉', '💪', '🔥', '⭐', '❤️', '✨'];
  for (let i = 0; i < 24; i++) {
    const s = document.createElement('span'); s.textContent = em[i % em.length];
    s.style.left = Math.random() * 100 + 'vw'; s.style.animationDelay = Math.random() * 0.4 + 's';
    s.style.fontSize = 16 + Math.random() * 18 + 'px'; box.appendChild(s);
  }
  document.body.appendChild(box); setTimeout(() => box.remove(), 2600);
}

function toast(html, ms = 3200) {
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html;
  $('#toasts').appendChild(t); setTimeout(() => t.classList.add('out'), ms); setTimeout(() => t.remove(), ms + 400);
}

// ================================================================
//  Rendering – Grundgerüst
// ================================================================
function scheduleRender() {
  if (renderPending) return; renderPending = true;
  requestAnimationFrame(() => { renderPending = false; render(); });
}
function render() {
  const app = $('#app');
  if (S.screen !== 'main') { app.innerHTML = renderGate(); return; }
  const a = document.activeElement;
  if (a && a.closest && a.closest('#main') && /INPUT|TEXTAREA/.test(a.tagName) && !/checkbox|radio/.test(a.type) && a.value) { a.addEventListener('blur', scheduleRender, { once: true }); return; }
  const scroll = window.scrollY;
  const stats = computeStats();
  app.innerHTML = `
    <header class="top">
      <div class="brand">Duo<span>.</span></div>
      <div class="top-right">
        ${stats.teamStreak ? `<span class="pill fire">🔥 ${stats.teamStreak}</span>` : ''}
        <button class="avatar-btn" data-act="tab" data-tab="wir" aria-label="Profil">${esc(S.me.avatar)}</button>
      </div>
    </header>
    ${api.demo ? '<div class="demo-bar">Demo-Modus – Daten bleiben nur auf diesem Gerät. <a href="./">Zur echten App</a></div>' : ''}
    <main id="main">${renderTab(stats)}</main>
    <nav class="tabs">
      ${[['heute', '🏠', 'Heute'], ['challenges', '🎯', 'Challenges'], ['training', '🏋️', 'Training'], ['essen', '🥗', 'Essen'], ['wir', '📊', 'Wir']]
        .map(([id, ic, l]) => `<button class="${S.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}"><span>${ic}</span>${l}</button>`).join('')}
    </nav>`;
  window.scrollTo(0, scroll);
  if (S.tab === 'wir') refreshPushButton();
}
function renderTab(stats) {
  switch (S.tab) {
    case 'challenges': return renderChallenges(stats);
    case 'training': return renderTraining();
    case 'essen': return renderFood();
    case 'wir': return renderUs(stats);
    default: return renderToday(stats);
  }
}

const nameOf = id => id === S.user.id ? 'Du' : (S.partner && S.partner.id === id ? S.partner.name : '?');
const avatarOf = id => (S.profiles.find(p => p.id === id) || {}).avatar || '🙂';
const cls = id => id === S.user.id ? 'me' : 'pa';

function ring(pct, label, avatar, who) {
  const r = 30, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, pct));
  return `<div class="ring ${who}">
    <svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="${r}" class="bg"/><circle cx="36" cy="36" r="${r}" class="fg" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg>
    <div class="ring-av">${esc(avatar)}</div><div class="ring-l">${esc(label)}</div></div>`;
}

function bar(parts, target) {
  const total = parts.reduce((a, p) => a + p.v, 0);
  return `<div class="bar">${parts.map(p => `<i class="${p.c}" style="width:${Math.min(100, p.v / Math.max(target, 1) * 100)}%"></i>`).join('')}</div>
    <div class="bar-l"><b>${fmtNum(total)}</b> / ${fmtNum(target)}${total >= target ? ' ✅' : ''}</div>`;
}

// ================================================================
//  Tab: Heute
// ================================================================
function renderToday(stats) {
  const t = today(), dc = dailyChallenge(t), hb = dailyHabit(t);
  const done = (uid, kind) => S.completions.find(r => r.user_id === uid && r.kind === kind && r.date === t);
  const myD = done(S.user.id, 'daily'), myH = done(S.user.id, 'habit');
  const pid = S.partner?.id;
  const paD = pid && done(pid, 'daily'), paH = pid && done(pid, 'habit');
  const wk = weekStart(t), rows = rowsInWeek(wk);
  const goal = weeklyGoal(wk), duel = weeklyDuel(wk);
  const myVal = metricValue(goal.metric, rows.filter(r => r.user_id === S.user.id));
  const paVal = pid ? metricValue(goal.metric, rows.filter(r => r.user_id === pid)) : 0;
  const dMe = metricValue(duel.metric, rows.filter(r => r.user_id === S.user.id));
  const dPa = pid ? metricValue(duel.metric, rows.filter(r => r.user_id === pid)) : 0;
  const daysLeft = daysBetween(t, addDays(wk, 6));
  const greet = new Date().getHours() < 11 ? 'Guten Morgen' : new Date().getHours() < 18 ? 'Hallo' : 'Guten Abend';
  const lastNudge = S.nudges.filter(n => n.to_user === S.user.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const feed = S.completions.filter(r => !String(r.id).startsWith('tmp')).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8);
  const myJokerUsed = rows.some(r => r.user_id === S.user.id && r.kind === 'joker');
  const myDates = activeDates(S.user.id);
  const yest = addDays(t, -1);
  const jokerUseful = !myJokerUsed && ((!myDates.has(yest) && myDates.has(addDays(t, -2))) || !myDates.has(t));
  const myTodayPct = ((myD ? 1 : 0) + (myH ? 1 : 0)) / 2;
  const paTodayPct = ((paD ? 1 : 0) + (paH ? 1 : 0)) / 2;

  return `
  <section class="hello">
    <h1>${greet}, ${esc(S.me.name)} 👋</h1>
    <p class="muted">${fmtDay(t)} · Level ${levelAt()} der Challenges</p>
  </section>

  ${!S.partner ? `<div class="card invite"><b>Warte auf deine Partnerin / deinen Partner</b>
    <p>Schick die Einladung (enthält Code und Schlüssel), oder gib Code + Schlüssel manuell weiter:</p><div class="code">${esc(S.couple.code)}</div>
    <button class="btn small" data-act="shareInvite">Einladung schicken</button></div>` : ''}

  <div class="card duo">
    ${ring(myTodayPct, 'Du', S.me.avatar, 'me')}
    <div class="vs"><div class="streak">🔥 ${stats.teamStreak}</div><small>Tage zusammen</small></div>
    ${S.partner ? ring(paTodayPct, S.partner.name, S.partner.avatar, 'pa') : ring(0, '…', '❔', 'pa')}
  </div>

  ${lastNudge && (Date.now() - new Date(lastNudge.created_at)) < 6 * 3600e3 ? `<div class="card nudge-in">👋 <b>${esc(S.partner?.name)}</b>: ${esc(lastNudge.message)} <small class="muted">${timeAgo(lastNudge.created_at)}</small></div>` : ''}

  <div class="card challenge ${myD ? 'is-done' : ''}">
    <div class="card-h"><span class="tag">Tages-Challenge</span><span class="pts">+${POINTS.daily}</span></div>
    <h2>${dc.ex.emoji} ${esc(dc.title)}</h2>
    <details><summary>So geht's</summary><p>${esc(dc.ex.how)}</p><p class="muted">Leichter: ${esc(dc.ex.easier)}</p></details>
    <div class="status">
      <span class="who me">${myD ? '✅' : '⏳'} Du</span>
      ${S.partner ? `<span class="who pa">${paD ? '✅' : '⏳'} ${esc(S.partner.name)}</span>` : ''}
    </div>
    ${myD ? `<button class="btn ghost small" data-act="undo" data-id="${myD.id}">Rückgängig</button>`
      : `<button class="btn" data-act="doDaily">Geschafft! 💪</button>`}
    ${myD && paD ? '<p class="bonus">🤝 Beide geschafft: +10 Team-Bonus für jeden!</p>' : ''}
  </div>

  <div class="card challenge habit ${myH ? 'is-done' : ''}">
    <div class="card-h"><span class="tag green">Gewohnheit des Tages</span><span class="pts">+${POINTS.habit}</span></div>
    <h2>${hb.emoji} ${esc(hb.title)}</h2>
    <div class="status">
      <span class="who me">${myH ? '✅' : '⏳'} Du</span>
      ${S.partner ? `<span class="who pa">${paH ? '✅' : '⏳'} ${esc(S.partner.name)}</span>` : ''}
    </div>
    ${myH ? `<button class="btn ghost small" data-act="undo" data-id="${myH.id}">Rückgängig</button>`
      : `<button class="btn green" data-act="doHabit">Erledigt ✓</button>`}
  </div>

  <div class="quick">
    <button class="qbtn" data-act="openLog">➕<span>Eintragen</span></button>
    <button class="qbtn" data-act="nudge" ${S.partner ? '' : 'disabled'}>👋<span>Anstupsen</span></button>
    <button class="qbtn" data-act="tab" data-tab="training">▶️<span>Workout</span></button>
    <button class="qbtn" data-act="openJoker" ${jokerUseful ? '' : 'disabled'}>🃏<span>Joker</span></button>
  </div>

  <div class="card">
    <div class="card-h"><span class="tag purple">Wochenziel · Team</span><span class="muted small">noch ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'}</span></div>
    <h3>${esc(goal.title)}</h3>
    ${bar([{ v: myVal, c: 'me' }, { v: paVal, c: 'pa' }], goal.target)}
    <div class="legend"><span class="me">Du ${fmtNum(myVal)}</span>${S.partner ? `<span class="pa">${esc(S.partner.name)} ${fmtNum(paVal)}</span>` : ''}</div>
  </div>

  <div class="card">
    <div class="card-h"><span class="tag red">Duell der Woche ⚔️</span><span class="pts">+30</span></div>
    <h3>${esc(duel.title)}</h3>
    <div class="duel">
      <div class="me ${dMe > dPa ? 'lead' : ''}"><b>${fmtNum(dMe)}</b><small>Du</small></div>
      <div class="dvs">vs</div>
      <div class="pa ${dPa > dMe ? 'lead' : ''}"><b>${fmtNum(dPa)}</b><small>${esc(S.partner?.name || '…')}</small></div>
    </div>
    <p class="muted small center">${esc(duel.unit)} diese Woche${cs().stake ? ` · Einsatz: <b>${esc(cs().stake)}</b>` : ''}</p>
  </div>

  <div class="card">
    <div class="card-h"><span class="tag gray">Was zuletzt passiert ist</span></div>
    ${feed.length ? `<ul class="feed">${feed.map(r => `<li class="${cls(r.user_id)}">
      <span class="fav">${esc(avatarOf(r.user_id))}</span>
      <span class="ftxt"><b>${esc(nameOf(r.user_id))}</b> ${esc(describe(r))}<small>${timeAgo(r.created_at)}</small></span>
      ${r.user_id === S.user.id && r.date === t ? `<button class="x" data-act="undo" data-id="${r.id}" aria-label="Löschen">×</button>` : ''}
    </li>`).join('')}</ul>` : '<p class="muted">Noch nichts los – mach den Anfang! 🚀</p>'}
  </div>`;
}

// ================================================================
//  Tab: Challenges
// ================================================================
function renderChallenges(stats) {
  const weeks = stats.weeks.slice().reverse();
  const finished = weeks.filter(w => w.finished);
  const myWins = finished.filter(w => w.winner === S.user.id).length;
  const paWins = finished.filter(w => S.partner && w.winner === S.partner.id).length;
  const t = today();
  const activeCustom = S.custom_challenges.filter(c => c.end_date >= t).sort((a, b) => a.end_date.localeCompare(b.end_date));
  const oldCustom = S.custom_challenges.filter(c => c.end_date < t).slice(-5).reverse();
  const teamXp = stats.teamXp;
  const rewards = S.rewards.slice().sort((a, b) => a.points - b.points);

  const customCard = (c) => {
    const rows = S.completions.filter(r => r.kind === 'custom' && r.key === c.id);
    const me = rows.filter(r => r.user_id === S.user.id).reduce((a, r) => a + Number(r.amount), 0);
    const pa = rows.filter(r => r.user_id !== S.user.id).reduce((a, r) => a + Number(r.amount), 0);
    const left = daysBetween(t, c.end_date);
    return `<div class="card">
      <div class="card-h"><span class="tag ${c.mode === 'duel' ? 'red' : 'purple'}">${c.mode === 'duel' ? 'Duell' : 'Team'} · ${c.created_by === S.user.id ? 'von dir' : 'von ' + esc(nameOf(c.created_by))}</span>
      <span class="muted small">${left < 0 ? 'beendet' : left === 0 ? 'letzter Tag' : `noch ${left} Tage`}</span></div>
      <h3>${esc(c.title)}</h3>
      ${c.mode === 'duel' ? `<div class="duel">
          <div class="me ${me > pa ? 'lead' : ''}"><b>${fmtNum(me)}</b><small>Du · Ziel ${fmtNum(c.target)}</small></div><div class="dvs">vs</div>
          <div class="pa ${pa > me ? 'lead' : ''}"><b>${fmtNum(pa)}</b><small>${esc(S.partner?.name || '…')}</small></div></div>`
        : bar([{ v: me, c: 'me' }, { v: pa, c: 'pa' }], Number(c.target))}
      <p class="muted small">${esc(c.unit)}</p>
      ${left >= 0 ? `<div class="row"><button class="btn small" data-act="customProgress" data-id="${c.id}">+ Fortschritt</button>
      ${c.created_by === S.user.id ? `<button class="btn small ghost" data-act="delCustom" data-id="${c.id}">Löschen</button>` : ''}</div>` : ''}
    </div>`;
  };

  return `
  <section class="hello"><h1>Challenges 🎯</h1><p class="muted">Gemeinsam stark, gegeneinander noch stärker.</p></section>

  <div class="card scoreboard">
    <div class="me"><span>${esc(S.me.avatar)}</span><b>${myWins}</b><small>Du</small></div>
    <div class="mid">Duell-Bilanz</div>
    <div class="pa"><span>${esc(S.partner?.avatar || '❔')}</span><b>${paWins}</b><small>${esc(S.partner?.name || '…')}</small></div>
  </div>

  <h2 class="sec">Eigene Challenges <button class="btn small" data-act="newCustom">+ Neu</button></h2>
  ${activeCustom.length ? activeCustom.map(customCard).join('') : '<p class="muted pad">Denkt euch eigene Challenges aus, z.&nbsp;B. „7 Tage kein Fast Food“ oder „Wer schafft mehr Schritte bis Sonntag?“</p>'}

  <h2 class="sec">Belohnungen 🎁 <button class="btn small" data-act="newReward">+ Neu</button></h2>
  <div class="card">
    <div class="card-h"><span class="tag purple">Team-Punkte</span><b class="big">${fmtNum(teamXp)}</b></div>
    ${rewards.length ? rewards.map(r => `<div class="reward ${r.redeemed_at ? 'redeemed' : ''}">
      <div class="rw-t"><b>${esc(r.title)}</b><small>${fmtNum(r.points)} Punkte${r.redeemed_at ? ' · eingelöst 🎉' : ''}</small></div>
      ${r.redeemed_at ? `<button class="x" data-act="delReward" data-id="${r.id}">×</button>`
        : teamXp >= r.points ? `<button class="btn small green" data-act="redeem" data-id="${r.id}">Einlösen!</button>`
        : `<div class="mini"><i style="width:${teamXp / r.points * 100}%"></i></div><button class="x" data-act="delReward" data-id="${r.id}">×</button>`}
    </div>`).join('') : '<p class="muted">Legt fest, worauf ihr hinarbeitet: Pizza-Abend, Kino, Wellness-Tag …</p>'}
  </div>
  <div class="card">
    <div class="card-h"><span class="tag red">Wetteinsatz für Duelle</span></div>
    <p>${cs().stake ? `<b>${esc(cs().stake)}</b>` : '<span class="muted">Noch kein Einsatz festgelegt.</span>'}</p>
    <button class="btn small ghost" data-act="editStake">Einsatz ändern</button>
  </div>

  <h2 class="sec">Verlauf</h2>
  <div class="card">
    ${weeks.map(w => `<div class="hist">
      <div class="hist-d">${w.wk === weekStart(t) ? '<b>Diese Woche</b>' : 'Woche ab ' + fmtDay(w.wk)}</div>
      <div>${w.goalDone ? '✅' : w.finished ? '❌' : '⏳'} ${esc(w.goal.title)} <small class="muted">(${fmtNum(w.goalVal)}/${fmtNum(w.goal.target)})</small></div>
      <div>⚔️ ${esc(w.duel.title)} <small class="muted">${fmtNum(w.vals[0])} : ${fmtNum(w.vals[1])}</small>
        ${w.finished ? (w.winner === 'tie' ? ' · Unentschieden 🤝' : w.winner ? ` · 🏆 ${esc(nameOf(w.winner))}` : '') : ''}</div>
    </div>`).join('')}
  </div>
  ${oldCustom.length ? `<h2 class="sec">Beendete Challenges</h2>${oldCustom.map(customCard).join('')}` : ''}`;
}

// ================================================================
//  Tab: Training
// ================================================================
function workoutSteps(w) {
  const bonus = Math.min(20, (levelAt() - 1) * 5);
  const steps = [{ type: 'prep', dur: 10 }];
  for (let r = 0; r < w.rounds; r++) w.exercises.forEach((k, i) => {
    steps.push({ type: 'work', key: k, dur: w.work + bonus, round: r + 1 });
    const last = r === w.rounds - 1 && i === w.exercises.length - 1;
    if (!last) steps.push({ type: 'rest', dur: w.rest, next: r === w.rounds - 1 ? w.exercises[i + 1] : w.exercises[(i + 1) % w.exercises.length] });
  });
  return steps;
}
const workoutMinutes = w => Math.round(workoutSteps(w).reduce((a, s) => a + s.dur, 0) / 60);

function renderTraining() {
  const myW = S.completions.filter(r => r.kind === 'workout' && r.user_id === S.user.id);
  return `
  <section class="hello"><h1>Training 🏋️</h1><p class="muted">Nur mit dem eigenen Körper. Einfach starten, der Timer führt euch durch.</p></section>
  <div class="grid">
    ${D.WORKOUTS.map(w => {
      const n = myW.filter(r => r.key === w.id).length;
      return `<button class="card wcard" data-act="workout" data-id="${w.id}">
        <div class="w-emoji">${w.emoji}</div><b>${esc(w.name)}</b>
        <small>${workoutMinutes(w)} Min · ${esc(w.level)}</small>
        <p>${esc(w.desc)}</p>${n ? `<span class="badge-n">${n}×</span>` : ''}
      </button>`;
    }).join('')}
  </div>
  <p class="muted small pad">Tipp: Macht die Workouts zusammen. Jeder trägt sie dann bei sich ein. Ab und zu werden die Übungsphasen automatisch etwas länger.</p>
  <h2 class="sec">Übungen</h2>
  <div class="card">
    ${Object.entries(D.EXERCISES).map(([k, e]) => `<details class="ex"><summary>${e.emoji} ${esc(e.name)}</summary>
      <p>${esc(e.how)}</p><p class="muted">Leichter: ${esc(e.easier)}</p></details>`).join('')}
  </div>`;
}

// Workout-Player
let player = null;
function startWorkout(id) {
  const w = D.WORKOUTS.find(x => x.id === id); if (!w) return;
  player = { w, steps: workoutSteps(w), i: 0, end: 0, left: 0, paused: false, timer: null, wake: null };
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch {}
  const ov = document.createElement('div'); ov.id = 'player'; ov.className = 'player'; document.body.appendChild(ov);
  try { navigator.wakeLock?.request('screen').then(l => player && (player.wake = l)).catch(() => {}); } catch {}
  enterStep(0);
  player.timer = setInterval(tick, 200);
}
let audioCtx;
function beep(freq = 880, dur = 0.12) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.25, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch {}
}
function enterStep(i) {
  player.i = i;
  if (i >= player.steps.length) return finishWorkout();
  const s = player.steps[i];
  player.end = Date.now() + s.dur * 1000; player.left = s.dur;
  if (s.type === 'work') { beep(1046, 0.25); try { navigator.vibrate?.(200); } catch {} }
  renderPlayer();
}
function tick() {
  if (!player || player.paused || player.done) return;
  const left = Math.max(0, Math.ceil((player.end - Date.now()) / 1000));
  if (left !== player.left) {
    player.left = left;
    if (left > 0 && left <= 3) beep(660);
    const el = $('#p-time'); if (el) el.textContent = left;
    const pr = $('#p-prog'); const s = player.steps[player.i];
    if (pr) pr.style.width = (100 * (1 - left / s.dur)) + '%';
  }
  if (left <= 0) enterStep(player.i + 1);
}
function renderPlayer() {
  const ov = $('#player'); if (!ov) return;
  const s = player.steps[player.i], w = player.w;
  const ex = s.key ? D.EXERCISES[s.key] : null;
  const nx = s.next ? D.EXERCISES[s.next] : null;
  const workIdx = player.steps.slice(0, player.i + 1).filter(x => x.type === 'work').length;
  const workTotal = player.steps.filter(x => x.type === 'work').length;
  ov.className = 'player ' + s.type;
  ov.innerHTML = `
    <div class="p-top"><button class="p-x" data-act="quitWorkout">✕</button><span>${esc(w.name)}</span><span>${workIdx}/${workTotal}</span></div>
    <div class="p-body">
      <div class="p-phase">${s.type === 'prep' ? 'Mach dich bereit' : s.type === 'rest' ? 'Pause' : `Runde ${s.round} von ${w.rounds}`}</div>
      <div class="p-ex">${s.type === 'work' ? `${ex.emoji} ${esc(ex.name)}` : s.type === 'rest' ? '😮‍💨 Durchatmen' : `${D.EXERCISES[player.steps[1].key].emoji} Gleich geht's los`}</div>
      <div class="p-time" id="p-time">${player.left}</div>
      <div class="p-bar"><i id="p-prog" style="width:0%"></i></div>
      <div class="p-hint">${s.type === 'work' ? esc(ex.how) + `<br><small>Zu schwer? ${esc(ex.easier)}</small>` : s.type === 'rest' ? `Als Nächstes: <b>${nx ? nx.emoji + ' ' + esc(nx.name) : ''}</b>` : `Als Erstes: <b>${esc(D.EXERCISES[player.steps[1].key].name)}</b>`}</div>
    </div>
    <div class="p-ctrl">
      <button class="btn ghost" data-act="pauseWorkout">${player.paused ? '▶️ Weiter' : '⏸ Pause'}</button>
      <button class="btn ghost" data-act="skipStep">⏭ Überspringen</button>
    </div>`;
}
function finishWorkout() {
  player.done = true; clearInterval(player.timer);
  beep(1318, 0.4); confetti();
  const ov = $('#player'); ov.className = 'player finish';
  ov.innerHTML = `<div class="p-body"><div class="p-ex">🎉 Geschafft!</div>
    <p>${esc(player.w.name)} · ${workoutMinutes(player.w)} Minuten</p>
    <button class="btn big" data-act="logWorkout">Eintragen (+${POINTS.workout} Punkte)</button>
    <button class="btn ghost" data-act="quitWorkout">Schließen</button></div>`;
}
function closePlayer() {
  if (!player) return;
  clearInterval(player.timer); try { player.wake?.release(); } catch {}
  player = null; $('#player')?.remove();
}

// ================================================================
//  Tab: Essen
// ================================================================
function recipeCard(r, extra = '') {
  return `<div class="rcard" data-act="recipe" data-id="${r.id}">
    <div class="r-emoji">${r.emoji}</div>
    <div class="r-body"><b>${esc(r.name)}</b><small>${r.time} Min · ${r.kcal} kcal · ${r.protein} g Eiweiß</small></div>${extra}</div>`;
}
function renderFood() {
  const br = recipeOfDay('breakfast'), mn = recipeOfDay('main'), sn = recipeOfDay('snack');
  const plan = mealPlan().map(id => D.RECIPES.find(r => r.id === id)).filter(Boolean);
  const items = S.shopping_items.slice().sort((a, b) => (!!a.checked - !!b.checked) || a.created_at.localeCompare(b.created_at));
  const f = S.recipeFilter;
  const all = D.RECIPES.filter(r => f === 'all' || r.meal === f || (f === 'quick' && r.time <= 15) || (f === 'veggie' && !r.tags.includes('fleisch') && !r.tags.includes('fisch')));
  const s = cs();
  const exclCount = (s.excludedRecipes || []).length + (s.excludedTags || []).length + (s.excludedIngredients || []).length;
  return `
  <section class="hello"><h1>Essen 🥗</h1><p class="muted">Leicht, eiweißreich und macht satt. Mengen jeweils für euch zwei.</p></section>
  <h2 class="sec">Vorschläge für heute</h2>
  <div class="card list">
    ${br ? recipeCard(br, '<span class="tag small">Frühstück</span>') : ''}
    ${mn ? recipeCard(mn, '<span class="tag small purple">Abendessen</span>') : ''}
    ${sn ? recipeCard(sn, '<span class="tag small green">Snack</span>') : ''}
  </div>

  <h2 class="sec">Wochenplan <button class="btn small ghost" data-act="planToList">🛒 Zutaten → Liste</button></h2>
  <div class="card list">
    ${plan.map((r, i) => recipeCard(r, `<button class="dice" data-act="reroll" data-i="${i}" aria-label="Neu würfeln">🎲</button>`)).join('') || '<p class="muted">Keine passenden Rezepte – prüft eure Ausschlüsse.</p>'}
  </div>

  <h2 class="sec">Einkaufsliste 🛒</h2>
  <div class="card">
    <form class="addrow" data-form="shop"><input name="text" placeholder="z. B. Magerquark" autocomplete="off" maxlength="80"><button class="btn small">+</button></form>
    <ul class="shop">${items.map(i => `<li class="${i.checked ? 'done' : ''}">
      <label><input type="checkbox" data-act="toggleShop" data-id="${i.id}" ${i.checked ? 'checked' : ''}><span>${esc(i.text)}</span></label>
      <button class="x" data-act="delShop" data-id="${i.id}">×</button></li>`).join('')}</ul>
    ${items.some(i => i.checked) ? '<button class="btn small ghost" data-act="clearShop">Erledigte entfernen</button>' : ''}
    ${!items.length ? '<p class="muted small">Die Liste ist leer. Ihr seht beide dieselbe Liste.</p>' : ''}
  </div>

  <h2 class="sec">Alle Rezepte</h2>
  <div class="chips">${[['all', 'Alle'], ['breakfast', 'Frühstück'], ['main', 'Hauptgerichte'], ['snack', 'Snacks'], ['quick', '≤ 15 Min'], ['veggie', 'Vegetarisch']]
    .map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="rfilter" data-f="${k}">${l}</button>`).join('')}</div>
  <div class="card list">${all.map(r => recipeAllowed(r) ? recipeCard(r) : `<div class="rcard off" data-act="recipe" data-id="${r.id}"><div class="r-emoji">🚫</div><div class="r-body"><b>${esc(r.name)}</b><small>ausgeschlossen</small></div></div>`).join('')}</div>

  <h2 class="sec">Das essen wir nicht ${exclCount ? `<span class="pill">${exclCount}</span>` : ''}</h2>
  <div class="card">
    <p class="muted small">Tippt an, was nie vorgeschlagen werden soll:</p>
    <div class="chips">${Object.entries(D.DIET_TAGS).map(([k, l]) => `<button class="chip ${(s.excludedTags || []).includes(k) ? 'on red' : ''}" data-act="toggleTag" data-k="${k}">${(s.excludedTags || []).includes(k) ? '🚫 ' : ''}${l}</button>`).join('')}</div>
    ${(s.excludedIngredients || []).length ? `<p class="muted small">Zutaten (antippen zum Entfernen):</p><div class="chips">${s.excludedIngredients.map(n => `<button class="chip on red" data-act="unexIng" data-n="${esc(n)}">🚫 ${esc(n)}</button>`).join('')}</div>` : ''}
    ${(s.excludedRecipes || []).length ? `<p class="muted small">Rezepte (antippen zum Entfernen):</p><div class="chips">${s.excludedRecipes.map(id => { const r = D.RECIPES.find(x => x.id === id); return r ? `<button class="chip on red" data-act="unexRecipe" data-id="${id}">🚫 ${esc(r.name)}</button>` : ''; }).join('')}</div>` : ''}
    <p class="muted small">Einzelne Rezepte oder Zutaten schließt ihr direkt im Rezept über „Nicht für uns“ aus.</p>
  </div>`;
}

function openRecipe(id) {
  const r = D.RECIPES.find(x => x.id === id); if (!r) return;
  const ok = recipeAllowed(r);
  openSheet(`
    <div class="r-head"><span>${r.emoji}</span><div><h2>${esc(r.name)}</h2><p class="muted">${D.MEAL_LABEL[r.meal]} · ${r.time} Min · ca. ${r.kcal} kcal · ${r.protein} g Eiweiß pro Portion</p></div></div>
    <h3>Zutaten (2 Portionen)</h3>
    <ul class="ing">${r.ing.map(([n, q]) => `<li><span>${esc(n)}</span><span class="muted">${esc(q)}</span></li>`).join('')}</ul>
    <h3>Zubereitung</h3>
    <ol class="steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <div class="row">
      <button class="btn" data-act="recipeToList" data-id="${r.id}">🛒 Auf die Einkaufsliste</button>
      ${ok ? `<button class="btn ghost red" data-act="excludeMenu" data-id="${r.id}">🚫 Nicht für uns</button>` : `<button class="btn ghost" data-act="unexRecipe" data-id="${r.id}">Wieder erlauben</button>`}
    </div>`);
}
function openExcludeMenu(id) {
  const r = D.RECIPES.find(x => x.id === id);
  openSheet(`<h2>🚫 Was passt nicht?</h2>
    <button class="btn block" data-act="exRecipe" data-id="${r.id}">Nur dieses Rezept ausblenden</button>
    <p class="muted">…oder eine Zutat nie wieder vorschlagen:</p>
    <div class="chips">${r.ing.map(([n]) => `<button class="chip" data-act="exIng" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>
    <p class="muted">…oder eine ganze Kategorie:</p>
    <div class="chips">${r.tags.map(t => `<button class="chip" data-act="toggleTag" data-k="${t}" data-close="1">${D.DIET_TAGS[t]}</button>`).join('') || '<span class="muted small">–</span>'}</div>`);
}
async function addIngredientsToList(recipes) {
  const merged = new Map();
  for (const r of recipes) for (const [n, q] of r.ing) merged.set(n, merged.has(n) ? merged.get(n) + ' + ' + q : q);
  const open = new Set(S.shopping_items.filter(i => !i.checked).map(i => i.text.split(' (')[0].toLowerCase()));
  const toAdd = [...merged].filter(([n]) => !open.has(n.toLowerCase()));
  await Promise.all(toAdd.map(([n, q]) => insertRow('shopping_items', { text: `${n} (${q})`, checked: false })));
  toast(`🛒 ${toAdd.length} Zutaten hinzugefügt`);
}

// ================================================================
//  Tab: Wir (Statistik, Abzeichen, Körper, Einstellungen)
// ================================================================
function heatmap() {
  const t = today(); const start = addDays(weekStart(t), -21);
  const me = activeDates(S.user.id), pa = S.partner ? activeDates(S.partner.id) : new Set();
  let cells = '';
  for (let i = 0; i < 28; i++) {
    const d = addDays(start, i); const a = me.has(d), b = pa.has(d);
    cells += `<div class="hm ${a && b ? 'both' : a ? 'me' : b ? 'pa' : ''} ${d > t ? 'future' : ''} ${d === t ? 'today' : ''}" title="${fmtDay(d)}">${parseD(d).getDate()}</div>`;
  }
  return `<div class="hm-head">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(x => `<span>${x}</span>`).join('')}</div><div class="hm-grid">${cells}</div>
    <div class="legend small"><span class="me">nur du</span><span class="pa">nur ${esc(S.partner?.name || '…')}</span><span class="both">beide</span></div>`;
}
function weightChart(uid, color) {
  const rows = S.weights.filter(w => w.user_id === uid && w.weight).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  if (rows.length < 2) return rows.length ? `<p class="muted small">Erster Eintrag: ${fmtNum(rows[0].weight)} kg. Ab dem 2. Eintrag gibt's eine Kurve.</p>` : '';
  const ws = rows.map(r => Number(r.weight)); const min = Math.min(...ws) - 0.5, max = Math.max(...ws) + 0.5;
  const W = 300, H = 90;
  const pts = rows.map((r, i) => `${(i / (rows.length - 1)) * W},${H - ((r.weight - min) / (max - min)) * H}`).join(' ');
  const diff = ws[ws.length - 1] - ws[0];
  return `<svg class="chart" viewBox="-4 -4 ${W + 8} ${H + 8}" preserveAspectRatio="none"><polyline points="${pts}" class="${color}"/></svg>
    <p class="small"><b>${fmtNum(ws[ws.length - 1])} kg</b> <span class="${diff <= 0 ? 'good' : 'muted'}">(${diff <= 0 ? '' : '+'}${fmtNum(diff)} kg seit ${fmtDay(rows[0].date)})</span></p>`;
}
function renderUs(stats) {
  const me = stats.users[S.user.id], pa = S.partner ? stats.users[S.partner.id] : null;
  const prof = (p, s, c) => `<div class="prof ${c}">
    <div class="p-av">${esc(p.avatar)}</div><b>${esc(c === 'me' ? 'Du' : p.name)}</b>
    <div class="lvl">Level ${s.level}</div><div class="mini"><i style="width:${s.levelProgress * 100}%"></i></div>
    <small>${fmtNum(s.xp)} XP · 🔥 ${s.streak} · 🏅 ${BADGES.filter(b => b.ok(s)).length}</small></div>`;
  const rowsT = [['🦵 Kniebeugen', 'squats'], ['💪 Liegestütze', 'pushups'], ['🧱 Plank (Sek.)', 'plank'], ['🏋️ Workouts', 'workouts'], ['🚶 Bewegung (Min.)', 'move'], ['📅 Aktive Tage', 'activeDays'], ['🏆 Längste Serie', 'maxStreak']];
  const myWeights = S.weights.filter(w => w.user_id === S.user.id).sort((a, b) => b.date.localeCompare(a.date));
  const ms = S.me.settings || {};
  return `
  <section class="hello"><h1>Wir zwei 📊</h1></section>
  <div class="card profs">${prof(S.me, me, 'me')}${pa ? prof(S.partner, pa, 'pa') : '<div class="prof pa"><div class="p-av">❔</div><b>Noch niemand</b><small>Code: ' + esc(S.couple.code) + '</small></div>'}</div>

  <h2 class="sec">Letzte 4 Wochen</h2>
  <div class="card">${heatmap()}</div>

  <h2 class="sec">Gesamt</h2>
  <div class="card"><table class="stats"><thead><tr><th></th><th class="me">Du</th><th class="pa">${esc(S.partner?.name || '–')}</th></tr></thead>
    <tbody>${rowsT.map(([l, k]) => `<tr><td>${l}</td><td>${fmtNum(me[k])}</td><td>${pa ? fmtNum(pa[k]) : '–'}</td></tr>`).join('')}</tbody></table></div>

  <h2 class="sec">Abzeichen</h2>
  <div class="badges">${BADGES.map(b => { const a = b.ok(me), c = pa && b.ok(pa);
    return `<div class="bdg ${a ? 'got' : ''}" title="${esc(b.desc)}"><span>${b.emoji}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small>
      ${c ? `<i class="pa-dot" title="${esc(S.partner.name)} hat es auch">${esc(S.partner.avatar)}</i>` : ''}</div>`; }).join('')}</div>

  <h2 class="sec">Körper ⚖️</h2>
  <div class="card">
    <form class="addrow" data-form="weight">
      <input name="weight" type="number" step="0.1" min="30" max="300" inputmode="decimal" placeholder="Gewicht kg">
      <input name="waist" type="number" step="0.5" min="40" max="200" inputmode="decimal" placeholder="Bauch cm">
      <button class="btn small">+</button>
    </form>
    ${weightChart(S.user.id, 'me')}
    <label class="toggle"><input type="checkbox" data-act="shareWeight" ${ms.shareWeight ? 'checked' : ''}> Meine Werte mit ${esc(S.partner?.name || 'Partner/in')} teilen</label>
    ${S.partner && S.weights.some(w => w.user_id === S.partner.id) ? `<h3>${esc(S.partner.name)}</h3>${weightChart(S.partner.id, 'pa')}` : ''}
    ${myWeights.length ? `<details><summary>Meine Einträge (${myWeights.length})</summary><ul class="wlist">${myWeights.map(w => `<li>${fmtDay(w.date)}: ${w.weight ? fmtNum(w.weight) + ' kg' : ''} ${w.waist ? '· ' + fmtNum(w.waist) + ' cm' : ''}<button class="x" data-act="delWeight" data-id="${w.id}">×</button></li>`).join('')}</ul></details>` : ''}
  </div>

  <h2 class="sec">Einstellungen ⚙️</h2>
  <div class="card settings">
    <div class="set"><span>Profil</span><button class="btn small ghost" data-act="editProfile">${esc(S.me.avatar)} ${esc(S.me.name)} ✎</button></div>
    <div class="set"><span>Schwierigkeit</span><div class="seg">${[['leicht', 'Leicht'], ['normal', 'Normal'], ['stark', 'Stark']].map(([k, l]) => `<button class="${(cs().difficulty || 'normal') === k ? 'on' : ''}" data-act="difficulty" data-k="${k}">${l}</button>`).join('')}</div></div>
    <p class="muted small">Gilt für euch beide. Die Challenges werden außerdem alle 2 Wochen automatisch etwas schwerer (aktuell Stufe ${levelAt()} von 8).</p>
    <div class="set"><span>Push-Nachrichten</span><button class="btn small" data-act="enablePush" id="pushBtn">Aktivieren</button></div>
    <label class="toggle"><input type="checkbox" data-act="notifyActivity" ${ms.notifyActivity !== false ? 'checked' : ''}> Benachrichtige mich, wenn ${esc(S.partner?.name || 'mein Partner')} etwas schafft</label>
    <div class="set"><span>Paar-Code</span><b class="code small">${esc(S.couple.code)}</b></div>
    ${api.demo ? '' : `<div class="set"><span>🔐 Sicherheit</span><button class="btn small ghost" data-act="openSecurity">Schlüssel & Einladung</button></div>
    <p class="muted small">Ende-zu-Ende-verschlüsselt: Eure Inhalte sind nur auf euren Geräten lesbar.</p>`}
    <div class="set"><span>Konto</span><button class="btn small ghost" data-act="logout">Abmelden</button></div>
  </div>
  <p class="muted small center pad">Duo · gebaut für euch zwei ❤️</p>`;
}

// ================================================================
//  Bottom-Sheets
// ================================================================
function openSheet(html) {
  const sh = $('#sheet');
  sh.innerHTML = `<div class="sheet-bg" data-act="closeSheet"></div><div class="sheet-box"><div class="grab"></div>${html}</div>`;
  sh.classList.add('open'); document.body.classList.add('noscroll');
  const inp = sh.querySelector('input[autofocus]'); if (inp) setTimeout(() => inp.focus(), 250);
}
function closeSheet() { $('#sheet').classList.remove('open'); $('#sheet').innerHTML = ''; document.body.classList.remove('noscroll'); }

function openLog(sel) {
  const opts = [...Object.entries(D.EXERCISES), ...Object.entries(D.ACTIVITIES)];
  const cur = sel || 'squats';
  const item = D.EXERCISES[cur] || D.ACTIVITIES[cur];
  const quick = item.unit === 'min' ? [10, 20, 30, 45] : item.unit === 'sec' ? [20, 30, 45, 60] : item.unit === 'steps' ? [3000, 5000, 8000, 10000] : [10, 15, 20, 30];
  openSheet(`<h2>➕ Aktivität eintragen</h2>
    <div class="chips scroll">${opts.map(([k, a]) => `<button class="chip ${k === cur ? 'on' : ''}" data-act="logPick" data-k="${k}">${a.emoji} ${esc(a.name)}</button>`).join('')}</div>
    <form data-form="log" class="logform">
      <input type="hidden" name="key" value="${cur}">
      <label>${D.UNIT_LABEL[item.unit]}</label>
      <input name="amount" type="number" min="1" max="100000" inputmode="numeric" required autofocus placeholder="Anzahl">
      <div class="chips">${quick.map(q => `<button type="button" class="chip" data-act="logQuick" data-v="${q}">${fmtNum(q)}</button>`).join('')}</div>
      <label class="toggle"><input type="checkbox" name="yesterday"> War gestern</label>
      <button class="btn block">Eintragen (+${POINTS.log})</button>
    </form>`);
}

function openJoker() {
  const t = today(), y = addDays(t, -1), mine = activeDates(S.user.id);
  openSheet(`<h2>🃏 Joker</h2><p>Einmal pro Woche darfst du einen Tag aussetzen, ohne dass deine Serie reißt. Gut bei Krankheit, Stress oder Muskelkater.</p>
    ${!mine.has(y) ? `<button class="btn block" data-act="useJoker" data-d="${y}">Joker für gestern (${fmtDay(y)})</button>` : ''}
    ${!mine.has(t) ? `<button class="btn block ghost" data-act="useJoker" data-d="${t}">Heute ist Pausentag</button>` : ''}`);
}

function openNewCustom() {
  const end = addDays(today(), 6);
  openSheet(`<h2>🎯 Neue Challenge</h2>
    <form data-form="custom" class="form">
      <label>Was?</label><input name="title" required maxlength="80" placeholder="z. B. 7 Tage kein Fast Food" autofocus>
      <label>Ziel (Zahl)</label><input name="target" type="number" min="1" required value="7" inputmode="numeric">
      <label>Einheit</label><input name="unit" maxlength="20" placeholder="Tage, Kniebeugen, km …" value="Tage">
      <label>Modus</label><div class="seg wide"><label><input type="radio" name="mode" value="team" checked><span>🤝 Team</span></label><label><input type="radio" name="mode" value="duel"><span>⚔️ Duell</span></label></div>
      <label>Bis</label><input name="end" type="date" value="${end}" min="${today()}" required>
      <button class="btn block">Challenge starten</button>
    </form>`);
}
function openCustomProgress(id) {
  const c = S.custom_challenges.find(x => x.id === id);
  openSheet(`<h2>${esc(c.title)}</h2><form data-form="customProgress" class="form">
    <input type="hidden" name="id" value="${id}">
    <label>Wie viel ${esc(c.unit)} dazu?</label><input name="amount" type="number" step="any" min="0.1" value="1" required inputmode="decimal" autofocus>
    <button class="btn block">Eintragen</button></form>`);
}
function openNewReward() {
  openSheet(`<h2>🎁 Neue Belohnung</h2><form data-form="reward" class="form">
    <label>Belohnung</label><input name="title" required maxlength="80" placeholder="z. B. Sushi essen gehen" autofocus>
    <label>Ab wie vielen Team-Punkten?</label><input name="points" type="number" min="10" step="10" required value="${Math.ceil((computeStats().teamXp + 300) / 100) * 100}" inputmode="numeric">
    <p class="muted small">Pro Tag sammelt ihr zusammen grob 50–100 Punkte.</p>
    <button class="btn block">Speichern</button></form>`);
}
function openEditProfile() {
  openSheet(`<h2>Profil</h2><form data-form="profile" class="form">
    <label>Name</label><input name="name" required maxlength="30" value="${esc(S.me.name)}">
    <label>Avatar</label><div class="avatars">${D.AVATARS.map(a => `<label><input type="radio" name="avatar" value="${a}" ${a === S.me.avatar ? 'checked' : ''}><span>${a}</span></label>`).join('')}</div>
    <button class="btn block">Speichern</button></form>`);
}

// ================================================================
//  Login / Paar verbinden
// ================================================================
function renderGate() {
  const logo = '<div class="logo">Duo<span>.</span></div>';
  if (S.screen === 'loading') return `<div class="gate">${logo}<div class="spinner"></div></div>`;
  if (S.screen === 'error') return `<div class="gate">${logo}<p>${esc(S.error)}</p><button class="btn" data-act="reload">Nochmal versuchen</button>
    <button class="link" data-act="resetSetup">Verbindung neu einrichten</button></div>`;
  if (S.screen === 'setup') return `<div class="gate">${logo}
    <p class="tagline">Zusammen fitter. Jeden Tag ein bisschen.</p>
    <form class="form card" data-form="setup"><h2>🔗 Einrichten</h2>
      <p class="small">Füge hier den <b>Einladungs-Code</b> ein, den du von deinem Partner / deiner Partnerin oder von deinem anderen Gerät bekommen hast.</p>
      <textarea name="invite" rows="3" placeholder="DUO1.…" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
      <details><summary>Erste Einrichtung (eigene Datenbank)</summary>
        <label>Supabase Project URL</label><input name="u" placeholder="https://xxxx.supabase.co" autocomplete="off" autocapitalize="off">
        <label>Publishable key</label><input name="k" placeholder="sb_publishable_…" autocomplete="off" autocapitalize="off">
        <label>Push-Schlüssel (VAPID public, optional)</label><input name="v" placeholder="B…" autocomplete="off" autocapitalize="off">
        <p class="muted small">Diese Angaben werden nur auf diesem Gerät gespeichert, nicht im Code der App.</p>
      </details>
      <button class="btn block">Weiter</button></form>
    <a class="link" href="?demo">Erstmal die Demo ansehen →</a></div>`;
  if (S.screen === 'recovery') return `<div class="gate">${logo}
    <form class="form card" data-form="newpw"><h2>Neues Passwort</h2><input name="pw" type="password" minlength="8" required placeholder="Neues Passwort" autocomplete="new-password"><button class="btn block">Speichern</button></form></div>`;
  if (S.screen === 'confirm') return `<div class="gate">${logo}<div class="card"><h2>📬 Fast geschafft!</h2>
    <p>Du hast eine E-Mail bekommen. Klick auf den Link darin und melde dich danach hier an.</p>
    <button class="btn block" data-act="authMode" data-m="login">Zur Anmeldung</button></div></div>`;
  if (S.screen === 'auth') {
    const reg = S.authMode === 'register';
    return `<div class="gate">${logo}
      <p class="tagline">Zusammen fitter. Jeden Tag ein bisschen.</p>
      <form class="form card" data-form="auth">
        <div class="seg wide"><button type="button" class="${reg ? '' : 'on'}" data-act="authMode" data-m="login">Anmelden</button><button type="button" class="${reg ? 'on' : ''}" data-act="authMode" data-m="register">Registrieren</button></div>
        <label>E-Mail</label><input name="email" type="email" required autocomplete="email" placeholder="name@beispiel.de">
        <label>Passwort</label><input name="password" type="password" required minlength="8" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="mind. 8 Zeichen">
        <button class="btn block">${reg ? 'Konto erstellen' : 'Anmelden'}</button>
        ${reg ? '<p class="muted small">Die E-Mail dient nur zum Anmelden. Dein Name und alle Inhalte werden verschlüsselt gespeichert.</p>' : '<button type="button" class="link" data-act="forgot">Passwort vergessen?</button>'}
      </form>
      <button class="link" data-act="resetSetup">Andere Verbindung einrichten</button></div>`;
  }
  if (S.screen === 'pair') return `<div class="gate">${logo}
    <div class="card"><h2>Verbindet euch 💞</h2><p>Eine Person erstellt das Paar und schickt der anderen die Einladung.</p>
      <button class="btn block" data-act="createCouple">Paar erstellen</button>
      <div class="or">oder beitreten</div>
      <form class="form" data-form="join">
        <label>Paar-Code</label><input name="code" required maxlength="6" placeholder="CODE" value="${esc(S.invite?.c || '')}" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase;letter-spacing:.2em;text-align:center">
        <label>Schlüssel</label><input name="secret" required placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" value="${esc(S.invite?.s || '')}" autocapitalize="characters" autocomplete="off" spellcheck="false">
        <button class="btn block">Beitreten</button></form>
      <button class="link" data-act="logout">Abmelden</button></div></div>`;
  if (S.screen === 'created') return `<div class="gate">${logo}
    <div class="card"><h2>🔐 Euer Paar ist erstellt</h2>
      <p>Alles wird mit eurem <b>Schlüssel</b> verschlüsselt. Nur wer ihn hat, kann eure Daten lesen – auch Supabase nicht.</p>
      <div class="secret">${esc(S.secret)}</div>
      <p class="small"><b>Wichtig:</b> Speichere den Schlüssel sicher (z. B. im Passwort-Manager). Geht er auf allen Geräten verloren, sind die Daten nicht mehr lesbar.</p>
      <button class="btn block" data-act="shareInvite">Einladung an Partner/in schicken</button>
      <button class="btn block ghost" data-act="copySecret">Schlüssel kopieren</button>
      <button class="btn block ghost" data-act="continueLogin">Weiter →</button></div></div>`;
  if (S.screen === 'key') return `<div class="gate">${logo}
    <form class="form card" data-form="key"><h2>🔐 Schlüssel eingeben</h2>
      <p class="small">Dieses Gerät kennt euren Schlüssel noch nicht. Du findest ihn auf einem Gerät, auf dem Duo schon läuft, unter <b>Wir → Sicherheit</b>.</p>
      <input name="secret" required placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" value="${esc(S.invite?.s || '')}" autocapitalize="characters" autocomplete="off" spellcheck="false">
      ${S.keyError ? `<p class="bad small">${esc(S.keyError)}</p>` : ''}
      <button class="btn block">Entsperren</button>
      <button type="button" class="link" data-act="logout">Abmelden</button></form></div>`;
  if (S.screen === 'profile') return `<div class="gate">${logo}
    <form class="form card" data-form="newprofile"><h2>Wer bist du?</h2>
      <label>Name (sieht nur ihr zwei)</label><input name="name" required maxlength="30" autocomplete="off">
      <label>Avatar</label><div class="avatars">${D.AVATARS.map((a, i) => `<label><input type="radio" name="avatar" value="${a}" ${i === 0 ? 'checked' : ''}><span>${a}</span></label>`).join('')}</div>
      <button class="btn block">Los geht's</button></form></div>`;
  return '';
}

// ---- Schlüssel & Einladungen ----
async function storeKey(coupleId, key, secret) {
  S.secret = secret; api.setKey(key);
  try { await C.kvSet('couple', { coupleId, key, secret }); } catch { toast('⚠️ Schlüssel konnte auf diesem Gerät nicht gespeichert werden (privater Modus?).'); }
}
async function tryKey(input) {
  const secret = C.normalizeSecret(input); if (!secret || !S.coupleRaw) return false;
  try {
    const key = await C.deriveKey(secret, S.coupleRaw.salt);
    if (await C.decryptJSON(key, S.coupleRaw.key_check) !== C.KEY_CHECK) return false;
    await storeKey(S.coupleRaw.id, key, secret); return true;
  } catch { return false; }
}
function inviteCode() {
  return 'DUO1.' + C.b64url(JSON.stringify({ u: S.cfg.u, k: S.cfg.k, v: S.cfg.v || '', c: S.couple?.code || S.coupleRaw?.code, s: S.secret }));
}
const inviteLink = () => location.origin + location.pathname + '#i=' + inviteCode();
function parseInvite(str) {
  const m = String(str || '').match(/DUO1\.([A-Za-z0-9_-]+)/); if (!m) return null;
  try { const o = JSON.parse(C.unb64url(m[1])); return o && o.u && o.k ? o : null; } catch { return null; }
}
function openSecurity() {
  openSheet(`<h2>🔐 Sicherheit</h2>
    <p class="small">Alle Inhalte (Namen, Aktivitäten, Gewicht, Einkaufsliste, Challenges …) werden auf euren Geräten mit AES-256 verschlüsselt. Auf dem Server liegen nur unlesbare Daten.</p>
    <h3>Euer Schlüssel</h3><div class="secret">${esc(S.secret || '–')}</div>
    <button class="btn block ghost" data-act="copySecret">Schlüssel kopieren</button>
    <h3>Neues Gerät / Partner einladen</h3>
    <p class="small">Dieser Code enthält Verbindung und Schlüssel. Nur privat teilen!</p>
    <textarea readonly rows="3" class="mono">${esc(inviteCode())}</textarea>
    <button class="btn block" data-act="shareInvite">Teilen</button>
    <button class="btn block ghost" data-act="copyInvite">Code kopieren</button>
    <h3>Dieses Gerät</h3>
    <button class="btn block ghost red" data-act="forgetDevice">Abmelden & Schlüssel von diesem Gerät löschen</button>`);
}

async function afterLogin(user) {
  S.user = user;
  if (S.recovering) { S.screen = 'recovery'; return render(); }
  await api.ensureProfile(user.id);
  let prof = await api.getProfile(user.id);
  S.me = prof;
  if (!prof || !prof.couple_id) { S.screen = 'pair'; return render(); }
  const raw = await api.getCoupleRaw(prof.couple_id);
  if (!raw) { S.screen = 'pair'; return render(); }
  S.coupleRaw = raw;
  if (!api.demo) {
    let stored = null; try { stored = await C.kvGet('couple'); } catch {}
    if (stored && stored.coupleId === raw.id) { api.setKey(stored.key); S.secret = stored.secret; }
    else if (!(S.invite?.s && await tryKey(S.invite.s))) { S.screen = 'key'; return render(); }
  }
  S.invite = null; S.keyError = null;
  S.couple = await api.decodeCouple(raw);
  prof = await api.getProfile(user.id);
  S.me = prof;
  if (!prof.name) { S.screen = 'profile'; return render(); }
  await loadAll();
  api.subscribe(S.couple.id, onRemoteChange);
  S.screen = 'main'; render();
  refreshPushButton();
}

// ================================================================
//  Push
// ================================================================
function b64ToU8(b64) {
  const p = '='.repeat((4 - b64.length % 4) % 4); const raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
async function refreshPushButton() {
  const btn = $('#pushBtn'); if (!btn) return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = reg && await reg.pushManager?.getSubscription();
    if (sub && Notification.permission === 'granted') { btn.textContent = 'Aktiv ✓'; btn.classList.add('ghost'); }
  } catch {}
}
async function enablePush() {
  if (api.demo) return toast('Im Demo-Modus gibt es keine Push-Nachrichten.');
  if (!S.cfg.v) return toast('Für Push fehlt der Push-Schlüssel in der Einrichtung.');
  if (isIOS() && !isStandalone()) return openSheet(`<h2>📲 Erst zum Home-Bildschirm</h2><p>Auf dem iPhone gehen Push-Nachrichten nur, wenn Duo als App installiert ist:</p>
    <ol class="steps"><li>Unten in Safari auf <b>Teilen</b> (□↑) tippen</li><li><b>„Zum Home-Bildschirm“</b> wählen</li><li>Duo vom Home-Bildschirm öffnen und hier nochmal auf „Aktivieren“ tippen</li></ol>`);
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return toast('Dieser Browser unterstützt leider keine Push-Nachrichten.');
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return toast('Benachrichtigungen wurden nicht erlaubt. Du kannst das in den Handy-Einstellungen ändern.');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(S.cfg.v) });
    await api.savePushSubscription(sub, S.user.id);
    toast('🔔 Push-Nachrichten sind aktiv!'); refreshPushButton();
  } catch (e) { toast('⚠️ Push ging nicht: ' + (e.message || e)); }
}

// ================================================================
//  Klicks & Formulare
// ================================================================
const actions = {
  tab: d => { S.tab = d.tab; try { localStorage.setItem('duo-tab', d.tab); } catch {} closeSheet(); render(); window.scrollTo(0, 0); refreshPushButton(); },
  closeSheet,
  authMode: d => { S.authMode = d.m; S.screen = 'auth'; render(); },
  forgot: async () => {
    const email = $('[data-form=auth] [name=email]').value.trim();
    if (!email) return toast('Gib zuerst oben deine E-Mail ein.');
    try { await api.resetPassword(email); toast('📬 E-Mail zum Zurücksetzen ist unterwegs.'); } catch (e) { toast('⚠️ ' + e.message); }
  },
  logout: async () => { if (!confirm('Wirklich abmelden?')) return; await api.signOut(); location.reload(); },
  createCouple: async (d, el) => {
    el.disabled = true;
    try {
      const secret = C.newSecret(), salt = C.newSalt();
      const key = await C.deriveKey(secret, salt);
      const raw = await api.createCouple(salt, await C.encryptJSON(key, C.KEY_CHECK));
      S.coupleRaw = raw; await storeKey(raw.id, key, secret);
      S.screen = 'created'; render();
    } catch (e) { el.disabled = false; toast('⚠️ ' + e.message); }
  },
  continueLogin: () => afterLogin(S.user),
  reload: () => location.reload(),
  shareInvite: async () => {
    const text = `Mach mit bei Duo 💪\nÖffne diesen Link (bitte nicht weitergeben, er enthält unseren Schlüssel):\n${inviteLink()}`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Einladung kopiert 📋'); } } catch {}
  },
  copyInvite: async () => { try { await navigator.clipboard.writeText(inviteCode()); toast('Code kopiert 📋'); } catch { toast('Kopieren ging nicht – bitte manuell markieren.'); } },
  copySecret: async () => { try { await navigator.clipboard.writeText(S.secret); toast('Schlüssel kopiert 📋'); } catch { toast('Kopieren ging nicht – bitte abschreiben.'); } },
  openSecurity,
  forgetDevice: async () => {
    if (!confirm('Abmelden und Schlüssel von diesem Gerät löschen? Du brauchst ihn danach zum Entsperren wieder.')) return;
    try { await C.kvDel('couple'); } catch {}
    await api.signOut(); location.reload();
  },
  resetSetup: async () => {
    if (!confirm('Verbindung auf diesem Gerät zurücksetzen?')) return;
    try { localStorage.removeItem('duo-config'); await C.kvDel('couple'); } catch {}
    try { await api?.signOut(); } catch {}
    location.href = location.pathname;
  },
  doDaily: async () => {
    const dc = dailyChallenge();
    await addCompletion({ kind: 'daily', key: dc.key, amount: dc.amount });
    confetti();
    const pid = S.partner?.id;
    if (pid && S.completions.some(r => r.user_id === pid && r.kind === 'daily' && r.date === today())) toast('🤝 Ihr habt es beide geschafft! +10 Bonus');
  },
  doHabit: async () => { await addCompletion({ kind: 'habit', key: dailyHabit().id }); confetti(); },
  undo: d => removeCompletion(d.id),
  openLog: () => openLog(),
  logPick: d => openLog(d.k),
  logQuick: d => { const i = $('[data-form=log] [name=amount]'); i.value = d.v; },
  openJoker,
  useJoker: async d => { closeSheet(); await addCompletion({ kind: 'joker', date: d.d }, false); toast('🃏 Joker eingesetzt – deine Serie bleibt!'); },
  nudge: async () => {
    const msg = D.NUDGES[Math.floor(Math.random() * D.NUDGES.length)];
    await insertRow('nudges', { to_user: S.partner.id, from_user: S.user.id, message: msg });
    api.sendPush({ title: `👋 ${S.me.name} stupst dich an`, body: msg, tag: 'nudge' });
    toast(`👋 Angestupst: „${esc(msg)}“`);
  },
  workout: d => startWorkout(d.id),
  pauseWorkout: () => {
    if (!player) return;
    if (player.paused) { player.end = Date.now() + player.left * 1000; player.paused = false; }
    else player.paused = true;
    renderPlayer();
  },
  skipStep: () => player && enterStep(player.i + 1),
  quitWorkout: () => { if (player && !player.done && !confirm('Workout abbrechen?')) return; closePlayer(); },
  logWorkout: async () => {
    const w = player.w; closePlayer();
    await addCompletion({ kind: 'workout', key: w.id, amount: workoutMinutes(w) });
  },
  newCustom: openNewCustom,
  customProgress: d => openCustomProgress(d.id),
  delCustom: d => { if (confirm('Challenge löschen?')) deleteRow('custom_challenges', d.id); },
  newReward: openNewReward,
  delReward: d => { if (confirm('Belohnung löschen?')) deleteRow('rewards', d.id); },
  redeem: d => { updateRow('rewards', d.id, { redeemed_at: new Date().toISOString() }); confetti(); toast('🎁 Viel Spaß! Ihr habt es euch verdient.'); },
  editStake: () => openSheet(`<h2>Wetteinsatz</h2><form data-form="stake" class="form"><label>Was muss der Verlierer des Wochen-Duells tun?</label>
    <input name="stake" maxlength="80" value="${esc(cs().stake || '')}" placeholder="z. B. Wer verliert, kocht am Sonntag" autofocus>
    <div class="chips">${['Wer verliert, kocht am Sonntag 🍝', 'Verlierer gibt eine Massage 💆', 'Verlierer macht den Abwasch 🧽', 'Gewinner wählt den Film 🎬'].map(s => `<button type="button" class="chip" data-act="stakePick" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <button class="btn block">Speichern</button></form>`),
  stakePick: d => { $('[data-form=stake] [name=stake]').value = d.v; },
  recipe: d => openRecipe(d.id),
  rfilter: d => { S.recipeFilter = d.f; render(); },
  reroll: async (d, el, ev) => {
    ev.stopPropagation();
    const ids = mealPlan(); const options = allowedRecipes('main').filter(r => !ids.includes(r.id));
    if (!options.length) return toast('Keine weiteren Rezepte verfügbar.');
    ids[Number(d.i)] = options[Math.floor(Math.random() * options.length)].id;
    await setCoupleSettings({ mealPlan: { week: weekStart(today()), ids } });
  },
  planToList: () => addIngredientsToList(mealPlan().map(id => D.RECIPES.find(r => r.id === id)).filter(Boolean)),
  recipeToList: d => { closeSheet(); addIngredientsToList([D.RECIPES.find(r => r.id === d.id)]); },
  excludeMenu: d => openExcludeMenu(d.id),
  exRecipe: d => { closeSheet(); setCoupleSettings({ excludedRecipes: [...new Set([...(cs().excludedRecipes || []), d.id])] }); toast('🚫 Rezept ausgeblendet'); },
  unexRecipe: d => { closeSheet(); setCoupleSettings({ excludedRecipes: (cs().excludedRecipes || []).filter(x => x !== d.id) }); },
  exIng: d => { closeSheet(); setCoupleSettings({ excludedIngredients: [...new Set([...(cs().excludedIngredients || []), d.n])] }); toast(`🚫 „${esc(d.n)}“ wird nicht mehr vorgeschlagen`); },
  unexIng: d => setCoupleSettings({ excludedIngredients: (cs().excludedIngredients || []).filter(x => x !== d.n) }),
  toggleTag: d => {
    if (d.close) closeSheet();
    const cur = cs().excludedTags || [];
    setCoupleSettings({ excludedTags: cur.includes(d.k) ? cur.filter(x => x !== d.k) : [...cur, d.k] });
  },
  toggleShop: (d, el) => updateRow('shopping_items', d.id, { checked: el.checked }),
  delShop: d => deleteRow('shopping_items', d.id),
  clearShop: () => S.shopping_items.filter(i => i.checked).forEach(i => deleteRow('shopping_items', i.id)),
  shareWeight: async (d, el) => {
    await setMySettings({ shareWeight: el.checked });
    for (const w of S.weights.filter(w => w.user_id === S.user.id && w.shared !== el.checked)) updateRow('weights', w.id, { shared: el.checked });
  },
  delWeight: d => deleteRow('weights', d.id),
  notifyActivity: (d, el) => setMySettings({ notifyActivity: el.checked }),
  difficulty: d => setCoupleSettings({ difficulty: d.k }),
  enablePush,
  editProfile: openEditProfile,
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = actions[el.dataset.act]; if (!a) return;
  if (el.tagName === 'INPUT') { a(el.dataset, el, e); return; }
  if (el.tagName === 'BUTTON' || el.tagName === 'A') e.preventDefault();
  a(el.dataset, el, e);
});

const forms = {
  auth: async f => {
    const email = f.email.value.trim(), password = f.password.value;
    if (S.authMode === 'register') {
      const r = await api.signUp(email, password);
      if (r.needsConfirm) { S.screen = 'confirm'; return render(); }
      return afterLogin(await api.getUser());
    }
    return afterLogin(await api.signIn(email, password));
  },
  newpw: async f => { await api.updatePassword(f.pw.value); S.recovering = false; toast('Passwort geändert ✓'); history.replaceState(null, '', location.pathname); afterLogin(await api.getUser()); },
  newprofile: async f => {
    await api.updateProfile(S.user.id, { name: f.name.value.trim(), avatar: f.avatar.value, settings: {} });
    await afterLogin(S.user);
  },
  join: async f => {
    if (!C.normalizeSecret(f.secret.value)) throw new Error('Der Schlüssel hat 20 Zeichen (Format XXXX-XXXX-XXXX-XXXX-XXXX).');
    S.invite = { ...(S.invite || {}), s: f.secret.value };
    await api.joinCouple(f.code.value.trim().toUpperCase());
    await afterLogin(S.user);
    if (S.screen === 'key') { S.keyError = 'Der Schlüssel passt nicht. Bitte prüfen.'; render(); }
  },
  key: async f => {
    if (await tryKey(f.secret.value)) return afterLogin(S.user);
    S.keyError = 'Der Schlüssel passt nicht. Bitte prüfen.'; S.invite = null; render();
  },
  setup: async f => {
    let cfg = null;
    const inv = parseInvite(f.invite.value);
    if (inv) { cfg = { u: inv.u, k: inv.k, v: inv.v || '' }; S.invite = { c: inv.c, s: inv.s }; }
    else if (f.u.value.trim() && f.k.value.trim()) cfg = { u: f.u.value.trim().replace(/\/(rest\/v1)?\/?$/, ''), k: f.k.value.trim(), v: f.v.value.trim() };
    if (!cfg || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.u)) throw new Error('Bitte einen gültigen Einladungs-Code einfügen.');
    try { localStorage.setItem('duo-config', JSON.stringify(cfg)); } catch {}
    await start(cfg);
  },
  shop: async f => { const text = f.text.value.trim(); if (!text) return; f.text.value = ''; await insertRow('shopping_items', { text, checked: false }); f.text?.focus(); },
  log: async f => {
    const amount = Number(f.amount.value); if (!(amount > 0)) return;
    closeSheet();
    await addCompletion({ kind: 'log', key: f.key.value, amount, date: f.yesterday.checked ? addDays(today(), -1) : today() });
    toast('✅ Eingetragen');
  },
  custom: async f => {
    closeSheet();
    await insertRow('custom_challenges', { title: f.title.value.trim(), target: Number(f.target.value), unit: f.unit.value.trim(),
      mode: f.mode.value, start_date: today(), end_date: f.end.value, created_by: S.user.id });
    api.sendPush({ title: `🎯 Neue Challenge von ${S.me.name}`, body: f.title.value.trim(), tag: 'challenge' });
  },
  customProgress: async f => { closeSheet(); await addCompletion({ kind: 'custom', key: f.id.value, amount: Number(f.amount.value) }); },
  reward: async f => { closeSheet(); await insertRow('rewards', { title: f.title.value.trim(), points: Number(f.points.value), created_by: S.user.id }); },
  stake: async f => { closeSheet(); await setCoupleSettings({ stake: f.stake.value.trim() }); },
  profile: async f => {
    closeSheet(); Object.assign(S.me, { name: f.name.value.trim(), avatar: f.avatar.value }); render();
    try { await api.updateProfile(S.me.id, S.me); } catch (e) { toast('⚠️ ' + e.message); }
  },
  weight: async f => {
    const weight = f.weight.value ? Number(f.weight.value) : null, waist = f.waist.value ? Number(f.waist.value) : null;
    if (!weight && !waist) return;
    f.reset();
    await insertRow('weights', { user_id: S.user.id, date: today(), weight, waist, shared: !!S.me.settings?.shareWeight });
    toast('⚖️ Gespeichert');
  },
};
document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-form]'); if (!f) return;
  e.preventDefault();
  const btn = f.querySelector('button:not([type=button])'); if (btn) btn.disabled = true;
  try { await forms[f.dataset.form](f); } catch (err) { toast('⚠️ ' + (err.message || err)); }
  finally { if (btn && btn.isConnected) btn.disabled = false; }
});

// ================================================================
//  Start
// ================================================================
async function boot() {
  const demo = new URLSearchParams(location.search).has('demo');
  if (demo) return start(null);
  // Einladung per Link (#i=DUO1.…) – der Teil nach # wird nie an einen Server geschickt
  const inv = location.hash.startsWith('#i=') ? parseInvite(location.hash.slice(3)) : null;
  if (inv) {
    history.replaceState(null, '', location.pathname);
    const cfg = { u: inv.u, k: inv.k, v: inv.v || '' };
    try { localStorage.setItem('duo-config', JSON.stringify(cfg)); } catch {}
    S.invite = { c: inv.c, s: inv.s };
  }
  let cfg = null; try { cfg = JSON.parse(localStorage.getItem('duo-config')); } catch {}
  if (!cfg) { S.screen = 'setup'; return render(); }
  return start(cfg);
}

let started = false;
async function start(cfg) {
  S.cfg = cfg;
  try {
    api = cfg ? await createSupabaseBackend(cfg) : createDemoBackend();
  } catch (e) {
    S.screen = 'error'; S.error = 'Die App konnte nicht laden. Bist du online?'; return render();
  }
  api.onAuthChange(async (ev, user) => {
    if (ev === 'PASSWORD_RECOVERY') { S.recovering = true; S.user = user; S.screen = 'recovery'; render(); }
  });
  try {
    const user = await api.getUser();
    if (location.hash.includes('type=recovery')) S.recovering = true;
    if (user) await afterLogin(user); else { S.screen = 'auth'; if (S.invite) S.authMode = 'register'; render(); }
  } catch (e) {
    S.screen = 'error'; S.error = e.message; render();
  }
  if (started) return; started = true;
  // Beim Zurückkehren in die App frische Daten holen
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && S.screen === 'main') {
      try { await loadAll(); render(); } catch {}
    }
  });
  // Tageswechsel um Mitternacht
  let lastDay = today();
  setInterval(() => { if (today() !== lastDay) { lastDay = today(); if (S.screen === 'main') render(); } }, 60000);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
boot();
