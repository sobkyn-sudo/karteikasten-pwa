// Cross-device sync, always on, no manual pairing.
//
// Three Redis hash buckets behind the same generic /api/sync endpoint:
//  - SHARED bucket (fixed code, every device): the word list + settings —
//    the thing you both study from should always match everywhere.
//  - Per-profile bucket (code = normalized profile name): that profile's
//    own progress/history. Nobody can find it without typing the exact name.
//  - DIRECTORY bucket (code derived from a passphrase): a small registry of
//    "which names exist", only ever read after the passphrase is confirmed
//    client-side, so its existence isn't discoverable by guessing.
//
// Within a bucket, sync is per-key, last-write-wins per key — not per blob —
// so two profiles' progress (different keys) never clobber each other.

export const progressKey = (uid) => `karteikasten-progress-${uid}`;
export const historyKey = (uid) => `karteikasten-history-${uid}`;

const SHARED_CODE = 'SHARED-WORDS';
const SHARED_KEYS = ['karteikasten-words', 'karteikasten-settings'];

const DIRECTORY_PASSPHRASE = 'Nour+Aya';
const DIRECTORY_CODE = codeFromName(DIRECTORY_PASSPHRASE);

const SYNC_META_KEY = 'SYNC_META'; // { [storageKey]: lastModifiedAt }
const SYNC_PUSHED_KEY = 'SYNC_PUSHED'; // { [storageKey]: lastPushedAt }
const SYNC_LAST_SYNCED_KEY = 'SYNC_LAST_SYNCED_AT';
const RESERVED_KEYS = [SYNC_META_KEY, SYNC_PUSHED_KEY, SYNC_LAST_SYNCED_KEY];

const PUSH_DEBOUNCE_MS = 2000;
let pushTimer = null;

// Which profile bucket + keys are "live" right now — set whenever the active
// profile is established (on load, on switch, on create).
let profileCode = null;
let profileKeys = [];

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function codeFromName(name) {
  const sanitized = String(name || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  return sanitized.slice(0, 24) || 'X';
}

export function normalizeUsername(name) {
  return String(name || '').trim().toLowerCase();
}

export function setActiveProfileForSync(id, name) {
  profileCode = codeFromName(normalizeUsername(name));
  profileKeys = [progressKey(id), historyKey(id)];
  console.log(`[sync] active profile scope -> ${profileCode} (id=${id}, keys=${profileKeys.join(', ')})`);
}

export function getLastSyncedAt() {
  const raw = localStorage.getItem(SYNC_LAST_SYNCED_KEY);
  return raw ? Number(raw) : null;
}

function activeBuckets() {
  const buckets = [{ code: SHARED_CODE, keys: SHARED_KEYS }];
  if (profileCode) buckets.push({ code: profileCode, keys: profileKeys });
  return buckets;
}

// Called by storage.js after every local write/delete.
export function markChanged(key) {
  const isShared = SHARED_KEYS.includes(key);
  const isProfile = profileKeys.includes(key);
  if (!isShared && !isProfile) {
    console.log(`[sync] markChanged(${key}) — not a synced key, ignored (profileKeys=${profileKeys.join(',') || 'none'})`);
    return;
  }

  console.log(`[sync] markChanged(${key}) — scheduling push in ${PUSH_DEBOUNCE_MS}ms`);
  const meta = readJson(SYNC_META_KEY, {});
  meta[key] = Date.now();
  writeJson(SYNC_META_KEY, meta);
  schedulePush();
}

function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushSync(); }, PUSH_DEBOUNCE_MS);
}

async function pushBucket(code, keys) {
  const meta = readJson(SYNC_META_KEY, {});
  const pushed = readJson(SYNC_PUSHED_KEY, {});
  const entries = {};
  for (const key of keys) {
    if (RESERVED_KEYS.includes(key)) continue;
    if (meta[key] > (pushed[key] || 0)) {
      const value = localStorage.getItem(key);
      // Never push empty profile data — it has nothing to contribute and must
      // not risk landing on top of a real cloud copy.
      if (isProfileDataKey(key) && isEmptyProfileData(key, value)) {
        console.log(`[sync] push ${code}: skipping empty ${key}`);
        continue;
      }
      entries[key] = { value, updatedAt: meta[key] };
    }
  }
  if (Object.keys(entries).length === 0) {
    console.log(`[sync] push ${code}: nothing pending`);
    return;
  }

  console.log(`[sync] push ${code}:`, Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, v.value?.slice?.(0, 80) ?? v.value])));
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, entries }),
    });
    if (!res.ok) {
      console.log(`[sync] push ${code} FAILED:`, res.status);
      return;
    }
    for (const key of Object.keys(entries)) pushed[key] = entries[key].updatedAt;
    writeJson(SYNC_PUSHED_KEY, pushed);
  } catch (e) {
    console.log(`[sync] push ${code} ERROR:`, e);
    // offline or request failed — next markChanged will retry the same diff
  }
}

