import { requirePermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { createUser } from "../actions";
import UserForm from "../UserForm";

export default async function NewUserPage() {
  await requirePermission(PERMISSIONS.USER_CREATE);
  const supabase = supabaseAdmin();
  const [{ data: roles }, { data: clubs }] = await Promise.all([
    supabase.from("roles").select("id, code, name").order("name"),
    supabase.from("clubs").select("id, name").eq("active", true).order("name"),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900">New user</h1>
      <div className="mt-6">
        <UserForm
          action={createUser}
          roles={roles ?? []}
          clubs={clubs ?? []}
          submitLabel="Create user"
          passwordHint="Minimum 8 characters"
        />
      </div>
    </div>
  );
}
