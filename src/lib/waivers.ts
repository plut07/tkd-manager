/**
 * Reading a registration's waiver signatures.
 *
 * These used to be one row per entry, and every screen embedded them as
 * `waiver_signatures(...)` and treated the result as an object or null. Team
 * entries collect one signature per member, so the unique constraint had to go
 * — and the moment it did, PostgREST began returning the embed as an *array*.
 *
 * That is a quiet and nasty change: an empty array is truthy in JavaScript, so
 * `r.waiver_signatures ? "Signed" : "Not signed"` starts saying Signed for
 * everybody. Hence one place that knows the shape, rather than four that assume
 * it.
 */

export type SignatureRow = {
  student_id?: string | null;
  signed_name?: string | null;
  signed_at?: string | null;
  signature_png?: string | null;
};

/** However the embed came back, as a list. */
export function signatureList(embedded: unknown): SignatureRow[] {
  if (Array.isArray(embedded)) return embedded as SignatureRow[];
  if (embedded && typeof embedded === "object") return [embedded as SignatureRow];
  return [];
}

/**
 * The signature for an individual entry, or null.
 *
 * An individual's signature is the one with no member against it; a team's
 * rows each name a member, and none of them is "the" signature for the entry.
 */
export function individualSignature(embedded: unknown): SignatureRow | null {
  const rows = signatureList(embedded);
  return rows.find((row) => !row.student_id) ?? null;
}

/**
 * Whether an entry counts as signed.
 *
 * An individual needs their one signature. A team needs one from every member
 * on its sheet — `memberCount` says how many that is, and a team with nobody on
 * it yet is not signed, however many rows happen to exist.
 */
export function isSigned(embedded: unknown, isTeam: boolean, memberCount = 0): boolean {
  const rows = signatureList(embedded);
  if (!isTeam) return individualSignature(rows) !== null;
  return memberCount > 0 && rows.filter((row) => row.student_id).length >= memberCount;
}

/** "3 of 5 signed" for a team, or the signer's name for an individual. */
export function signatureSummary(embedded: unknown, isTeam: boolean, memberCount = 0): string {
  const rows = signatureList(embedded);
  if (!isTeam) {
    const one = individualSignature(rows);
    return one?.signed_name ? `Signed by ${one.signed_name}` : "Not signed";
  }
  return `${rows.filter((row) => row.student_id).length} of ${memberCount} signed`;
}
