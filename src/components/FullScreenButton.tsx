"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Filling the screen with the board.
 *
 * Two things happen, and both are needed.
 *
 * The browser is asked for real full screen, which also takes away the address
 * bar and the tabs. That can be refused — an embedded page, or a browser with
 * it turned off — and it is refused silently, so nothing here depends on it
 * having worked.
 *
 * Independently, the board is laid over the whole window, which hides this
 * site's own header and page margins. That is plain CSS and always works. It
 * is what makes the picture on the projector the scoreboard and nothing else,
 * whether or not the browser played along.
 *
 * Escape leaves. Browsers insist on that for full screen and will not let a
 * page hold it, so the overlay follows the same rule rather than leaving
 * somebody stuck in a screen with no way out.
 */

export type FullScreen = {
  big: boolean;
  toggle: () => void;
  /** False once the mouse has been still a while, so the button gets out of the way. */
  showControls: boolean;
};

export function useFullScreen(ref: { current: HTMLElement | null }): FullScreen {
  const [big, setBig] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideAt = useRef<any>(null);

  const toggle = useCallback(() => {
    const element = ref.current;
    setBig((wasBig) => {
      if (wasBig) {
        if (typeof document !== "undefined" && document.fullscreenElement) {
          void document.exitFullscreen?.().catch(() => {});
        }
        return false;
      }
      // Asked for, not relied on: a refusal still leaves the overlay, which is
      // the part that hides the site's header.
      void element?.requestFullscreen?.().catch(() => {});
      return true;
    });
  }, [ref]);

  // Escape, or the browser's own full-screen control, leaves without telling
  // us — so the overlay listens rather than assuming it is still in charge.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setBig(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBig(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // A projected board should be the board. The button fades out when the mouse
  // stops and comes back the moment it moves.
  useEffect(() => {
    if (!big) { setShowControls(true); return; }
    const wake = () => {
      setShowControls(true);
      clearTimeout(hideAt.current);
      hideAt.current = setTimeout(() => setShowControls(false), 3000);
    };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("touchstart", wake);
    return () => {
      clearTimeout(hideAt.current);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("touchstart", wake);
    };
  }, [big]);

  return { big, toggle, showControls };
}

export default function FullScreenButton({
  big,
  showControls,
  onToggle,
}: {
  big: boolean;
  showControls: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={big ? "Leave full screen (Esc)" : "Fill the screen"}
      aria-label={big ? "Leave full screen" : "Fill the screen"}
      className={`absolute right-3 top-3 z-10 rounded-md border border-white/25 bg-black/40 px-3 py-1.5 text-sm font-medium text-white backdrop-blur transition-opacity hover:bg-black/60 ${
        showControls ? "opacity-70 hover:opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {big ? "Exit full screen" : "Full screen"}
    </button>
  );
}
