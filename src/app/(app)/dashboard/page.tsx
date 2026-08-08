import Link from "next/link";
import { requireSession, hasPermission, clubScope } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERMISSIONS } from "@/lib/permissions";

async function getCounts(clubId: string | null) {
  const supabase = supabaseAdmin();

  let studentsQuery = supabase.from("students").select("id", { count: "exact", head: true }).eq("active", true);
  if (clubId) studentsQuery = studentsQuery.eq("club_id", clubId);

  const [{ count: studentCount }, { count: eventCount }, { count: clubCount }] = await Promise.all([
    studentsQuery,
    supabase.from("events").select("id", { count: "exact", head: true }).in("status", ["upcoming", "ongoing"]),
    clubId ? Promise.resolve({ count: 1 }) : supabase.from("clubs").select("id", { count: "exact", head: true }).eq("active", true),
  ]);

  return {
    students: studentCount ?? 0,
    events: eventCount ?? 0,
    clubs: clubCount ?? 0,
  };
}

export default async function DashboardPage() {
  const session = await requireSession();
  const scope = clubScope(session);
  const counts = await getCounts(scope);

  const cards = [
    {
      label: scope ? "Active students (your club)" : "Active students",
      value: counts.students,
      href: "/students",
      show: hasPermission(session, PERMISSIONS.STUDENT_VIEW),
    },
    {
      label: "Upcoming / ongoing events",
      value: counts.events,
      href: "/events",
      show: hasPermission(session, PERMISSIONS.EVENT_VIEW),
    },
    {
      label: "Active clubs",
      value: counts.clubs,
      href: "/students",
      show: !scope && hasPermission(session, PERMISSIONS.STUDENT_VIEW),
    },
  ].filter((c) => c.show);

  const ACCENTS = ["border-l-blue-600", "border-l-red-600", "border-l-indigo-600"];

  return (
    <div>
      <div className="hero-bg -mx-4 -mt-4 mb-6 rounded-b-lg px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <h1 className="text-2xl font-bold text-white drop-shadow">
          Welcome back, {session.fullName.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-white/80">Here&apos;s what&apos;s happening across the federation.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c, i) => (
          <Link
            key={c.label}
            href={c.href}
            className={`card border-l-4 p-5 hover:border-brand-300 ${ACCENTS[i % ACCENTS.length]}`}
          >
            <div className="text-3xl font-bold text-brand-700">{c.value}</div>
            <div className="mt-1 text-sm text-gray-600">{c.label}</div>
          </Link>
        ))}
      </div>

      {cards.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">
          You don&apos;t have any modules assigned yet. Ask a Super Admin to grant you access.
        </p>
      )}
    </div>
  );
}
