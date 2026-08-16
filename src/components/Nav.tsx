import Link from "next/link";
import type { SessionPayload } from "@/lib/session";
import { hasPermission } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/permissions";
import { logoutAction } from "@/app/(app)/actions";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  event_manager: "Event Manager",
  club_admin: "Club User",
};

export default function Nav({ session }: { session: SessionPayload }) {
  const links = [
    { href: "/dashboard", label: "Dashboard", show: true },
    { href: "/students", label: "Students", show: hasPermission(session, PERMISSIONS.STUDENT_VIEW) },
    { href: "/events", label: "Events", show: hasPermission(session, PERMISSIONS.EVENT_VIEW) },
    { href: "/users", label: "Users & Access", show: hasPermission(session, PERMISSIONS.USER_VIEW) },
    { href: "/clubs", label: "Clubs", show: session.role === "super_admin" },
  ].filter((l) => l.show);

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="accent-bar h-1.5 w-full" />
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-bold text-brand-700">
            TKD Manager
          </Link>
          <nav className="hidden gap-4 sm:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm font-medium text-gray-600 hover:text-brand-700">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-sm">
            <div className="font-medium text-gray-900">{session.fullName}</div>
            <div className="text-xs text-gray-500">{ROLE_LABELS[session.role] ?? session.role}</div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="btn-secondary !px-3 !py-1.5 text-xs">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <nav className="flex gap-4 overflow-x-auto border-t border-gray-100 px-4 py-2 sm:hidden">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="whitespace-nowrap text-sm font-medium text-gray-600">
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
