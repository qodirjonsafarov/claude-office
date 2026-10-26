/**
 * The colour theme: dark, light, or follow the OS (the default).
 * Kept in localStorage, not in the backend preferences, so the boot script in
 * app/layout.tsx can set `data-theme` on <html> before the first paint.
 */

export type ThemePref = "dark" | "light" | "system";
export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "qo-theme";

export function parseThemePref(raw: string | null | undefined): ThemePref {
  return raw === "light" || raw === "system" || raw === "dark" ? raw : "system";
}

/** The browser bar colour of a theme. Mirrors --qo-bg in styles/tokens.css. */
export const THEME_COLORS: Record<Theme, string> = {
  dark: "#080d0c",
  light: "#f8faf8",
};

export function themeColorFor(theme: Theme): string {
  return THEME_COLORS[theme];
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): Theme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

/**
 * The boot script, inlined in <head>: the theme before the first paint, and
 * the browser bar colour to match. Mirrors parseThemePref / resolveTheme /
 * themeColorFor.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;var p=localStorage.getItem("${THEME_STORAGE_KEY}");if(p!=="light"&&p!=="dark")p="system";var t=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;d.dataset.theme=t;var c=t==="light"?"${THEME_COLORS.light}":"${THEME_COLORS.dark}";document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",c)});}catch(e){}})();`;
