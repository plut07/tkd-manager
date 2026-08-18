import Link from "next/link";
import { requirePermission, hasPermission } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteUser, approveAccessRequest, rejectAccessRequest } from "./actions";
import DeleteButton from "@/components/DeleteButton";
import MySignaturePad from "@/components/MySignaturePad";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  event_manager: "Event Manager",
  club_admin: "Club User",
};

export default async function UsersPage() {
  const session = await requirePermission(PERMISSIONS.USER_VIEW);
  const supabase = supabaseAdmin();

  const isSuperAdmin = session.role === "super_admin";
  const { data: requests } = isSuperAdmin
    ? await supabase.from("access_requests").select("*, clubs(name)").eq("status", "pending").order("created_at")
    : { data: null };
  const { data: roles } = isSuperAdmin
    ? await supabase.from("roles").select("id, code, name").order("name")
    : { data: null };
  const { data: allClubs } = isSuperAdmin
    ? await supabase.from("clubs").select("id, name").eq("active", true).order("name")
    : { data: null };

  const { data: users } = await supabase
    .from("app_users")
    .select("id, username, full_name, email, active, last_login_at, roles(code, name), clubs(name)")
    .order("username");

  const canCreate = hasPermission(session, PERMISSIONS.USER_CREATE);
  const canEdit = hasPermission(session, PERMISSIONS.USER_EDIT);
  const canDelete = hasPermission(session, PERMISSIONS.USER_DELETE);
  const { data: me } = await supabase.from("app_users").select("signature_png").eq("id", session.sub).maybeSingle();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Users &amp; Access</h1>
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

      {isSuperAdmin && (requests ?? []).length > 0 && (
        <div className="card mt-6 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Access requests ({(requests ?? []).length})</h2>
          <p className="mt-1 text-sm text-gray-500">
            People who asked for a login. Approving creates the account with the password they chose; nothing is emailed,
            so tell them yourself once it&apos;s done.
          </p>
          <div className="mt-4 space-y-3">
            {(requests ?? []).map((r: any) => (
              <div key={r.id} className="rounded-md border border-gray-200 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-900">{r.full_name} <span className="font-normal text-gray-500">({r.username})</span></div>
                    <div className="text-xs text-gray-500">{[r.email, r.phone].filter(Boolean).join(" · ")}</div>
                    <div className="text-xs text-gray-400">
                      Club: {r.clubs?.name ?? r.club_name_raw ?? "not specified"} · requested {new Date(r.created_at).toLocaleString()}
                    </div>
                    {r.message && <p className="mt-1 text-xs text-gray-600">&ldquo;{r.message}&rdquo;</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={approveAccessRequest} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="requestId" value={r.id} />
                      <select name="roleId" className="input !w-40" defaultValue={(roles ?? []).find((x: any) => x.code === "club_admin")?.id ?? ""} required>
                        {(roles ?? []).map((role: any) => (<option key={role.id} value={role.id}>{role.name}</option>))}
                      </select>
                      <select name="clubId" className="input !w-44" defaultValue={r.club_id ?? ""}>
                        <option value="">No club</option>
                        {(allClubs ?? []).map((c: any) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                      </select>
                      <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">Approve</button>
                    </form>
                    <form action={rejectAccessRequest}>
                      <input type="hidden" name="requestId" value={r.id} />
                      <button type="submit" className="text-sm font-medium text-red-600 hover:underline">Reject</button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mt-6 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Name</th>
              <th>Role</th>
              <th>Club</th>
              <th>Status</th>
              <th className="hidden md:table-cell">Last login</th>
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
                <td className="hidden text-gray-500 md:table-cell">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never"}</td>
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

      <div className="mt-6">
        <MySignaturePad initial={me?.signature_png ?? null} />
      </div>
    </div>
  );
}
