// Datenschicht: Supabase (synchronisiert, Ende-zu-Ende-verschlüsselt) oder Demo (nur lokal).
import { encryptJSON, decryptJSON } from './crypto.js';

export const TABLES = ['completions', 'custom_challenges', 'rewards', 'nudges', 'shopping_items', 'weights'];
const META = ['id', 'couple_id', 'user_id', 'created_at', 'shared'];

const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

function germanError(e) {
  const m = (e && (e.message || e.error_description || String(e))) || 'Unbekannter Fehler';
  if (/Invalid login credentials/i.test(m)) return 'E-Mail oder Passwort falsch.';
  if (/already registered|already exists/i.test(m)) return 'Diese E-Mail ist schon registriert – bitte anmelden.';
  if (/Password should be/i.test(m)) return 'Das Passwort muss mindestens 8 Zeichen haben.';
  if (/Email not confirmed/i.test(m)) return 'Bitte bestätige zuerst deine E-Mail (Link im Postfach).';
  if (/valid email|invalid format/i.test(m)) return 'Bitte eine gültige E-Mail-Adresse eingeben.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Keine Verbindung – bist du online?';
  if (/rate limit/i.test(m)) return 'Zu viele Versuche – bitte kurz warten.';
  if (/permission denied/i.test(m)) return 'Keine Berechtigung (Datenbank-Skript ausgeführt?) – ' + m;
  if (/Could not find the (function|table)/i.test(m)) return 'Datenbank nicht eingerichtet (schema.sql ausführen) – ' + m;
  return m;
}

