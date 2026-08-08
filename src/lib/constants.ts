// Deliberately free of any server-only / next/headers imports so this can
// be safely imported from middleware.ts (Edge runtime) as well as regular
// server code.
export const SESSION_COOKIE_NAME = "tkd_session";