export async function pushSync() {
  for (const { code, keys } of activeBuckets()) await pushBucket(code, keys);
  localStorage.setItem(SYNC_LAST_SYNCED_KEY, String(Date.now()));
}

async function fetchBucket(code) {
  try {
    const res = await fetch(`/api/sync?code=${encodeURIComponent(code)}`);
    if (!res.ok) return null;
    const { entries } = await res.json();
    return entries || null;
  } catch (e) {
    return null;
  }
}

function isProgressKey(key) { return key.startsWith('karteikasten-progress-'); }
function isHistoryKey(key) { return key.startsWith('karteikasten-history-'); }
function isProfileDataKey(key) { return isProgressKey(key) || isHistoryKey(key); }

// "Empty" = a just-created profile that hasn't actually studied anything yet.
// This is the linchpin of the whole design: empty profile data must never win
// over real data, in either direction (never pulled in over real local, never
// pushed up over real cloud). A fresh tab / incognito window therefore can only
// ever pull, never reset.
function isEmptyProfileData(key, raw) {
  if (raw == null || raw === '') return true;
  try {
    const parsed = JSON.parse(raw);
    if (isHistoryKey(key)) return !Array.isArray(parsed) || parsed.length === 0;
    return !Object.values(parsed).some(
      (p) => (p?.seen || 0) > 0 || (p?.box || 1) > 1 || (p?.articleSeen || 0) > 0 || (p?.articleBox || 1) > 1
    );
  } catch (e) {
    return true;
  }
}

// Latest-wins per key (by timestamp), with one hard guard: real profile data is
// never replaced by empty. Between two *real* states the newer one wins, which
// matches "always continue from the latest device" since each device pulls
// before it studies.
function applyEntries(entries, allowedKeys) {
  const meta = readJson(SYNC_META_KEY, {});
  const pushed = readJson(SYNC_PUSHED_KEY, {});
  let bookkeepingChanged = false; // any timestamp advanced — must persist regardless
  let contentChanged = false; // actual local data changed — only this warrants a reload
  for (const [key, remote] of Object.entries(entries)) {
    if (allowedKeys && !allowedKeys.includes(key)) continue;
    if (remote.updatedAt > (meta[key] || 0)) {
      const current = localStorage.getItem(key);
      const incoming = remote.value ?? null;

      // Guard: never let empty profile data overwrite real local data.
      // Leave our timestamps untouched so our real data re-pushes and heals
      // whatever empty value is sitting in the cloud.
      if (isProfileDataKey(key) && !isEmptyProfileData(key, current) && isEmptyProfileData(key, incoming)) {
        console.log(`[sync] REFUSED ${key}: cloud is empty, keeping real local progress`);
        continue;
      }

      meta[key] = remote.updatedAt;
      pushed[key] = remote.updatedAt;
      bookkeepingChanged = true;

      if (current === incoming) continue; // identical content, no reload needed

      console.log(`[sync] apply ${key}:`, incoming == null ? '(deleted)' : String(incoming).slice(0, 100));
      if (incoming === null) localStorage.removeItem(key);
      else localStorage.setItem(key, incoming);
      contentChanged = true;
    }
  }
  if (bookkeepingChanged) {
    writeJson(SYNC_META_KEY, meta);
    writeJson(SYNC_PUSHED_KEY, pushed);
  }
  return contentChanged;
}

// Pulls remote state for the active buckets and applies anything newer than
// what we have locally. Returns true if anything changed (caller should reload).
export async function pullSync() {
  let changed = false;
  for (const { code, keys } of activeBuckets()) {
    const entries = await fetchBucket(code);
    if (entries && applyEntries(entries, keys)) changed = true;
  }
  localStorage.setItem(SYNC_LAST_SYNCED_KEY, String(Date.now()));
  return changed;
}

