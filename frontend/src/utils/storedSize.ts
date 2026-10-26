/**
 * Remembered panel sizes and collapsed states (localStorage). Reads are
 * defensive: junk or a throwing storage (private mode) gives null, and a
 * width comes back inside the panel's limits.
 */

type Store = Pick<Storage, "getItem" | "setItem"> | null | undefined;

function read(storage: Store, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(storage: Store, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Private mode: remembered for this page only.
  }
}

export function readStoredSize(
  storage: Store,
  key: string,
  min: number,
  max: number,
): number | null {
  const raw = read(storage, key);
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || raw.trim() === "") return null;
  return Math.min(max, Math.max(min, n));
}

export function writeStoredSize(storage: Store, key: string, n: number): void {
  write(storage, key, String(Math.round(n)));
}

export function readStoredFlag(storage: Store, key: string): boolean | null {
  const raw = read(storage, key);
  return raw === "1" ? true : raw === "0" ? false : null;
}

export function writeStoredFlag(
  storage: Store,
  key: string,
  on: boolean,
): void {
  write(storage, key, on ? "1" : "0");
}

/** The page's localStorage, or null (server, blocked). */
export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
