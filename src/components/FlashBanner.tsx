import { readFlash } from "@/lib/flash";
import FlashDismiss from "./FlashDismiss";

/**
 * The banner that carries a failed action's explanation back to the screen.
 *
 * Sits in the layout so every page gets it without having to remember to ask.
 * Renders nothing at all when there is nothing to say.
 */
export default function FlashBanner() {
  const message = readFlash();
  if (!message) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm"
    >
      <span aria-hidden className="mt-px font-bold leading-none">!</span>
      <p className="flex-1">{message}</p>
      <FlashDismiss />
    </div>
  );
}
