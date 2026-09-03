"use client";

import { useEffect, useState } from "react";

/**
 * Installing the judge pad, and keeping it working offline.
 *
 * Two jobs that belong together because both only make sense on this one page:
 * registering the service worker so the pad opens without a signal, and
 * offering the browser's install prompt so it goes on the home screen.
 *
 * The prompt is offered rather than nagged. Chrome hands over a deferred event
 * exactly once per eligible visit, and it is spent on a button the judge chose
 * to press — a dialog thrown at somebody who has just been handed a phone and a
 * seat number is one more thing between them and the buttons.
 */

/** Chrome's install event, which isn't in the DOM types. */
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function JudgeAppSetup() {
  const [offer, setOffer] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Scoped to this page, so nothing it caches can reach the admin side.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/public/judge" }).catch(() => {
        // An unregistered worker costs offline opening, not scoring — presses
        // are queued by the page itself either way. Not worth telling a judge
        // about mid-event.
      });
    }

    // Already running from the home screen: there is nothing to offer.
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);

    const held = (event: Event) => {
      event.preventDefault();
      setOffer(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", held);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", held);
  }, []);

  if (installed || !offer) return null;

  return (
    <button
      type="button"
      className="btn-secondary w-full"
      onClick={() => {
        void offer.prompt();
        void offer.userChoice.finally(() => setOffer(null));
      }}
    >
      Add to home screen — works when the wifi drops
    </button>
  );
}
