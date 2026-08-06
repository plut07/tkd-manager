import Link from "next/link";
import { requirePermission, hasPermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteUser } from "./actions";
import DeleteButton from "@/components/DeleteButton";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  event_manager: "Event Manager",
  club_admin: "Club User",
};

export default async function UsersPage() {
  const session = await requirePermission(PERMISSIONS.USER_VIEW);
  const supabase = supabaseAdmin();

  const { data: users } = await supabase
    .from("app_users")
    .select("id, username, full_name, email, active, last_login_at, roles(code, name), clubs(name)")
    .order("username");

  const canCreate = hasPermission(session, PERMISSIONS.USER_CREATE);
  const canEdit = hasPermission(session, PERMISSIONS.USER_EDIT);
  const canDelete = hasPermission(session, PERMISSIONS.USER_DELETE);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Users & Access</h1>
          <p className="mt-1 text-sm text-gray-500">Manage accounts and who can do what.</p>
        </div>
        <div className="flex gap-2">
          {session.role === "super_admin" && (
            <Link href="/users/roles" className="btn-secondary">
              Access rights matrix
            </Link>
          )}
          {canCreate && (
            <Link href="/users/new" className="btn-primary">
              + New user
            </Link>
          )}
        </div>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Name</th>
              <th>Role</th>
              <th>Club</th>
              <th>Status</th>
              <th>Last login</th>
              {(canEdit || canDelete) && <th></th>}
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u: any) => (
              <tr key={u.id}>
                <td className="font-medium text-gray-900">{u.username}</td>
                <td>
                  <div>{u.full_name}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </td>
                <td>{ROLE_LABELS[u.roles?.code] ?? u.roles?.name}</td>
                <td>{u.clubs?.name ?? <span className="text-gray-400">—</span>}</td>
                <td>
                  <span className={`badge ${u.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {u.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="text-gray-500">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never"}</td>
                {(canEdit || canDelete) && (
                  <td className="whitespace-nowrap text-right">
                    {canEdit && (
                      <Link href={`/users/${u.id}/edit`} className="mr-3 text-sm font-medium text-brand-700 hover:underline">
                        Edit
                      </Link>
                    )}
                    {canDelete && u.id !== session.sub && (
                      <DeleteButton action={deleteUser} fieldName="userId" fieldValue={u.id} confirmLabel={`Delete ${u.username}?`} />
                    )}
                  </td>
                )}
              </tr>
            ))}
            {(users ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-gray-400">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
