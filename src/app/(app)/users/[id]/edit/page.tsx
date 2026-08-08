import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { updateUser } from "../../actions";
import UserForm from "../../UserForm";

export default async function EditUserPage({ params }: { params: { id: string } }) {
  await requirePermission(PERMISSIONS.USER_EDIT);
  const supabase = supabaseAdmin();

  const [{ data: user }, { data: roles }, { data: clubs }] = await Promise.all([
    supabase.from("app_users").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("roles").select("id, code, name").order("name"),
    supabase.from("clubs").select("id, name").eq("active", true).order("name"),
  ]);

  if (!user) notFound();

  const updateUserWithId = updateUser.bind(null, user.id);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900">Edit user</h1>
      <div className="mt-6">
        <UserForm
          action={updateUserWithId}
          roles={roles ?? []}
          clubs={clubs ?? []}
          submitLabel="Save changes"
          passwordHint="Leave blank to keep current password"
          defaultValues={{
            username: user.username,
            fullName: user.full_name,
            email: user.email ?? "",
            roleId: user.role_id,
            clubId: user.club_id ?? "",
            active: user.active,
          }}
        />
      </div>
    </div>
  );
}
