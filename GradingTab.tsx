import { requireSuperAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import DeleteButton from "@/components/DeleteButton";
import { COUNTRIES } from "@/lib/countries";
import { createClub, toggleClubActive, deleteClub } from "./actions";

export default async function ClubsPage() {
  await requireSuperAdmin();
  const supabase = supabaseAdmin();
  const { data: clubs } = await supabase.from("clubs").select("*").order("name");

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Clubs</h1>
      <p className="mt-1 text-sm text-gray-500">Clubs that students and Club User accounts belong to.</p>

      <div className="card mt-6 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Name</th>
              <th>City</th>
              <th>Country</th>
              <th>Contact</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(clubs ?? []).map((c) => (
              <tr key={c.id}>
                <td className="font-medium text-gray-900">{c.name}</td>
                <td>{c.city ?? "—"}</td>
                <td>{c.country ?? "—"}</td>
                <td className="text-xs">
                  {c.contact_email && <div>{c.contact_email}</div>}
                  {c.contact_phone && <div>{c.contact_phone}</div>}
                  {!c.contact_email && !c.contact_phone && "—"}
                </td>
                <td>
                  <form action={toggleClubActive}>
                    <input type="hidden" name="clubId" value={c.id} />
                    <input type="hidden" name="active" value={String(c.active)} />
                    <button
                      type="submit"
                      className={`badge ${c.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {c.active ? "Active" : "Inactive"}
                    </button>
                  </form>
                </td>
                <td className="text-right">
                  <DeleteButton action={deleteClub} fieldName="clubId" fieldValue={c.id} confirmLabel={`Delete club "${c.name}"?`} />
                </td>
              </tr>
            ))}
            {(clubs ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-400">
                  No clubs yet — add one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form action={createClub} className="card mt-6 grid grid-cols-1 gap-3 p-6 sm:grid-cols-2 lg:grid-cols-5">
        <input name="name" placeholder="Club name" className="input" required />
        <input name="city" placeholder="City" className="input" />
        <select name="country" className="input" defaultValue="">
          <option value="">Country</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input name="contactEmail" type="email" placeholder="Contact email" className="input" />
        <input name="contactPhone" placeholder="Contact phone" className="input" />
        <button type="submit" className="btn-primary sm:col-span-2 lg:col-span-1">
          + Add club
        </button>
      </form>
    </div>
  );
}
