/* Applies the Preferences (theme / language / units) on the whole app.
   Saved in the browser too, so the look is correct before the server answers. */

const KEY = "farmlink_appearance";
const DEFAULTS = { language: "en", theme: "light", units: "metric" };

export function getStoredAppearance() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAppearance(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...DEFAULTS, ...prefs }));
  } catch {
    /* storage blocked: ignore */
  }
}

// Other pages can call this: "metric" or "imperial".
export function getUnitSystem() {
  return getStoredAppearance().units;
}

function ensureStyle() {
  if (document.getElementById("farmlink-theme-style")) return;
  const style = document.createElement("style");
  style.id = "farmlink-theme-style";
  // Dark mode = invert the page, then flip photos/logos back.
  style.textContent = `
    html[data-theme="dark"] { filter: invert(1) hue-rotate(180deg); background: #fff; }
    html[data-theme="dark"] img, html[data-theme="dark"] video {
      filter: invert(1) hue-rotate(180deg);
    }`;
  document.head.appendChild(style);
}

export function applyAppearance(prefs) {
  const p = { ...DEFAULTS, ...prefs };
  ensureStyle();
  const dark =
    p.theme === "dark" ||
    (p.theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  document.documentElement.setAttribute("lang", p.language === "fil" ? "fil" : "en");
}

let started = false;
export function initAppearance() {
  if (started || typeof window === "undefined") return;
  started = true;
  applyAppearance(getStoredAppearance());
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    applyAppearance(getStoredAppearance());
  });
}