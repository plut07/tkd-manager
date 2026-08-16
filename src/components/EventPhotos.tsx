"use client";

import { useFormState, useFormStatus } from "react-dom";
import { uploadEventPhoto, deleteEventPhoto, type PhotoState } from "@/app/(app)/events/photoActions";

export type EventPhoto = { id: string; url: string; caption: string | null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Uploading..." : "Add photos"}
    </button>
  );
}

/**
 * The event's photos.
 *
 * Shown on the info pack and on the public event page; only the signed-in view
 * passes canEdit, so the public page renders the same gallery read-only.
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

  if (photos.length === 0 && !canEdit) return null;

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-gray-900">Photos</h2>

      {photos.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <figure key={p.id} className="group relative overflow-hidden rounded-md border border-gray-200">
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? "Event photo"} className="h-40 w-full object-cover" loading="lazy" />
              </a>
              {p.caption && <figcaption className="px-2 py-1 text-xs text-gray-600">{p.caption}</figcaption>}
              {canEdit && (
                <form action={deleteEventPhoto} className="absolute right-1 top-1">
                  <input type="hidden" name="photoId" value={p.id} />
                  <input type="hidden" name="eventId" value={eventId} />
                  <button
                    type="submit"
                    className="rounded bg-white/90 px-2 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-white"
                  >
                    Remove
                  </button>
                </form>
              )}
            </figure>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-500">No photos yet.</p>
      )}

      {canEdit && (
        <form action={action} className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          <input type="hidden" name="eventId" value={eventId} />
          <input
            type="file"
            name="photos"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            required
            className="block text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
          />
          <input name="caption" placeholder="Caption (optional)" className="input max-w-xs" />
          <Submit />
          <span className="w-full text-xs text-gray-400">JPG, PNG, WebP or GIF, up to 6 MB each. Photos appear on the public event page too.</span>
        </form>
      )}
      {state?.ok === false && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </div>
  );
}
