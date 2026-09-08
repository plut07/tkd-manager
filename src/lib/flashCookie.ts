/**
 * The flash cookie's name, on its own.
 *
 * `flash.ts` is `server-only` — importing it from the client component that
 * clears the cookie would be a build error. The name is the one thing both
 * sides need, so it lives here rather than being written out twice and drifting.
 */
export const FLASH_COOKIE = "tkd_flash";
