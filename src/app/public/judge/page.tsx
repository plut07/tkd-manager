import { headers } from "next/headers";
import { loadRing } from "@/app/(app)/events/scoreboardActions";
import JudgePad from "@/components/JudgePad";
import { callerIp, checkJoinCodeAttempts, recordJoinCodeMiss, clearJoinCodeMisses } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * A judge's station.
 *
 * No login: a judge is handed a five-character code and a seat number at the
 * table, and that is the whole sign-in. The code only ever lets them press
 * their own buttons on one bout — it can't read the draw, the entries or
 * anything else — so it is safe to say out loud in a hall.
 */
export default async function JudgePage({
  searchParams,
}: {
  searchParams: { code?: string; judge?: string };
}) {
  const code = (searchParams.code ?? "").trim().toUpperCase();
  const judgeSlot = Number(searchParams.judge ?? 0);

  // This page takes a code in the address, so it can be guessed at exactly like
  // the endpoint the app uses, and is throttled the same way. Only misses count
  // — a judge already on their ring reloads freely.
  const ip = callerIp(headers());
  const verdict = await checkJoinCodeAttempts(ip);
  const blocked = !verdict.allowed;

  const ring = code && !blocked ? await loadRing({ joinCode: code }) : null;
  if (code && !blocked) {
    if (!ring) await recordJoinCodeMiss(ip);
    else if (verdict.allowed && verdict.hadMisses) await clearJoinCodeMisses(ip);
  }

  if (blocked) {
    return (
      <div className="mx-auto max-w-sm p-6">
        <h1 className="text-lg font-semibold text-gray-900">Too many attempts</h1>
        <p className="mt-2 text-sm text-gray-600">
          That was ten wrong codes in a row. Wait a few minutes, then try again — and check the code with the ring
          official rather than guessing at it.
        </p>
      </div>
    );
  }

  // Step one: the code.
  if (!ring) {
    return (
      <div className="mx-auto max-w-sm p-6">
        <h1 className="text-lg font-semibold text-gray-900">Judge sign-in</h1>
        <p className="mt-1 text-sm text-gray-500">Enter the code the ring official gave you.</p>
        <form method="get" className="mt-4 space-y-3">
          <input
            name="code"
            defaultValue={code}
            autoFocus
            autoCapitalize="characters"
            className="input text-center font-mono text-2xl tracking-[0.4em] uppercase"
            placeholder="ABCDE"
            maxLength={5}
          />
          {code && <p className="text-sm text-red-600">No ring is using that code.</p>}
          <button type="submit" className="btn-primary w-full">Continue</button>
        </form>
      </div>
    );
  }

  // Step two: which seat. Kept separate so two judges can't end up on the same
  // number by fumbling one screen.
  if (!judgeSlot || judgeSlot < 1 || judgeSlot > ring.judgeCount) {
    return (
      <div className="mx-auto max-w-sm p-6">
        <h1 className="text-lg font-semibold text-gray-900">{ring.name}</h1>
        <p className="mt-1 text-sm text-gray-500">Which judge are you?</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {Array.from({ length: ring.judgeCount }, (_, i) => i + 1).map((n) => (
            <a key={n} href={`/public/judge?code=${ring.joinCode}&judge=${n}`} className="btn-secondary py-6 text-center text-xl font-bold">
              Judge {n}
            </a>
          ))}
        </div>
      </div>
    );
  }

  return <JudgePad initial={ring} joinCode={ring.joinCode} judgeSlot={judgeSlot} />;
}
