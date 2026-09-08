"use client";

import { useEffect } from "react";
import { FLASH_COOKIE } from "@/lib/flashCookie";

/**
 * Clears the flash cookie once its message has been shown.
 *
 * Without this the message reappears on the next page the user opens, which is
 * worse than not showing it: an error about a club follows them onto the
 * scoreboard and looks like a second, different failure. The cookie has a
 * 30-second expiry as a backstop, but the read happens here, immediately, so a
 * refresh of this same page is already clean.
 *
 * The X is for dismissing it early; the message is gone either way.
 */
export default function FlashDismiss() {
  useEffect(() => {
    document.cookie = `${FLASH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }, []);

  return (
    <button
      type="button"
      aria-label="Dismiss"
      onClick={(e) => e.currentTarget.closest("[role=alert]")?.remove()}
      className="-my-1 -mr-1 rounded px-2 py-1 text-lg leading-none text-red-400 hover:bg-red-100 hover:text-red-700"
    >
      ×
    </button>
  );
}
