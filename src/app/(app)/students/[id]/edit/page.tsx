import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { updateStudent } from "../../actions";
import StudentForm from "../../StudentForm";
import { gradeValue } from "@/lib/belts";

export default async function EditStudentPage({ params }: { params: { id: string } }) {
  const session = await requirePermission(PERMISSIONS.STUDENT_EDIT);
  const supabase = supabaseAdmin();

  const { data: student } = await supabase.from("students").select("*, clubs(id, name)").eq("id", params.id).maybeSingle();
  if (!student) notFound();

  if (session.role === "club_admin" && student.club_id !== session.clubId) {
    throw new Error("You can only edit students from your own club.");
  }

  let clubs: { id: string; name: string }[] = [];
  let lockClub: { id: string; name: string } | null = null;

  if (session.role === "club_admin") {
    lockClub = student.clubs as { id: string; name: string };
  } else {
    const { data } = await supabase.from("clubs").select("id, name").eq("active", true).order("name");
    clubs = data ?? [];
  }

  const updateStudentWithId = updateStudent.bind(null, student.id);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900">Edit student</h1>
      <div className="mt-6">
        <StudentForm
          action={updateStudentWithId}
          clubs={clubs}
          lockClub={lockClub}
          submitLabel="Save changes"
          defaultValues={{
            clubId: student.club_id,
            firstName: student.first_name,
            lastName: student.last_name,
            email: student.email ?? "",
            birthday: student.birthday ?? "",
            weightKg: student.weight_kg,
            heightCm: student.height_cm,
            grade: gradeValue(student.gup, student.dan),
            gender: student.gender ?? "",
            nationality: student.nationality ?? "",
            nationalId: student.national_id ?? "",
           
            active: student.active,
          }}
        />
      </div>
    </div>
  );
}
