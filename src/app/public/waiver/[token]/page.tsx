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
    .select("id, events(name, venue, venue_address, country, start_date, end_date, clubs:organizer_club_id(name)), clubs(name), students(full_name, birthday, gender, gup, dan, national_id)")
    .eq("waiver_token", params.token)
    .maybeSingle();
  if (!reg) notFound();

  const { data: existing } = await supabase
    .from("waiver_signatures")
    .select("signed_name, signed_at")
    .eq("registration_id", (reg as any).id)
    .maybeSingle();

  const s = (reg as any).students;
  const e = (reg as any).events;
  const venue = [e?.venue, e?.venue_address, e?.country].filter(Boolean).join(", ") || "TBA";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="card p-6">
        <h1 className="text-2xl font-bold text-gray-900">{e?.name}</h1>
        <p className="mt-1 text-sm text-gray-500">Participation waiver and release of liability</p>

        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500">Participant</dt><dd className="font-medium text-gray-900">{s?.full_name}</dd></div>
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

      {existing && (
        <p className="text-center text-sm text-gray-500">
          Signed by {existing.signed_name} on {new Date(existing.signed_at).toLocaleString()}.
        </p>
      )}

      <SignaturePad token={params.token} action={signWaiver} defaultName={s?.full_name ?? ""} alreadySigned={Boolean(existing)} />
    </div>
  );
}
