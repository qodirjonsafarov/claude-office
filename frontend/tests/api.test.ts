// @vitest-environment happy-dom
/**
 * The access-token intake in utils/api.ts: the ?token= key must survive a new
 * tab (localStorage, not sessionStorage), work when storage is blocked, and a
 * 401 must raise the "paste access token" prompt instead of failing silently.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Api = typeof import("../src/utils/api");

/** A fresh copy of the module, like a new tab loading the page. */
async function freshApi(): Promise<Api> {
  vi.resetModules();
  return import("../src/utils/api");
}

function openPage(search: string): void {
  window.history.replaceState({}, "", `/${search}`);
}

describe("api key intake", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    openPage("");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the ?token= key for a new tab", async () => {
    openPage("?token=abc123");
    (await freshApi()).initApiKeyFromBrowser();

    // A new tab starts with an empty sessionStorage.
    sessionStorage.clear();
    openPage("");
    const nextTab = await freshApi();
    nextTab.initApiKeyFromBrowser();
    expect(nextTab.getApiKey()).toBe("abc123");
  });

  it("strips the token from the address bar", async () => {
    openPage("?token=abc123&debug=1");
    (await freshApi()).initApiKeyFromBrowser();
    expect(window.location.search).toBe("?debug=1");
  });

  it("picks up a key an older build left in sessionStorage", async () => {
    sessionStorage.setItem("claude-office-api-key", "legacy");
    const api = await freshApi();
    api.initApiKeyFromBrowser();
    expect(api.getApiKey()).toBe("legacy");
    expect(localStorage.getItem("claude-office-api-key")).toBe("legacy");
  });

  it("still uses the key in memory when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    openPage("?token=abc123");
    const api = await freshApi();
    expect(() => api.initApiKeyFromBrowser()).not.toThrow();
    expect(api.getApiKey()).toBe("abc123");
  });

  it("saves a pasted key for later tabs", async () => {
    const api = await freshApi();
    api.saveApiKey("  pasted  ");
    expect(api.getApiKey()).toBe("pasted");

    const nextTab = await freshApi();
    nextTab.initApiKeyFromBrowser();
    expect(nextTab.getApiKey()).toBe("pasted");
  });
});

describe("extractToken", () => {
  it("takes a bare key as it is", async () => {
    const { extractToken } = await freshApi();
    expect(extractToken(" abc123 ")).toBe("abc123");
  });

  it("takes the key out of a pasted launch URL", async () => {
    const { extractToken } = await freshApi();
    expect(extractToken("http://localhost:3000/?token=abc123")).toBe("abc123");
  });

  it("returns null for an empty paste", async () => {
    const { extractToken } = await freshApi();
    expect(extractToken("   ")).toBeNull();
  });
});

describe("auth required", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(status: number): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(async () => new Response("{}", { status }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("flags a 401 and tells the listeners", async () => {
    const api = await freshApi();
    stubFetch(401);
    const seen: boolean[] = [];
    api.subscribeAuthRequired(() => seen.push(api.isAuthRequired()));

    await api.apiFetch("/api/v1/sessions");

    expect(api.isAuthRequired()).toBe(true);
    expect(seen).toEqual([true]);
  });

  it("flags a request the browser blocked while the server is up (401 without CORS headers)", async () => {
    const api = await freshApi();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/health")) return new Response("{}", { status: 200 });
        throw new TypeError("NetworkError when attempting to fetch resource.");
      }),
    );
    await expect(api.apiFetch("/api/v1/sessions")).rejects.toThrow(TypeError);
    expect(api.isAuthRequired()).toBe(true);
  });

  it("does not flag a server that is down", async () => {
    const api = await freshApi();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("NetworkError when attempting to fetch resource.");
      }),
    );
    await expect(api.apiFetch("/api/v1/sessions")).rejects.toThrow(TypeError);
    expect(api.isAuthRequired()).toBe(false);
  });

  it("does not flag other responses", async () => {
    const api = await freshApi();
    stubFetch(200);
    await api.apiFetch("/api/v1/sessions");
    expect(api.isAuthRequired()).toBe(false);
  });

  it("clears the flag once a key is saved", async () => {
    const api = await freshApi();
    stubFetch(401);
    await api.apiFetch("/api/v1/sessions");
    api.saveApiKey("new-key");
    expect(api.isAuthRequired()).toBe(false);
  });

  it("loads the stored key on the first request, before any init call", async () => {
    localStorage.setItem("claude-office-api-key", "stored");
    const api = await freshApi();
    const fetchMock = stubFetch(200);
    await api.apiFetch("/api/v1/floors");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("X-API-Key")).toBe("stored");
  });

  it("sends the saved key", async () => {
    const api = await freshApi();
    const fetchMock = stubFetch(200);
    api.saveApiKey("k1");
    await api.apiFetch("/api/v1/floors");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("X-API-Key")).toBe("k1");
  });
});

describe("sendPrompt", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the text with the key to the session's prompt route", async () => {
    const api = await freshApi();
    api.saveApiKey("k1");
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: "sent" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.sendPrompt("abc-123", "hello");

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url.endsWith("/api/v1/sessions/abc-123/prompt")).toBe(true);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ text: "hello" });
    const headers = new Headers(init.headers);
    expect(headers.get("X-API-Key")).toBe("k1");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("returns the backend's reason and message on a refusal", async () => {
    const api = await freshApi();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              detail: {
                reason: "not_claude",
                message: "The tmux pane is not running Claude",
              },
            }),
            { status: 409 },
          ),
      ),
    );
    expect(await api.sendPrompt("s1", "hi")).toEqual({
      ok: false,
      reason: "not_claude",
      message: "The tmux pane is not running Claude",
    });
  });

  it("explains a validation error without a reason", async () => {
    const api = await freshApi();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ detail: [{ msg: "too long" }] }), {
            status: 422,
          }),
      ),
    );
    const result = await api.sendPrompt("s1", "hi");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toBe("Could not send (422)");
  });

  it("reports an unreachable backend", async () => {
    const api = await freshApi();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("NetworkError");
      }),
    );
    expect(await api.sendPrompt("s1", "hi")).toEqual({
      ok: false,
      reason: null,
      message: "Could not reach the office backend",
    });
  });

  it("encodes the session id in the path", async () => {
    const api = await freshApi();
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await api.sendPrompt("a/b", "hi");
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url.endsWith("/api/v1/sessions/a%2Fb/prompt")).toBe(true);
  });
});