// ------------------------------------------------------------------
//  Supabase
// ------------------------------------------------------------------
export async function createSupabaseBackend(cfg) {
  const { createClient } = await import('./vendor/supabase.js');
  const sb = createClient(cfg.u, cfg.k, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'duo-auth' },
  });
  const chk = ({ data, error }) => { if (error) throw new Error(germanError(error)); return data; };
  let key = null;
  let channel = null;

  const split = (row) => {
    const meta = {}, data = {};
    for (const [k, v] of Object.entries(row)) (META.includes(k) ? meta : data)[k] = v;
    return { meta, data };
  };
  async function open(row) {
    if (!row) return null;
    const meta = {}; for (const k of META) if (k in row) meta[k] = row[k];
    if (!row.data) return meta;
    try { return { ...(await decryptJSON(key, row.data)), ...meta }; }
    catch { console.warn('Eintrag konnte nicht entschlüsselt werden', row.id); return null; }
  }
  async function openProfile(row) {
    if (!row) return null;
    const base = { id: row.id, couple_id: row.couple_id, created_at: row.created_at, name: null, avatar: '🙂', settings: {} };
    if (!row.data || !key) return base;
    try { return { ...base, ...(await decryptJSON(key, row.data)) }; } catch { return base; }
  }
  async function openCouple(row) {
    if (!row) return null;
    let settings = {};
    if (row.data && key) { try { settings = await decryptJSON(key, row.data); } catch {} }
    return { id: row.id, code: row.code, created_at: row.created_at, salt: row.salt, key_check: row.key_check, settings };
  }

  return {
    demo: false,
    setKey(k) { key = k; },
    async getUser() { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; },
    async signUp(email, password) {
      const data = chk(await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } }));
      return { user: data.user, needsConfirm: !data.session };
    },
    async signIn(email, password) { return chk(await sb.auth.signInWithPassword({ email, password })).user; },
    async signOut() { await sb.auth.signOut(); },
    async resetPassword(email) { chk(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })); },
    onAuthChange(cb) { sb.auth.onAuthStateChange((ev, session) => cb(ev, session && session.user)); },
    async updatePassword(pw) { chk(await sb.auth.updateUser({ password: pw })); },

    async getProfile(id) { return openProfile(chk(await sb.from('profiles').select('*').eq('id', id).maybeSingle())); },
    async ensureProfile(id) {
      const existing = chk(await sb.from('profiles').select('id').eq('id', id).maybeSingle());
      if (!existing) chk(await sb.from('profiles').insert({ id }));
    },
    async updateProfile(id, p) {
      const data = await encryptJSON(key, { name: p.name, avatar: p.avatar, settings: p.settings || {} });
      chk(await sb.from('profiles').update({ data }).eq('id', id));
    },
    async listProfiles(coupleId) {
      const rows = chk(await sb.from('profiles').select('*').eq('couple_id', coupleId));
      return Promise.all(rows.map(openProfile));
    },
    async createCouple(salt, keyCheck) { return chk(await sb.rpc('create_couple', { p_salt: salt, p_key_check: keyCheck })); },
    async joinCouple(code) { return chk(await sb.rpc('join_couple', { p_code: code })); },
    async getCoupleRaw(id) { return chk(await sb.from('couples').select('*').eq('id', id).maybeSingle()); },
    decodeCouple: openCouple,
    async updateCouple(id, settings) {
      chk(await sb.from('couples').update({ data: await encryptJSON(key, settings) }).eq('id', id));
    },

    async list(table, coupleId) {
      const out = []; const page = 1000;
      for (let from = 0; ; from += page) {
        const rows = chk(await sb.from(table).select('*').eq('couple_id', coupleId)
          .order('created_at', { ascending: true }).range(from, from + page - 1));
        out.push(...rows);
        if (rows.length < page) break;
      }
      return (await Promise.all(out.map(open))).filter(Boolean);
    },
    async insert(table, row) {
      const { meta, data } = split(row);
      const saved = chk(await sb.from(table).insert({ ...meta, data: await encryptJSON(key, data) }).select().single());
      return { ...data, ...meta, id: saved.id, user_id: saved.user_id, created_at: saved.created_at };
    },
    async update(table, id, fullRow) {
      const { meta, data } = split(fullRow);
      const patch = { data: await encryptJSON(key, data) };
      if ('shared' in meta) patch.shared = meta.shared;
      chk(await sb.from(table).update(patch).eq('id', id));
    },
    async remove(table, id) { chk(await sb.from(table).delete().eq('id', id)); },

    subscribe(coupleId, onChange) {
      if (channel) sb.removeChannel(channel);
      channel = sb.channel('duo-' + coupleId);
      const relay = (t, ev, opener) => async p => { const row = await opener(ev === 'DELETE' ? p.old : p.new); if (row) onChange(t, ev, row); };
      for (const t of TABLES) {
        channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: t, filter: 'couple_id=eq.' + coupleId }, relay(t, 'INSERT', open));
        channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: t, filter: 'couple_id=eq.' + coupleId }, relay(t, 'UPDATE', open));
        channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: t }, p => p.old && p.old.id && onChange(t, 'DELETE', { id: p.old.id }));
      }
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'couples', filter: 'id=eq.' + coupleId }, relay('couples', 'UPDATE', openCouple));
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'couple_id=eq.' + coupleId },
        async p => { const row = await openProfile(p.new); if (row) onChange('profiles', p.eventType, row); });
      channel.subscribe();
    },

    async savePushSubscription(sub, userId) {
      const json = sub.toJSON();
      chk(await sb.from('push_subscriptions').upsert({ endpoint: json.endpoint, user_id: userId, subscription: json }));
    },
    async sendPush({ title, body, tag }) {
      try {
        const c = await encryptJSON(key, { title, body });
        const { data, error } = await sb.functions.invoke('send-push', { body: { c, tag } });
        if (error) throw error;
        return data;
      } catch (e) { console.warn('Push nicht gesendet:', e.message || e); return null; }
    },
  };
}

