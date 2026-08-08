// Central catalogue of the granular access rights the app understands.
// These codes must match the `permissions.code` rows seeded in
// supabase/migrations/0002_seed.sql.

export const PERMISSIONS = {
  USER_CREATE: "user:create",
  USER_EDIT: "user:edit",
  USER_DELETE: "user:delete",
  USER_VIEW: "user:view",
  EVENT_CREATE: "event:create",
  EVENT_EDIT: "event:edit",
  EVENT_DELETE: "event:delete",
  EVENT_VIEW: "event:view",
  STUDENT_CREATE: "student:create",
  STUDENT_EDIT: "student:edit",
  STUDENT_DELETE: "student:delete",
  STUDENT_VIEW: "student:view",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_GROUPS: { category: string; label: string; permissions: PermissionCode[] }[] = [
  {
    category: "user",
    label: "User accounts & access rights",
    permissions: [PERMISSIONS.USER_CREATE, PERMISSIONS.USER_EDIT, PERMISSIONS.USER_DELETE, PERMISSIONS.USER_VIEW],
  },
  {
    category: "event",
    label: "Events",
    permissions: [PERMISSIONS.EVENT_CREATE, PERMISSIONS.EVENT_EDIT, PERMISSIONS.EVENT_DELETE, PERMISSIONS.EVENT_VIEW],
  },
  {
    category: "student",
    label: "Students",
    permissions: [PERMISSIONS.STUDENT_CREATE, PERMISSIONS.STUDENT_EDIT, PERMISSIONS.STUDENT_DELETE, PERMISSIONS.STUDENT_VIEW],
  },
];

export const SUPER_ADMIN_ROLE = "super_admin";
