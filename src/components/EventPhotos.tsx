"use client";

import { useFormState, useFormStatus } from "react-dom";
import { uploadEventPhoto, deleteEventPhoto, type PhotoState } from "@/app/(app)/events/photoActions";
import { PHOTO_KINDS, type PhotoKind } from "@/lib/eventPhotos";

export type EventPhoto = { id: string; url: string; caption: string | null; kind: PhotoKind };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Uploading..." : label}
    </button>
  );
}

/**
 * An event's pictures, in three jobs.
 *
 * The header is the highlight — it fronts the event on the list and banners the
 * event page. The background sits behind the public page. Everything else is a
 * gallery. Keeping them apart means uploading a nice action shot never quietly
 * changes the page background.
 */
export default function EventPhotos({
  eventId,
  photos,
  canEdit,
}: {
  eventId: string;
  photos: EventPhoto[];
  canEdit: boolean;
}) {
  const [state, action] = useFormState<PhotoState, FormData>(uploadEventPhoto, undefined);

  const header = photos.find((p) => p.kind === "header") ?? null;
  const background = photos.find((p) => p.kind === "background") ?? null;
  const gallery = photos.filter((p) => p.kind === "gallery");

  if (photos.length === 0 && !canEdit) return null;

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-gray-900">Photos</h2>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {(["header", "background"] as const).map((kind) => {
          const meta = PHOTO_KINDS.find((k) => k.value === kind)!;
          const photo = kind === "header" ? header : background;
          return (
            <div key={kind}>
              <h3 className="text-sm font-semibold text-gray-900">{meta.label}</h3>
              <p className="mt-0.5 text-xs text-gray-500">{meta.note}</p>

              {photo ? (
                <div className="relative mt-2 overflow-hidden rounded-md border border-gray-200">
                  <a href={photo.url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={meta.label} className="h-40 w-full object-cover" loading="lazy" />
                  </a>
                  {canEdit && (
                    <form action={deleteEventPhoto} className="absolute right-1 top-1">
                      <input type="hidden" name="photoId" value={photo.id} />
                      <input type="hidden" name="eventId" value={eventId} />
                      <button type="submit" className="rounded bg-white/90 px-2 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-white">
                        Remove
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <p className="mt-2 rounded-md border border-dashed border-gray-300 px-3 py-6 text-center text-xs text-gray-400">
                  Not set.
                </p>
              )}

              {canEdit && (
                <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="kind" value={kind} />
                  <input
                    type="file"
                    name="photos"
                    accept="image/png,image/jpeg,image/webp"
                    required
                    className="block w-full text-xs text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-700"
                  />
                  <Submit label={photo ? `Replace ${meta.label.toLowerCase()}` : `Upload ${meta.label.toLowerCase()}`} />
                </form>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 border-t border-gray-100 pt-4">
        <h3 className="text-sm font-semibold text-gray-900">Gallery</h3>
        <p className="mt-0.5 text-xs text-gray-500">Extra photos, shown as a grid on the event page.</p>

        {gallery.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {gallery.map((p) => (
              <figure key={p.id} className="relative overflow-hidden rounded-md border border-gray-200">
                <a href={p.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption ?? "Event photo"} className="h-32 w-full object-cover" loading="lazy" />
                </a>
                {p.caption && <figcaption className="px-2 py-1 text-xs text-gray-600">{p.caption}</figcaption>}
                {canEdit && (
                  <form action={deleteEventPhoto} className="absolute right-1 top-1">
                    <input type="hidden" name="photoId" value={p.id} />
                    <input type="hidden" name="eventId" value={eventId} />
                    <button type="submit" className="rounded bg-white/90 px-2 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-white">
                      Remove
                    </button>
                  </form>
                )}
              </figure>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No gallery photos yet.</p>
        )}

        {canEdit && (
          <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="kind" value="gallery" />
            <input
              type="file"
              name="photos"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              required
              className="block text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
            />
            <input name="caption" placeholder="Caption (optional)" className="input max-w-xs" />
            <Submit label="Add photos" />
          </form>
        )}
      </div>

      {canEdit && <p className="mt-3 text-xs text-gray-400">JPG, PNG or WebP, up to 6 MB each.</p>}
      {state?.ok === false && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </div>
  );
}
