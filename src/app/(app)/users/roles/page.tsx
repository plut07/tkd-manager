import { Fragment } from "react";
import { requireSuperAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { togglePermission } from "../actions";
import PermissionToggle from "@/components/PermissionToggle";

export default async function RolesPage() {
  await requireSuperAdmin();
  const supabase = supabaseAdmin();

  const [{ data: roles }, { data: permissions }, { data: rolePermissions }] = await Promise.all([
    supabase.from("roles").select("id, code, name, description").order("created_at"),
    supabase.from("permissions").select("id, code, category, action"),
    supabase.from("role_permissions").select("role_id, permission_id"),
  ]);

  const grantSet = new Set((rolePermissions ?? []).map((rp) => `${rp.role_id}:${rp.permission_id}`));
  const permByCode = new Map((permissions ?? []).map((p) => [p.code, p]));

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Access rights matrix</h1>
      <p className="mt-1 text-sm text-gray-500">
        Control exactly what each role can do. Super Admin always has full access and can&apos;t be edited.
      </p>

      <div className="card mt-6 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Permission</th>
              {(roles ?? []).map((r) => (
                <th key={r.id} className="text-center">
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => (
              <Fragment key={group.category}>
                <tr className="bg-gray-50">
                  <td colSpan={(roles?.length ?? 0) + 1} className="font-semibold text-gray-700">
                    {group.label}
                  </td>
                </tr>
                {group.permissions.map((code) => {
                  const perm = permByCode.get(code);
                  if (!perm) return null;
                  return (
                    <tr key={code}>
                      <td className="text-gray-700">{perm.action[0].toUpperCase() + perm.action.slice(1)}</td>
                      {(roles ?? []).map((r) => {
                        const isSuperAdmin = r.code === "super_admin";
                        const enabled = isSuperAdmin || grantSet.has(`${r.id}:${perm.id}`);
                        return (
                          <td key={r.id} className="text-center">
                            <PermissionToggle
                              action={togglePermission}
                              roleId={r.id}
                              permissionId={perm.id}
                              enabled={enabled}
                              disabled={isSuperAdmin}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
