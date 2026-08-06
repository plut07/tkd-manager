import Link from "next/link";
import { requirePermission, hasPermission, clubScope } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteStudent } from "./actions";
import DeleteButton from "@/components/DeleteButton";

function age(birthday: string | null) {
  if (!birthday) return "—";
  const b = new Date(birthday);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) years--;
  return years;
}

function beltLabel(gup: number | null, dan: number | null) {
  if (dan) return `${dan} Dan (Black belt)`;
  if (gup) return `${gup} Gup`;
  return "—";
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: { q?: string; club?: string };
}) {
  const session = await requirePermission(PERMISSIONS.STUDENT_VIEW);
  const supabase = supabaseAdmin();
  const scope = clubScope(session);

  let query = supabase
    .from("students")
    .select("id, first_name, last_name, email, birthday, weight_kg, height_cm, gup, dan, gender, nationality, national_id, passport_id, active, clubs(id, name)")
    .order("last_name");

  if (scope) query = query.eq("club_id", scope);
  if (!scope && searchParams.club) query = query.eq("club_id", searchParams.club);
  if (searchParams.q) {
    const q = searchParams.q;
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,national_id.ilike.%${q}%`);
  }

  const { data: students } = await query;

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
        {canCreate && (
          <Link href="/students/new" className="btn-primary">
            + New student
          </Link>
        )}
      </div>

      <form className="mt-4 flex flex-wrap gap-2" method="get">
        <input name="q" defaultValue={searchParams.q} placeholder="Search by name or ID..." className="input max-w-xs" />
        {!scope && clubs && (
          <select name="club" defaultValue={searchParams.club ?? ""} className="input max-w-xs">
            <option value="">All clubs</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className="btn-secondary">
          Filter
        </button>
      </form>

      <div className="card mt-4 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Name</th>
              {!scope && <th>Club</th>}
              <th>Gender</th>
              <th>Age</th>
              <th>Weight</th>
              <th>Height</th>
              <th>Belt</th>
              <th>Nationality</th>
              <th>ID / Passport</th>
              <th>Status</th>
              {(canEdit || canDelete) && <th></th>}
            </tr>
          </thead>
          <tbody>
            {(students ?? []).map((s: any) => (
              <tr key={s.id}>
                <td className="font-medium text-gray-900">
                  {s.last_name}, {s.first_name}
                  <div className="text-xs font-normal text-gray-500">{s.email}</div>
                </td>
                {!scope && <td>{s.clubs?.name}</td>}
                <td className="capitalize">{s.gender ?? "—"}</td>
                <td>{age(s.birthday)}</td>
                <td>{s.weight_kg ? `${s.weight_kg} kg` : "—"}</td>
                <td>{s.height_cm ? `${s.height_cm} cm` : "—"}</td>
                <td>{beltLabel(s.gup, s.dan)}</td>
                <td>{s.nationality ?? "—"}</td>
                <td className="text-xs">
                  {s.national_id && <div>ID: {s.national_id}</div>}
                  {s.passport_id && <div>Passport: {s.passport_id}</div>}
                  {!s.national_id && !s.passport_id && "—"}
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
                        confirmLabel={`Delete ${s.first_name} ${s.last_name}?`}
                      />
                    )}
                  </td>
                )}
              </tr>
            ))}
            {(students ?? []).length === 0 && (
              <tr>
                <td colSpan={10} className="py-6 text-center text-gray-400">
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
