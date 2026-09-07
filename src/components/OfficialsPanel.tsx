"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CountryFlag from "@/components/CountryFlag";
import { COUNTRIES_BY_CONTINENT } from "@/lib/countries";
import { OFFICIAL_ROLES, ROLE_LABELS, seatsFor, seatLabel, type OfficialRole } from "@/lib/officials";
import { saveOfficial, deleteOfficial, seatOfficial, type OfficialDto } from "@/app/(app)/events/officialsActions";

/**
 * The umpire panel for an event.
 *
 * Two jobs on one screen because they are two halves of the same one: who is
 * officiating at all, and who is sitting in which seat on which ring. The list
 * is made once at the start of the event; the seating changes all day.
 *
 * Officials are their own list rather than students, because most of them are
 * not on this system — an international umpire flies in, judges for two days
 * and goes home. Linking one to a student is offered, not required.
 */

export type RingLite = { id: string; name: string; judgeCount: number };
export type StudentLite = { id: string; fullName: string; clubId: string | null };

export default function OfficialsPanel({
  eventId,
  officials,
  rings,
  students,
  clubs,
  canEdit,
}: {
  eventId: string;
  officials: OfficialDto[];
  rings: RingLite[];
  students: StudentLite[];
  clubs: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove(official: OfficialDto) {
    if (!window.confirm(`Remove ${official.fullName} from this event's officials?`)) return;
    setBusy(true);
    setError("");
    const result = await deleteOfficial({ eventId, officialId: official.id });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    router.refresh();
  }

  async function seat(ringId: string, slot: number, officialId: string | null) {
    setBusy(true);
    setError("");
    const result = await seatOfficial({ eventId, ringId, slot, officialId });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Officials ({officials.length})</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Everyone umpiring this event. Seat them on a ring below and their name replaces &ldquo;Judge 3&rdquo; on
              the pad — and goes onto every result they call.
            </p>
          </div>
          {canEdit && !adding && (
            <button type="button" className="btn-primary" onClick={() => { setAdding(true); setEditing(null); }}>
              Add an official
            </button>
          )}
        </div>

        {error && <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {adding && (
          <OfficialForm
            eventId={eventId}
            students={students}
            clubs={clubs}
            onDone={() => { setAdding(false); router.refresh(); }}
            onCancel={() => setAdding(false)}
          />
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="table-base min-w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Country</th>
                <th>Qualification</th>
                <th>Seated</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {officials.map((official) => (
                <tr key={official.id}>
                  <td className="font-medium text-gray-900">
                    {official.fullName}
                    {official.clubName && <span className="block text-xs font-normal text-gray-400">{official.clubName}</span>}
                  </td>
                  <td>{ROLE_LABELS[official.role] ?? official.role}</td>
                  <td>{official.country ? <CountryFlag country={official.country} /> : <span className="text-gray-300">—</span>}</td>
                  <td className="text-gray-600">{official.qualification || <span className="text-gray-300">—</span>}</td>
                  <td>
                    {official.seat ? (
                      <span className="badge bg-brand-100 text-brand-700">
                        {official.seat.ringName} · {seatLabel(official.seat.slot)}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="text-right whitespace-nowrap">
                      <button type="button" className="text-sm font-medium text-brand-700 hover:underline"
                        onClick={() => { setEditing(official.id); setAdding(false); }}>
                        Edit
                      </button>
                      <button type="button" className="ml-3 text-sm font-medium text-red-600 hover:underline disabled:opacity-40"
                        disabled={busy} onClick={() => { void remove(official); }}>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {officials.length === 0 && !adding && (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="py-6 text-center text-gray-400">
                    No officials listed. A club competition doesn&apos;t need them — judges just take a seat number.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {editing && (
          <OfficialForm
            eventId={eventId}
            students={students}
            clubs={clubs}
            official={officials.find((o) => o.id === editing)}
            onDone={() => { setEditing(null); router.refresh(); }}
            onCancel={() => setEditing(null)}
          />
        )}
      </div>

      {rings.length === 0 ? (
        <div className="card p-6 text-center text-sm text-gray-500">
          No rings yet. Add one under Draw &amp; Scoreboard and you can seat a panel on it here.
        </div>
      ) : (
        officials.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900">Seating</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Slot numbers match the scoreboard, so a press and the person who made it line up. An official already
              sitting elsewhere is moved rather than listed twice.
            </p>

            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {rings.map((ring) => (
                <div key={ring.id} className="rounded-md border border-gray-200 p-3">
                  <h4 className="font-medium text-gray-900">{ring.name}</h4>
                  <div className="mt-2 space-y-2">
                    {seatsFor(ring.judgeCount).map((slot) => {
                      const sitting = officials.find((o) => o.seat?.ringId === ring.id && o.seat.slot === slot);
                      return (
                        <div key={slot} className="flex items-center gap-2">
                          <span className="w-20 shrink-0 text-xs text-gray-500">{seatLabel(slot)}</span>
                          <select
                            className="input !py-1 text-sm"
                            disabled={!canEdit || busy}
                            value={sitting?.id ?? ""}
                            onChange={(e) => { void seat(ring.id, slot, e.target.value || null); }}
                          >
                            <option value="">— empty —</option>
                            {officials
                              // Somebody seated on another ring is still
                              // offered: moving them is the common case, and
                              // hiding them would look like they had vanished.
                              .map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.fullName}
                                  {o.seat && o.seat.ringId !== ring.id ? ` (on ${o.seat.ringName})` : ""}
                                </option>
                              ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}

function OfficialForm({
  eventId,
  students,
  clubs,
  official,
  onDone,
  onCancel,
}: {
  eventId: string;
  students: StudentLite[];
  clubs: { id: string; name: string }[];
  official?: OfficialDto;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState(official?.fullName ?? "");
  const [studentId, setStudentId] = useState(official?.studentId ?? "");
  const [clubId, setClubId] = useState(official?.clubId ?? "");
  const [country, setCountry] = useState(official?.country ?? "");
  const [qualification, setQualification] = useState(official?.qualification ?? "");
  const [role, setRole] = useState<OfficialRole>(official?.role ?? "judge");
  const [notes, setNotes] = useState(official?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /** Picking a member fills the name in, since that is why you picked them. */
  function chooseStudent(id: string) {
    setStudentId(id);
    const student = students.find((s) => s.id === id);
    if (student) {
      setFullName(student.fullName);
      if (student.clubId) setClubId(student.clubId);
    }
  }

  async function save() {
    setBusy(true);
    setError("");
    const result = await saveOfficial({
      eventId,
      officialId: official?.id,
      fullName,
      studentId: studentId || null,
      clubId: clubId || null,
      country,
      qualification,
      role,
      notes,
    });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    onDone();
  }

  return (
    <div className="mt-4 rounded-md border border-brand-200 bg-brand-50/40 p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label text-xs">On the system?</label>
          <select className="input" value={studentId} onChange={(e) => chooseStudent(e.target.value)}>
            <option value="">Not a member — type the name</option>
            {students.map((s) => (<option key={s.id} value={s.id}>{s.fullName}</option>))}
          </select>
        </div>
        <div>
          <label className="label text-xs">Name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
        </div>
        <div>
          <label className="label text-xs">Role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as OfficialRole)}>
            {OFFICIAL_ROLES.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
          </select>
        </div>
        <div>
          <label className="label text-xs">Club</label>
          <select className="input" value={clubId} onChange={(e) => setClubId(e.target.value)}>
            <option value="">None</option>
            {clubs.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
        <div>
          <label className="label text-xs">Country</label>
          {/* Picked, not typed. It was free text, and a visiting umpire entered
              as "Korea, Republic of" got no flag beside their name while
              "Malaysia" did — the list is the same one the rest of the app
              uses, so what is chosen here always matches. */}
          <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Not specified</option>
            {COUNTRIES_BY_CONTINENT.map((group) => (
              <optgroup key={group.continent} label={group.continent}>
                {group.countries.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs">Qualification</label>
          <input className="input" value={qualification} onChange={(e) => setQualification(e.target.value)}
            placeholder="e.g. International Class A" />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label text-xs">Notes</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Availability, travel, anything the coordinator needs" />
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-500">{OFFICIAL_ROLES.find((r) => r.value === role)?.note}</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => { void save(); }}>
          {busy ? "Saving…" : official ? "Save changes" : "Add official"}
        </button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
