"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CountryFlag from "./CountryFlag";
import ClubPhone from "./ClubPhone";
import { COUNTRIES_BY_CONTINENT } from "@/lib/countries";

/**
 * One club row that switches between reading and editing in place.
 *
 * Editing inline rather than on a separate page keeps the list as the single
 * view of every club — useful when correcting several at once.
 */
export default function ClubRow({
  club,
  updateAction,
  deleteButton,
  toggleButton,
}: {
  club: any;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteButton: React.ReactNode;
  toggleButton: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  /**
   * The row keeps its own open/closed state, so after the server action returns
   * we have to close it and pull fresh data — otherwise the form sits there
   * looking like nothing happened even though the save worked.
   */
  function handleSave(formData: FormData) {
    startTransition(async () => {
      try {
        await updateAction(formData);
        setEditing(false);
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2500);
      } catch {
        // A thrown error is surfaced by the page's error boundary.
      }
    });
  }

  if (!editing) {
    return (
      <tr>
        <td className="font-medium text-gray-900">{club.name}</td>
        <td>{club.instructor_name ?? <span className="text-gray-400">—</span>}</td>
        <td className="hidden md:table-cell">{club.city ?? "—"}</td>
        <td><CountryFlag country={club.country} /></td>
        <td className="text-xs">
          {club.contact_email && <div>{club.contact_email}</div>}
          {club.contact_phone && <div><ClubPhone phone={club.contact_phone} country={club.country} /></div>}
          {!club.contact_email && !club.contact_phone && "—"}
        </td>
        <td>{toggleButton}</td>
        <td className="whitespace-nowrap text-right">
          {saved && <span className="mr-3 text-sm font-medium text-green-700">Saved</span>}
          <button type="button" onClick={() => setEditing(true)} className="mr-3 text-sm font-medium text-brand-700 hover:underline">Edit</button>
          {deleteButton}
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-brand-50/40">
      <td colSpan={7} className="p-3">
        <form action={handleSave} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <input type="hidden" name="clubId" value={club.id} />
          <input name="name" defaultValue={club.name ?? ""} placeholder="Club name" className="input" required />
          <input name="instructorName" defaultValue={club.instructor_name ?? ""} placeholder="Instructor name" className="input" />
          <input name="city" defaultValue={club.city ?? ""} placeholder="City" className="input" />
          <select name="country" className="input" defaultValue={club.country ?? ""}>
            <option value="">Country</option>
            {COUNTRIES_BY_CONTINENT.map((g) => (
              <optgroup key={g.continent} label={g.continent}>
                {g.countries.map((c) => (<option key={c.code} value={c.name}>{c.name}</option>))}
              </optgroup>
            ))}
          </select>
          <input name="contactEmail" type="email" defaultValue={club.contact_email ?? ""} placeholder="Contact email"
            pattern="[^@\s]+@[^@\s]+\.[A-Za-z]{2,}" title="Must look like name@example.com" className="input" />
          <input name="contactPhone" defaultValue={club.contact_phone ?? ""} placeholder="Contact phone" className="input" />
          <label className="flex items-center gap-2 self-center text-sm text-gray-700">
            <input type="checkbox" name="active" defaultChecked={club.active} className="h-4 w-4 rounded border-gray-300" />
            Active
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
            <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Save"}</button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      </td>
    </tr>
  );
}
