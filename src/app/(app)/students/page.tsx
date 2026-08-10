import Link from "next/link";
import { requirePermission, hasPermission, clubScope } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteStudent } from "./actions";
import DeleteButton from "@/components/DeleteButton";
import CountryFlag from "@/components/CountryFlag";
import BeltBadge from "@/components/BeltBadge";
import { formatDob } from "@/lib/eligibility";

function age(birthday: string | null) {
  if (!birthday) return "—";
  const b = new Date(birthday);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) years--;
  return years;
}


export default async function StudentsPage({
  searchParams,
}: {
  searchParams: { q?: string; club?: string | string[]; gender?: string | string[]; status?: string | string[]; sort?: string; dir?: string };
}) {
  const session = await requirePermission(PERMISSIONS.STUDENT_VIEW);
  const supabase = supabaseAdmin();
  const scope = clubScope(session);

  // Filters that allow several values can't be expressed by the simple query
  // builder, so the query stays broad and the narrowing happens below.
  const asList = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
  const clubFilter = asList(searchParams.club);
  const genderFilter = asList(searchParams.gender);
  const statusFilter = asList(searchParams.status);
  const q = (searchParams.q ?? "").trim().toLowerCase();

  let query = supabase
    .from("students")
    .select("id, full_name, email, birthday, weight_kg, height_cm, gup, dan, gender, nationality, national_id, club_number, active, clubs(id, name)");

  if (scope) query = query.eq("club_id", scope);
  const { data: allStudents } = await query;

  const students = (allStudents ?? []).filter((s: any) => {
    if (clubFilter.length > 0 && !clubFilter.includes(s.clubs?.id)) return false;
    if (genderFilter.length > 0 && !genderFilter.includes(s.gender ?? "")) return false;
    if (statusFilter.length > 0 && !statusFilter.includes(s.active ? "active" : "inactive")) return false;
    if (q) {
      const haystack = `${s.full_name ?? ""} ${s.national_id ?? ""} ${s.club_number ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // Sorting is done here too, so it can order by age (derived) as easily as by
  // a stored column.
  const sort = ["no", "name", "club", "age"].includes(searchParams.sort ?? "") ? searchParams.sort! : "name";
  const dir = searchParams.dir === "desc" ? "desc" : "asc";
  const sortValue = (s: any) => {
    switch (sort) {
      case "no": return Number(s.club_number) || 0;
      case "club": return String(s.clubs?.name ?? "").toLowerCase();
      case "age": return Number(age(s.birthday)) || 0;
      default: return String(s.full_name ?? "").toLowerCase();
    }
  };
  students.sort((a: any, b: any) => {
    const av = sortValue(a), bv = sortValue(b);
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return dir === "desc" ? -cmp : cmp;
  });

  /** Link for a sortable column header, flipping direction when already active. */
  const sortHref = (key: string) => {
    const params = new URLSearchParams();
    if (searchParams.q) params.set("q", searchParams.q);
    clubFilter.forEach((c) => params.append("club", c));
    genderFilter.forEach((g) => params.append("gender", g));
    statusFilter.forEach((st) => params.append("status", st));
    params.set("sort", key);
    params.set("dir", sort === key && dir === "asc" ? "desc" : "asc");
    return `/students?${params.toString()}`;
  };
  const arrow = (key: string) => (sort === key ? (dir === "asc" ? " ▲" : " ▼") : "");

  const { data: clubs } = scope
    ? { data: null }
    : await supabase.from("clubs").select("id, name").eq("active", true).order("name");

  const canCreate = hasPermission(session, PERMISSIONS.STUDENT_CREATE);
  const canEdit = hasPermission(session, PERMISSIONS.STUDENT_EDIT);
  const canDelete = hasPermission(session, PERMISSIONS.STUDENT_DELETE);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Students</h1>
          <p className="mt-1 text-sm text-gray-500">
            {scope ? "Your club's registered students." : "All registered students across every club."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/students" className="btn-secondary">Export to Excel</a>
          {canCreate && session.role !== "club_admin" && (
            <Link href="/students/import" className="btn-secondary">Import from Excel</Link>
          )}
          {canCreate && (
            <Link href="/students/new" className="btn-primary">
              + New student
            </Link>
          )}
        </div>
      </div>

      <form className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5" method="get">
        <input name="q" defaultValue={searchParams.q} placeholder="Search by name, No. or NRIC..." className="input lg:col-span-2" />
        {!scope && clubs && (
          <select name="club" multiple defaultValue={clubFilter} className="input h-24" title="Hold Ctrl/Cmd to pick several">
            {clubs.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        )}
        <select name="gender" multiple defaultValue={genderFilter} className="input h-24" title="Hold Ctrl/Cmd to pick several">
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        <select name="status" multiple defaultValue={statusFilter} className="input h-24" title="Hold Ctrl/Cmd to pick several">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
          <button type="submit" className="btn-secondary">Filter</button>
          <Link href="/students" className="btn-secondary">Reset</Link>
          <span className="ml-auto self-center text-sm text-gray-500">{students.length} student{students.length === 1 ? "" : "s"}</span>
        </div>
      </form>

      <div className="card mt-4 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th><Link href={sortHref("no")} className="hover:underline">No.{arrow("no")}</Link></th>
              <th><Link href={sortHref("name")} className="hover:underline">Name{arrow("name")}</Link></th>
              {!scope && <th><Link href={sortHref("club")} className="hover:underline">Club{arrow("club")}</Link></th>}
              <th>Gender</th>
              <th className="hidden md:table-cell">Date of birth</th>
              <th><Link href={sortHref("age")} className="hover:underline">Age{arrow("age")}</Link></th>
              <th className="hidden md:table-cell">Weight</th>
              <th className="hidden md:table-cell">Height</th>
              <th>Grade / Degree</th>
              <th className="hidden lg:table-cell">Nationality</th>
              <th className="hidden lg:table-cell">NRIC / Passport</th>
              <th>Status</th>
              {(canEdit || canDelete) && <th></th>}
            </tr>
          </thead>
          <tbody>
            {students.map((s: any) => (
              <tr key={s.id}>
                <td className="text-gray-500">{s.club_number ?? "—"}</td>
                <td className="font-medium text-gray-900">
                  {s.full_name}
                  <div className="text-xs font-normal text-gray-500">{s.email}</div>
                </td>
                {!scope && <td>{s.clubs?.name}</td>}
                <td className="capitalize">{s.gender ?? "—"}</td>
                <td className="hidden md:table-cell">{formatDob(s.birthday)}</td>
                <td>{age(s.birthday)}</td>
                <td className="hidden md:table-cell">{s.weight_kg ? `${s.weight_kg} kg` : "—"}</td>
                <td className="hidden md:table-cell">{s.height_cm ? `${s.height_cm} cm` : "—"}</td>
                <td><BeltBadge gup={s.gup} dan={s.dan} /></td>
                <td className="hidden lg:table-cell"><CountryFlag country={s.nationality} /></td>
                <td className="hidden text-xs lg:table-cell">
                  {s.national_id ?? "—"}
                </td>
                <td>
                  <span className={`badge ${s.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {s.active ? "Active" : "Inactive"}
                  </span>
                </td>
                {(canEdit || canDelete) && (
                  <td className="whitespace-nowrap text-right">
                    {canEdit && (
                      <Link href={`/students/${s.id}/edit`} className="mr-3 text-sm font-medium text-brand-700 hover:underline">
                        Edit
                      </Link>
                    )}
                    {canDelete && (
                      <DeleteButton
                        action={deleteStudent}
                        fieldName="studentId"
                        fieldValue={s.id}
                        confirmLabel={`Delete ${s.full_name}?`}
                      />
                    )}
                  </td>
                )}
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={13} className="py-6 text-center text-gray-400">
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
