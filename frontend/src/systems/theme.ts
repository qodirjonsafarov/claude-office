/**
 * The colour theme (wave 3 draft): dark (default), light, or follow the OS.
 * Kept in localStorage, not in the backend preferences, so the boot script in
 * app/layout.tsx can set `data-theme` on <html> before the first paint.
 */

export type ThemePref = "dark" | "light" | "system";
export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "qo-theme";

export function parseThemePref(raw: string | null | undefined): ThemePref {
  return raw === "light" || raw === "system" || raw === "dark" ? raw : "dark";
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): Theme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

/**
 * The boot script, inlined in <head>: theme and office tint before paint.
 * Mirrors parseThemePref / resolveTheme / parseSceneTint.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;var p=localStorage.getItem("${THEME_STORAGE_KEY}");if(p!=="light"&&p!=="system")p="dark";var t=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;d.dataset.theme=t;var q=new URLSearchParams(location.search).get("tint");d.dataset.tint=q&&q.toLowerCase()==="b"?"b":"a";}catch(e){}})();`;