// ------------------------------------------------------------------
//  Demo (localStorage). Simuliert eine Partnerin mit ein paar Einträgen.
// ------------------------------------------------------------------
export function createDemoBackend() {
  const KEY = 'duo-demo-db';
  const now = () => new Date().toISOString();
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  let db = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
  let listener = null;

  function seed() {
    const coupleId = uuid(), me = uuid(), partner = uuid();
    const created = new Date(Date.now() - 9 * 864e5).toISOString();
    db = {
      v: 2,
      user: { id: me, email: 'demo@example.invalid' },
      profiles: [
        { id: me, name: 'Du', avatar: '🦊', couple_id: coupleId, settings: {}, created_at: created },
        { id: partner, name: 'Sam', avatar: '🌸', couple_id: coupleId, settings: { shareWeight: true }, created_at: created },
      ],
      couples: [{ id: coupleId, code: 'DEMO42', settings: { difficulty: 'normal', stake: 'Wer verliert, kocht am Sonntag 🍝' }, created_at: created }],
      completions: [], custom_challenges: [], rewards: [], nudges: [], shopping_items: [], weights: [],
    };
    const d = (n) => { const x = new Date(); x.setDate(x.getDate() - n);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    const add = (user, n, kind, key, amount, points, hour = 18) => {
      const t = new Date(); t.setDate(t.getDate() - n); t.setHours(hour, 10, 0, 0);
      db.completions.push({ id: uuid(), couple_id: coupleId, user_id: user, date: d(n), kind, key, amount, points, created_at: t.toISOString() });
    };
    for (let n = 6; n >= 1; n--) {
      add(partner, n, 'daily', 'squats', 30, 15, 7);
      if (n % 2) add(partner, n, 'habit', 'water', 0, 10);
      if (n !== 3) add(me, n, 'daily', 'squats', 30, 15);
      if (n % 3 === 0) add(me, n, 'workout', 'start', 8, 25, 19);
    }
    add(partner, 2, 'workout', 'legs', 9, 25);
    add(partner, 1, 'log', 'pushups', 20, 5);
    add(me, 1, 'log', 'walk', 40, 5);
    add(partner, 0, 'log', 'pushups', 15, 5, 8);
    db.rewards.push({ id: uuid(), couple_id: coupleId, user_id: partner, title: 'Pizza-Abend 🍕', points: 500, redeemed_at: null, created_at: now() });
    db.shopping_items.push({ id: uuid(), couple_id: coupleId, user_id: partner, text: 'Magerquark', checked: false, created_at: now() });
    for (let n = 8; n >= 0; n -= 2) db.weights.push({ id: uuid(), couple_id: coupleId, user_id: me, date: d(n), weight: 84 - (8 - n) * 0.25, waist: null, shared: false, created_at: now() });
    save();
  }
  if (!db || db.v !== 2) seed();

  const emit = (t, ev, row) => setTimeout(() => listener && listener(t, ev, row), 0);
  const partnerId = () => db.profiles.find(p => p.id !== db.user.id).id;
  function partnerActs() {
    const row = { id: uuid(), couple_id: db.couples[0].id, user_id: partnerId(), date: new Date().toLocaleDateString('sv-SE'),
      kind: 'log', key: 'squats', amount: 20, points: 5, created_at: now() };
    db.completions.push(row); save(); emit('completions', 'INSERT', row);
  }

  return {
    demo: true,
    setKey() {},
    async getUser() { return db.user; },
    async signUp() { return { user: db.user, needsConfirm: false }; },
    async signIn() { return db.user; },
    async signOut() { localStorage.removeItem(KEY); db = null; seed(); },
    async resetPassword() {},
    onAuthChange() {},
    async updatePassword() {},
    async getProfile(id) { return db.profiles.find(p => p.id === id) || null; },
    async ensureProfile() {},
    async updateProfile(id, p) { Object.assign(db.profiles.find(x => x.id === id), { name: p.name, avatar: p.avatar, settings: p.settings }); save(); },
    async listProfiles(cid) { return db.profiles.filter(p => p.couple_id === cid); },
    async createCouple() { return db.couples[0]; },
    async joinCouple() { return db.couples[0]; },
    async getCoupleRaw(id) { return db.couples.find(c => c.id === id); },
    async decodeCouple(c) { return c ? JSON.parse(JSON.stringify(c)) : null; },
    async updateCouple(id, settings) { db.couples.find(x => x.id === id).settings = settings; save(); },
    async list(t, cid) { return JSON.parse(JSON.stringify(db[t].filter(r => r.couple_id === cid))); },
    async insert(t, row) {
      const r = { id: uuid(), created_at: now(), user_id: db.user.id, ...row };
      db[t].push(r); save();
      if (t === 'completions' && Math.random() < 0.3) setTimeout(partnerActs, 4000);
      return { ...r };
    },
    async update(t, id, full) { const r = db[t].find(x => x.id === id); if (r) Object.assign(r, full); save(); },
    async remove(t, id) { db[t] = db[t].filter(x => x.id !== id); save(); },
    subscribe(cid, cb) { listener = cb; },
    async savePushSubscription() {},
    async sendPush() { return { sent: 0 }; },
  };
}

export { uuid };
