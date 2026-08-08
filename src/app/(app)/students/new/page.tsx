import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { createStudent } from "../actions";
import StudentForm from "../StudentForm";

export default async function NewStudentPage() {
  const session = await requirePermission(PERMISSIONS.STUDENT_CREATE);
  const supabase = supabaseAdmin();

  let clubs: { id: string; name: string }[] = [];
  let lockClub: { id: string; name: string } | null = null;

  if (session.role === "club_admin" && session.clubId) {
    const { data } = await supabase.from("clubs").select("id, name").eq("id", session.clubId).maybeSingle();
    lockClub = data ?? null;
  } else {
    const { data } = await supabase.from("clubs").select("id, name").eq("active", true).order("name");
    clubs = data ?? [];
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900">New student</h1>
      <div className="mt-6">
        <StudentForm action={createStudent} clubs={clubs} lockClub={lockClub} submitLabel="Create student" />
      </div>
    </div>
  );
}
