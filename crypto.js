// Ende-zu-Ende-Verschlüsselung (AES-256-GCM, Schlüssel per PBKDF2 aus eurem Paar-Schlüssel).
// Der Server bekommt nur verschlüsselte Daten. Der Schlüssel bleibt auf euren Geräten.
const te = new TextEncoder(), td = new TextDecoder();
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // ohne I, L, O, 0, 1 (Verwechslungsgefahr)

export function b64(bytes) {
  let s = ''; const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(str) { return Uint8Array.from(atob(str), c => c.charCodeAt(0)); }
export const b64url = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64url = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

// 20 Zeichen ≈ 99 Bit Zufall, z. B. "K7QM-2XPA-RT9C-HW4E-NZ8B"
export function newSecret() {
  const out = [];
  while (out.length < 20) {
    const buf = crypto.getRandomValues(new Uint8Array(32));
    for (const x of buf) if (x < 248 && out.length < 20) out.push(ALPHABET[x % 31]);
  }
  return out.join('').match(/.{4}/g).join('-');
}
export function normalizeSecret(s) {
  const clean = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').split('').filter(c => ALPHABET.includes(c)).join('');
  return clean.length === 20 ? clean.match(/.{4}/g).join('-') : null;
}
export const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));

export async function deriveKey(secret, saltB64) {
  const base = await crypto.subtle.importKey('raw', te.encode(secret.replace(/-/g, '')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: 210000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptJSON(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)));
  const out = new Uint8Array(12 + ct.byteLength); out.set(iv); out.set(new Uint8Array(ct), 12);
  return 'v1:' + b64(out);
}
export async function decryptJSON(key, str) {
  if (!str || !str.startsWith('v1:')) throw new Error('Unbekanntes Format');
  const raw = unb64(str.slice(3));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, key, raw.subarray(12));
  return JSON.parse(td.decode(pt));
}
export const KEY_CHECK = 'duo-schluessel-ok';

// ---- Lokaler Speicher (IndexedDB) – auch der Service Worker liest hier für Push ----
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('duo', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export async function kvGet(k) {
  const db = await idb();
  return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
export async function kvSet(k, v) {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}
export async function kvDel(k) {
  const db = await idb();
  return new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => res(); t.onerror = () => res(); });
}
