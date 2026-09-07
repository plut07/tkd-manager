import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatEventRange } from "@/lib/eventStatus";
import { gradeLabel } from "@/lib/belts";
import { formatDob, waiverAge } from "@/lib/eligibility";
import SignaturePad from "@/components/SignaturePad";
import { signWaiver } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Signing page reached by token, not by login, so a participant can sign on
 * their own phone. It shows only their own entry.
 */
export default async function SignWaiverPage({ params }: { params: { token: string } }) {
  const supabase = supabaseAdmin();

  const { data: reg } = await supabase
    .from("event_registrations")
    .select("id, is_team, team_name, events(name, venue, venue_address, country, start_date, end_date, clubs:organizer_club_id(name)), clubs(name), students(full_name, birthday, gender, gup, dan, national_id)")
    .eq("waiver_token", params.token)
    .maybeSingle();
  if (!reg) notFound();

  // Every signature on this entry. A team collects one per member, so this is a
  // list rather than a single row — see 0047_team_waivers_standings_and_limits.
  const { data: signatures } = await supabase
    .from("waiver_signatures")
    .select("student_id, signed_name, signed_at")
    .eq("registration_id", (reg as any).id);

  const isTeam = (reg as any).is_team === true;

  // A team's members, in the order they compete, each with whether they have
  // signed yet. One link is shared between them, so this page is a checklist
  // the coach can hand round rather than a single form.
  const { data: memberRows } = isTeam
    ? await supabase
        .from("event_team_members")
        .select("student_id, position, is_reserve, students(full_name)")
        .eq("registration_id", (reg as any).id)
        .order("position")
    : { data: null };

  const signedBy = new Map(((signatures ?? []) as any[]).map((row) => [row.student_id, row]));
  const members = ((memberRows ?? []) as any[]).map((m) => ({
    studentId: m.student_id as string,
    fullName: (m.students?.full_name as string) ?? "",
    isReserve: m.is_reserve === true,
    signature: signedBy.get(m.student_id) ?? null,
  }));

  // An individual entry's one signature is the row with no member against it.
  const existing = isTeam ? null : (signedBy.get(null) ?? null);

  const s = (reg as any).students;
  const e = (reg as any).events;
  const venue = [e?.venue, e?.venue_address, e?.country].filter(Boolean).join(", ") || "TBA";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="card p-6">
        <h1 className="text-2xl font-bold text-gray-900">{e?.name}</h1>
        <p className="mt-1 text-sm text-gray-500">Participation waiver and release of liability</p>

        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500">{isTeam ? "Team" : "Participant"}</dt><dd className="font-medium text-gray-900">{isTeam ? (reg as any).team_name : s?.full_name}</dd></div>
          <div><dt className="text-gray-500">Training centre</dt><dd className="font-medium text-gray-900">{(reg as any).clubs?.name ?? "—"}</dd></div>
          <div><dt className="text-gray-500">Date of birth</dt><dd className="font-medium text-gray-900">{formatDob(s?.birthday)} ({waiverAge(s?.birthday) || "—"})</dd></div>
          <div><dt className="text-gray-500">Grade / Degree</dt><dd className="font-medium text-gray-900">{gradeLabel(s?.gup ?? null, s?.dan ?? null)}</dd></div>
          <div><dt className="text-gray-500">Dates</dt><dd className="font-medium text-gray-900">{formatEventRange(e?.start_date, e?.end_date)}</dd></div>
          <div><dt className="text-gray-500">Venue</dt><dd className="font-medium text-gray-900">{venue}</dd></div>
        </dl>
      </div>

      <div className="card space-y-3 p-6 text-sm text-gray-700">
        <p>
          I wish to participate in {e?.name}, due to be held on {formatEventRange(e?.start_date, e?.end_date)} at {venue}.
        </p>
        <p>
          I understand and agree that, during my participation in this event, I shall be solely responsible for any
          accidents, damages, or injuries caused by my own actions. I hereby waive any right to claim damages against{" "}
          {e?.clubs?.name || "the organizing committee"} and the organizing committee of the said event, as well as other
          participants. I agree to bear and pay for any losses or expenses arising from my participation.
        </p>
        <p>
          All decisions of the Organizing Committee are final, and no complaints will be entertained. The Organizing
          Committee reserves the right to prohibit anyone from participating in the above event.
        </p>
        <p>I understand and agree to the above terms and commit to complying with all regulations of &ldquo;{e?.name}&rdquo;.</p>
      </div>

      {isTeam ? (
        /* One link for the whole team, and one signature per member: the coach
           hands the phone round, and each person signs their own line. */
        <div className="space-y-3">
          <p className="text-center text-sm text-gray-500">
            Every member signs their own line. {members.filter((m) => m.signature).length} of {members.length} done.
          </p>
          {members.map((member) => (
            <div key={member.studentId} className="card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium text-gray-900">
                  {member.fullName}
                  {member.isReserve && <span className="ml-2 text-xs font-normal text-gray-400">(reserve)</span>}
                </h3>
                {member.signature && (
                  <span className="text-xs text-green-700">
                    Signed {new Date(member.signature.signed_at).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="mt-2">
                <SignaturePad
                  token={params.token}
                  action={signWaiver}
                  defaultName={member.fullName}
                  alreadySigned={Boolean(member.signature)}
                  studentId={member.studentId}
                />
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">
              This team has nobody on its sheet yet. Ask the organiser to add the members first.
            </p>
          )}
        </div>
      ) : (
        <>
          {existing && (
            <p className="text-center text-sm text-gray-500">
              Signed by {existing.signed_name} on {new Date(existing.signed_at).toLocaleString()}.
            </p>
          )}
          <SignaturePad token={params.token} action={signWaiver} defaultName={s?.full_name ?? ""} alreadySigned={Boolean(existing)} />
        </>
      )}
    </div>
  );
}
