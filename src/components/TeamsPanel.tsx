"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveTeam, deleteTeam, setTeamStatus, type TeamDto } from "@/app/(app)/events/teamActions";

/**
 * Entering teams for a team category.
 *
 * A team is assembled from students already on the system, given a name, and
 * entered against a club. From then on it is a competitor like any other: the
 * draw seeds it, it gets a competition number, the scoreboard names it. That
 * is why there is no team bracket and no team scoreboard -- there was never a
 * need for either.
 *
 * Reserves are carried because ITF allows substitutes, and because a reserve
 * who never steps on the mat still had to be registered and insured.
 */

export type EligibleStudent = { id: string; fullName: string; clubId: string | null; clubName: string | null };

export default function TeamsPanel({
  eventId,
  categoryId,
  categoryName,
  teams,
  students,
  clubs,
  canEdit,
}: {
  eventId: string;
  categoryId: string;
  categoryName: string;
  teams: TeamDto[];
  students: EligibleStudent[];
  clubs: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function remove(registrationId: string, name: string) {
    if (!window.confirm(`Remove ${name || "this team"} from ${categoryName}?`)) return;
    setBusy(true);
    setError("");
    const result = await deleteTeam({ eventId, registrationId });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    router.refresh();
  }

  async function confirm(registrationId: string, status: "pending" | "confirmed") {
    setBusy(true);
    setError("");
    const result = await setTeamStatus({ eventId, registrationId, status });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    router.refresh();
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Teams in {categoryName}</h3>
          <p className="text-xs text-gray-500">
            A team is drawn, numbered and scored as one competitor. Confirm a team and it goes into the draw like
            anybody else.
          </p>
        </div>
        {canEdit && !creating && (
          <button type="button" className="btn-primary" onClick={() => { setCreating(true); setEditing(null); }}>
            Enter a team
          </button>
        )}
      </div>

      {error && <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {creating && (
        <TeamForm
          eventId={eventId}
          categoryId={categoryId}
          students={students}
          clubs={clubs}
          onDone={() => { setCreating(false); router.refresh(); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {teams.length === 0 && !creating ? (
        <p className="mt-4 rounded-md border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
          No teams entered yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {teams.map((team) =>
            editing === team.registrationId ? (
              <TeamForm
                key={team.registrationId}
                eventId={eventId}
                categoryId={categoryId}
                students={students}
                clubs={clubs}
                team={team}
                onDone={() => { setEditing(null); router.refresh(); }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div key={team.registrationId} className="rounded-md border border-gray-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {team.competitionNumber ? `#${team.competitionNumber} ` : ""}
                      {team.name}
                      <span
                        className={`ml-2 badge ${
                          team.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {team.status === "confirmed" ? "Confirmed" : "Pending"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">{team.clubName ?? "No club"}</p>
                    <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
                      {team.members.map((m) => (
                        <li key={m.studentId}>
                          {m.position}. {m.fullName}
                          {m.isReserve && <span className="ml-1 text-xs text-gray-400">(reserve)</span>}
                        </li>
                      ))}
                    </ol>
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-secondary !px-3 !py-1.5 text-xs"
                        disabled={busy}
                        onClick={() => { void confirm(team.registrationId, team.status === "confirmed" ? "pending" : "confirmed"); }}
                      >
                        {team.status === "confirmed" ? "Un-confirm" : "Confirm"}
                      </button>
                      <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" disabled={busy}
                        onClick={() => { setEditing(team.registrationId); setCreating(false); }}>
                        Edit sheet
                      </button>
                      <button type="button" className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40"
                        disabled={busy} onClick={() => { void remove(team.registrationId, team.name); }}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Name the team, pick its club, and put people on the sheet in order. */
function TeamForm({
  eventId,
  categoryId,
  students,
  clubs,
  team,
  onDone,
  onCancel,
}: {
  eventId: string;
  categoryId: string;
  students: EligibleStudent[];
  clubs: { id: string; name: string }[];
  team?: TeamDto;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(team?.name ?? "");
  const [clubId, setClubId] = useState(team?.clubId ?? clubs[0]?.id ?? "");
  const [members, setMembers] = useState<{ studentId: string; isReserve: boolean }[]>(
    team?.members.map((m) => ({ studentId: m.studentId, isReserve: m.isReserve })) ?? [{ studentId: "", isReserve: false }, { studentId: "", isReserve: false }],
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Only students of the team's own club: a team competes for one club, and
  // offering the whole event's entry list is how somebody ends up on two teams.
  const eligible = students.filter((s) => !clubId || s.clubId === clubId);
  const chosen = new Set(members.map((m) => m.studentId).filter(Boolean));

  function setMember(index: number, patch: Partial<{ studentId: string; isReserve: boolean }>) {
    setMembers((held) => held.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  async function save() {
    setBusy(true);
    setError("");
    const result = await saveTeam({
      eventId,
      categoryId,
      registrationId: team?.registrationId,
      name,
      clubId,
      members: members.filter((m) => m.studentId),
    });
    setBusy(false);
    if ("error" in result) { setError(result.error); return; }
    onDone();
  }

  return (
    <div className="mt-4 rounded-md border border-brand-200 bg-brand-50/40 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label text-xs">Team name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kuala Lumpur A" />
        </div>
        <div>
          <label className="label text-xs">Competing for</label>
          <select className="input" value={clubId} onChange={(e) => { setClubId(e.target.value); setMembers(members.map((m) => ({ ...m, studentId: "" }))); }}>
            <option value="">Choose a club</option>
            {clubs.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className="label text-xs">Team sheet — in the order they compete</label>
        <div className="space-y-2">
          {members.map((member, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span className="w-5 text-center text-sm text-gray-400">{i + 1}</span>
              <select
                className="input !w-64"
                value={member.studentId}
                onChange={(e) => setMember(i, { studentId: e.target.value })}
              >
                <option value="">Choose a competitor</option>
                {eligible
                  // Somebody already on this sheet is not offered again, except
                  // in their own row.
                  .filter((s) => !chosen.has(s.id) || s.id === member.studentId)
                  .map((s) => (<option key={s.id} value={s.id}>{s.fullName}</option>))}
              </select>
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input type="checkbox" checked={member.isReserve} onChange={(e) => setMember(i, { isReserve: e.target.checked })} />
                Reserve
              </label>
              {members.length > 2 && (
                <button type="button" className="text-xs font-medium text-red-600 hover:underline"
                  onClick={() => setMembers(members.filter((_, n) => n !== i))}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" className="btn-secondary mt-2 !px-3 !py-1.5 text-xs"
          onClick={() => setMembers([...members, { studentId: "", isReserve: false }])}>
          Add another
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => { void save(); }}>
          {busy ? "Saving…" : team ? "Save team sheet" : "Enter this team"}
        </button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
