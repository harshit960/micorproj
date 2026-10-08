import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let waitingWorker: ServiceWorker | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function registerPWA() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });

  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const track = (w: ServiceWorker | null) => {
        if (!w) return;
        w.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) {
            waitingWorker = w;
            notify();
          }
        });
      };
      if (reg.waiting && navigator.serviceWorker.controller) {
        waitingWorker = reg.waiting;
        notify();
      }
      reg.addEventListener("updatefound", () => track(reg.installing));
      // Check for a new deploy whenever the app comes back to the foreground.
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && reg.update());
    } catch {
      /* SW unsupported or blocked: app still works online */
    }
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading || !waitingWorker) return;
    reloading = true;
    location.reload();
  });
}

export function usePWA() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return {
    canInstall: !!deferredPrompt && !isStandalone(),
    showIOSHint: isIOS() && !isStandalone(),
    installed: isStandalone(),
    updateReady: !!waitingWorker,
    async install() {
      if (!deferredPrompt) return;
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      notify();
    },
    applyUpdate() {
      waitingWorker?.postMessage("skipWaiting");
    },
  };
}
