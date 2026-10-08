import { useEffect, useState } from "react";

// Per-device display preferences (not synced: privacy & theme are about this screen).
export type Theme = "system" | "light" | "dark";

const read = (k: string, d: string) => {
  try {
    return localStorage.getItem(k) ?? d;
  } catch {
    return d;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

let theme = read("kosh:theme", "system") as Theme;
let hidden = read("kosh:hide", "0") === "1";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const amountsHidden = () => hidden;

export function applyTheme() {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? "#0e0e11" : "#f4f3ef"));
}

export function usePrefs() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return {
    theme,
    hidden,
    setTheme(t: Theme) {
      theme = t;
      write("kosh:theme", t);
      applyTheme();
      notify();
    },
    toggleHidden() {
      hidden = !hidden;
      write("kosh:hide", hidden ? "1" : "0");
      notify();
    },
  };
}
