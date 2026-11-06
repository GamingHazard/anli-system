"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isSafariIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [showSafariHint, setShowSafariHint] = useState(false);

  useEffect(() => {
    const supportsMatchMedia = typeof window.matchMedia === "function";
    const browserIsInstalled = window.matchMedia
      ? window.matchMedia("(display-mode: standalone)").matches
      : false;

    if (browserIsInstalled || !window.isSecureContext) {
      return;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => undefined);
    }

    if (
      supportsMatchMedia &&
      !window.matchMedia("(display-mode: browser)").matches
    ) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setCanInstall(false);
      setShowSafariHint(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (isSafariIOS()) {
      setShowSafariHint(true);
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setCanInstall(false);
  };

  if (showSafariHint) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-xs rounded-xl border border-sky-200 bg-white/95 p-3 text-left text-xs text-slate-700 shadow-lg shadow-slate-200/80 backdrop-blur-sm">
        <p className="font-semibold text-slate-800">Install this app</p>
        <p className="mt-1">
          On iPhone or iPad, tap Share and choose “Add to Home Screen”.
        </p>
      </div>
    );
  }

  if (!canInstall || !installPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-900/20 transition hover:bg-violet-600"
      >
        Install app
      </button>
    </div>
  );
}
