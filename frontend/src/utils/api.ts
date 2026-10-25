/**
 * Minimal API helper for authenticated requests to the backend.
 *
 * The backend no longer returns the API key over HTTP (SEC-001). Instead the
 * key is delivered out-of-band via a ?token= launch URL printed to the server
 * console; initApiKeyFromBrowser captures it into localStorage (so new tabs
 * and the phone stay connected). A 401 raises the paste-token prompt.
 */

/**
 * Backend origin. Explicit env wins; otherwise derive from the page itself:
 * `next dev` talks to the backend on :8000 regardless of the port Next picked
 * (3000 may be taken and auto-incremented); built output (Docker,
 * SERVE_STATIC) is same-origin so the port never needs configuring.
 */
function backendOrigin(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === "undefined") return "http://localhost:8000";
  const { protocol, hostname, origin } = window.location;
  if (process.env.NODE_ENV === "development") {
    return `${protocol}//${hostname}:8000`;
  }
  return origin;
}

export const API_BASE = backendOrigin();
export const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL || API_BASE.replace(/^http/, "ws");

const KEY_STORAGE = "claude-office-api-key";

let _apiKey: string | null = null;
let _initialized = false;
let _authRequired = false;
const _authListeners = new Set<() => void>();

function readStored(storage: () => Storage): string | null {
  try {
    return storage().getItem(KEY_STORAGE);
  } catch {
    return null; // storage blocked (private mode, strict cookie settings)
  }
}

/** Keep the key in localStorage so new tabs and reloads stay connected. */
function persistKey(key: string): void {
  try {
    localStorage.setItem(KEY_STORAGE, key);
  } catch {
    // localStorage unavailable; the key stays in memory for this tab only.
  }
}

function setAuthRequired(required: boolean): void {
  if (_authRequired === required) return;
  _authRequired = required;
  for (const listener of _authListeners) listener();
}

/** Store the API key in memory (no persistence). */
export function setApiKey(key: string): void {
  _apiKey = key;
}

/** Retrieve the cached API key. */
export function getApiKey(): string | null {
  return _apiKey;
}

/** Store and persist a key the user pasted, and clear the auth prompt. */
export function saveApiKey(key: string): void {
  const trimmed = key.trim();
  setApiKey(trimmed);
  persistKey(trimmed);
  setAuthRequired(false);
}

/**
 * The key from what the user pasted: either the bare key or the whole launch
 * URL with ?token=. Null when nothing usable was pasted.
 */
export function extractToken(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (text.includes("token=")) {
    try {
      const token = new URL(text, "http://localhost").searchParams.get("token");
      if (token) return token;
    } catch {
      // not a URL; fall through to the bare value
    }
  }
  return text;
}

/** True after the backend answered 401 and no new key was saved since. */
export function isAuthRequired(): boolean {
  return _authRequired;
}

/** Listen for auth-required changes (useSyncExternalStore-compatible). */
export function subscribeAuthRequired(listener: () => void): () => void {
  _authListeners.add(listener);
  return () => {
    _authListeners.delete(listener);
  };
}

/**
 * Read ?token= from the URL (stripping it from history), else the saved key.
 * A key an older build left in sessionStorage is moved to localStorage.
 */
export function initApiKeyFromBrowser(): void {
  if (typeof window === "undefined") return;
  _initialized = true;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) {
    setApiKey(token);
    persistKey(token);
    params.delete("token");
    const qs = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (qs ? `?${qs}` : ""),
    );
    return;
  }
  const stored = readStored(() => localStorage);
  if (stored) {
    setApiKey(stored);
    return;
  }
  const legacy = readStored(() => sessionStorage);
  if (legacy) {
    setApiKey(legacy);
    persistKey(legacy);
  }
}

/** Fetch wrapper that attaches X-API-Key and raises the prompt on a 401. */
export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  // Hooks may fetch before the page's init effect ran: load the key first.
  if (!_initialized) initApiKeyFromBrowser();
  const headers = new Headers(init?.headers);
  if (_apiKey) {
    headers.set("X-API-Key", _apiKey);
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch (error) {
    // The backend's 401 carries no CORS headers, so the browser reports it
    // as a network error. If the server is up (/health is public), it was
    // the key.
    if (await serverIsUp()) setAuthRequired(true);
    throw error;
  }
  if (res.status === 401) setAuthRequired(true);
  return res;
}

async function serverIsUp(): Promise<boolean> {
  try {
    return (await fetch(`${API_BASE}/health`)).ok;
  } catch {
    return false;
  }
}
