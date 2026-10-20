// Remembers which old-system notifications a user has already read.
// The old notifications have no "read" flag on the server, so we keep it in the browser.

function storageKey(uid) {
  return `farmlink:legacyRead:${uid ?? "me"}`;
}

// Returns a new Set of string ids every time, so React state updates correctly.
export function getLegacyRead(uid) {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(uid)) || "[]");
    return new Set(Array.isArray(raw) ? raw.map(String) : []);
  } catch {
    return new Set();
  }
}

// Adds one or more ids to the read list.
export function addLegacyRead(uid, ids) {
  try {
    const set = getLegacyRead(uid);
    (ids || []).forEach((id) => set.add(String(id)));
    localStorage.setItem(storageKey(uid), JSON.stringify([...set].slice(-300)));
  } catch {
    /* ignore storage errors */
  }
}