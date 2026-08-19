/**
 * Where event photos live.
 *
 * Kept out of the server-action file because a "use server" module may only
 * export async functions — a plain constant there fails the build.
 */
export const PHOTO_BUCKET = "event-photos";

/** What a photo is for. */
export type PhotoKind = "background" | "header" | "gallery";

export const PHOTO_KINDS: { value: PhotoKind; label: string; note: string }[] = [
  {
    value: "header",
    label: "Header photo",
    note: "The event's highlight image — shown on the events list and across the top of the event page.",
  },
  {
    value: "background",
    label: "Background photo",
    note: "Sits behind the public event page, dimmed so the text stays readable.",
  },
  { value: "gallery", label: "Gallery", note: "Everything else, shown as a grid." },
];
