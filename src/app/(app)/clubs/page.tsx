import Link from "next/link";
import { requireSuperAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import DeleteButton from "@/components/DeleteButton";
import CountrySelect from "@/components/CountrySelect";
import { createClub, updateClub, toggleClubActive, deleteClub } from "./actions";
import ClubRow from "@/components/ClubRow";
import CountryFlag from "@/components/CountryFlag";
import ClubPhone from "@/components/ClubPhone";

export default async function ClubsPage({ searchParams }: { searchParams: { q?: string; country?: string; status?: string; members?: string } }) {
  await requireSuperAdmin();
  const supabase = supabaseAdmin();
  const { data: allClubs } = await supabase.from("clubs").select("*").order("name");

  // Member counts drive the "has students" filter and are useful on screen.
  const { data: studentRows } = await supabase.from("students").select("club_id");
  const memberCount = new Map<string, number>();
  (studentRows ?? []).forEach((r: any) => memberCount.set(r.club_id, (memberCount.get(r.club_id) ?? 0) + 1));

  const q = (searchParams.q ?? "").trim().toLowerCase();
  const countryFilter = (searchParams.country ?? "").trim();
  const statusFilter = (searchParams.status ?? "all").trim();
  const membersFilter = (searchParams.members ?? "all").trim();

  const clubs = (allClubs ?? []).filter((c: any) => {
    if (q && !`${c.name ?? ""} ${c.instructor_name ?? ""}`.toLowerCase().includes(q)) return false;
    if (countryFilter && c.country !== countryFilter) return false;
    if (statusFilter === "active" && !c.active) return false;
    if (statusFilter === "inactive" && c.active) return false;
    const count = memberCount.get(c.id) ?? 0;
    if (membersFilter === "with" && count === 0) return false;
    if (membersFilter === "without" && count > 0) return false;
    return true;
  });

  // Only countries actually in use, so the list stays short.
  const usedCountries = Array.from(new Set((allClubs ?? []).map((c: any) => c.country).filter(Boolean))).sort();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Clubs</h1>
          <p className="mt-1 text-sm text-gray-500">Clubs that students and Club User accounts belong to.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/clubs" className="btn-secondary">Export to Excel</a>
          <Link href="/clubs/import" className="btn-secondary">Import from Excel</Link>
        </div>
      </div>

      <form method="get" className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input name="q" defaultValue={searchParams.q} placeholder="Search club or instructor..." className="input lg:col-span-2" />
        <select name="country" defaultValue={countryFilter} className="input">
          <option value="">All countries</option>
          {usedCountries.map((c) => (<option key={String(c)} value={String(c)}>{String(c)}</option>))}
        </select>
        <select name="status" defaultValue={statusFilter} className="input">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select name="members" defaultValue={membersFilter} className="input">
          <option value="all">All clubs</option>
          <option value="with">Has students</option>
          <option value="without">No students</option>
        </select>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
          <button type="submit" className="btn-secondary">Search</button>
          <Link href="/clubs" className="btn-secondary">Reset</Link>
          <span className="ml-auto self-center text-sm text-gray-500">{clubs.length} club{clubs.length === 1 ? "" : "s"}</span>
        </div>
      </form>

      <div className="card mt-4 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Name</th>
              <th>Instructor</th>
              <th className="hidden md:table-cell">City</th>
              <th>Country</th>
              <th>Contact</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clubs.map((c: any) => (
              <ClubRow
                key={c.id}
                club={c}
                updateAction={updateClub}
                toggleButton={
                  <form action={toggleClubActive}>
                    <input type="hidden" name="clubId" value={c.id} />
                    <input type="hidden" name="active" value={String(c.active)} />
                    <button type="submit" className={`badge ${c.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{c.active ? "Active" : "Inactive"}</button>
                  </form>
                }
                deleteButton={<DeleteButton action={deleteClub} fieldName="clubId" fieldValue={c.id} confirmLabel={`Delete club "${c.name}"?`} />}
              />
            ))}
            {clubs.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-gray-400">
                  No clubs yet — add one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form action={createClub} className="card mt-6 grid grid-cols-1 gap-3 p-6 sm:grid-cols-2 lg:grid-cols-6">
        <input name="name" placeholder="Club name" className="input" required />
        <input name="instructorName" placeholder="Instructor name" className="input" />
        <input name="city" placeholder="City" className="input" />
        <CountrySelect name="country" placeholder="Country" />
        <input name="contactEmail" type="email" placeholder="Contact email" className="input" pattern="[^@\s]+@[^@\s]+\.[A-Za-z]{2,}" title="Must look like name@example.com" />
        <input name="contactPhone" placeholder="Contact phone" className="input" />
        <button type="submit" className="btn-primary sm:col-span-2 lg:col-span-1">
          + Add club
        </button>
      </form>
    </div>
  );
}
