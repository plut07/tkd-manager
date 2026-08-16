/**
 * Where event photos live.
 *
 * Kept out of the server-action file because a "use server" module may only
 * export async functions — a plain constant there fails the build.
 */
export const PHOTO_BUCKET = "event-photos";