export async function syncNow() {
  await pushSync();
  return pullSync();
}

// Migration: marks local data that the cloud doesn't already have, so it gets
// pushed up once. MUST be called AFTER an initial pull — a key the cloud
// already provided is now in `meta` and is skipped here, so pre-sync local data
// can never be stamped "now" and clobber a newer cloud copy. Empty profile data
// is never marked (nothing to migrate).
export function markLocalDataForMigration() {
  const meta = readJson(SYNC_META_KEY, {});
  let changedAny = false;
  for (const { keys } of activeBuckets()) {
    for (const key of keys) {
      if (key in meta) continue; // cloud already had it (or we already track it)
      const val = localStorage.getItem(key);
      if (val == null) continue;
      if (isProfileDataKey(key) && isEmptyProfileData(key, val)) continue;
      meta[key] = Date.now();
      changedAny = true;
    }
  }
  if (changedAny) writeJson(SYNC_META_KEY, meta);
}

// The correct order for establishing sync when a profile becomes active
// (app load, profile switch/create): pull the cloud's latest first (cloud wins
// for an existing profile), THEN migrate up anything local the cloud lacked.
export async function establishSync() {
  const pulled = await pullSync();
  markLocalDataForMigration();
  await pushSync();
  return pulled;
}

// One-shot lookup: does a profile already exist under this name in the cloud?
// If so, pulls its progress/history into localStorage and returns its id.
export async function resolveUsername(name) {
  const code = codeFromName(normalizeUsername(name));
  const entries = await fetchBucket(code);
  console.log(`[sync] resolveUsername("${name}") -> bucket ${code}:`, entries ? Object.keys(entries) : 'not found');
  if (!entries || !entries.__profile_id__) return null;

  // __profile_id__ is stored as a plain string via HSETNX (see api/sync.js),
  // not the {value, updatedAt} envelope every other field uses — read it raw.
  const id = entries.__profile_id__;
  const displayName = entries.__profile_name__?.value || name;
  console.log(`[sync] resolveUsername("${name}") found id ${id}, applying progress/history`);
  applyEntries(entries, [progressKey(id), historyKey(id)]);
  return { id, name: displayName };
}

// Atomically claims a name for a profile id — uses Redis HSETNX server-side,
// so if two devices try to register the same brand-new name at the same
// instant, only one wins; the other gets told the winning id back instead of
// silently overwriting it (which is what caused real progress to become
// unreachable-by-name in testing — a race, not a one-off fluke).
export async function claimUsername(name, id) {
  const code = codeFromName(normalizeUsername(name));
  const now = Date.now();
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      claimId: id,
      entries: { __profile_name__: { value: name, updatedAt: now } },
    }),
  });
  const { claimed, ownerId } = await res.json();
  console.log(`[sync] claimUsername("${name}", ${id}) -> claimed=${claimed}, ownerId=${ownerId}`);
  if (claimed) {
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: DIRECTORY_CODE,
        entries: { [normalizeUsername(name)]: { value: name, updatedAt: now } },
      }),
    }).catch(() => {});
  }
  return { claimed, ownerId };
}

export function checkDirectoryPassphrase(input) {
  return input === DIRECTORY_PASSPHRASE;
}

export async function fetchDirectory() {
  const entries = await fetchBucket(DIRECTORY_CODE);
  if (!entries) return [];
  return Object.values(entries).map((e) => e.value);
}

// Deletes a profile's cloud data entirely: its bucket (progress/history/identity)
// and its entry in the passphrase-gated directory.
export async function deleteProfileCloud(name) {
  const code = codeFromName(normalizeUsername(name));
  await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, deleteBucket: true }),
  }).catch(() => {});
  await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: DIRECTORY_CODE, removeField: normalizeUsername(name) }),
  }).catch(() => {});
}

// Removes a profile's data from THIS device: its stored progress/history plus
// the sync bookkeeping for those keys, so a later re-add starts clean.
export function forgetLocalProfileData(id) {
  const keys = [progressKey(id), historyKey(id)];
  const meta = readJson(SYNC_META_KEY, {});
  const pushed = readJson(SYNC_PUSHED_KEY, {});
  for (const key of keys) {
    localStorage.removeItem(key);
    delete meta[key];
    delete pushed[key];
  }
  writeJson(SYNC_META_KEY, meta);
  writeJson(SYNC_PUSHED_KEY, pushed);
}
