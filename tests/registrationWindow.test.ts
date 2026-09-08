import test from "node:test";
import assert from "node:assert/strict";
import { registrationBadge, formatRemaining } from "../src/lib/registrationWindow";

/**
 * The badge on an event card.
 *
 * It is the most-read thing on the portal — a coach scanning forty events is
 * looking for the ones still open and how long they have — and it is made of
 * date arithmetic, which is the classic place for an off-by-one that nobody
 * notices until somebody misses a deadline.
 */

const NOW = new Date("2026-09-09T12:00:00Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();
const agoDays = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

test("an open window says how long is left", () => {
  const badge = registrationBadge(
    { status: "upcoming", start_date: inDays(30), end_date: inDays(31), registration_deadline: inDays(5) },
    NOW,
  );
  assert.equal(badge.state, "open");
  assert.equal(badge.label, "REG. ENDS IN 5 DAYS");
});

test("a passed deadline is expired, not open", () => {
  const badge = registrationBadge(
    { status: "upcoming", start_date: inDays(10), end_date: inDays(11), registration_deadline: agoDays(1) },
    NOW,
  );
  assert.equal(badge.state, "expired");
  assert.equal(badge.label, "REGISTRATION EXPIRED");
});

test("no deadline means entries are handled elsewhere, not that you are too late", () => {
  // These are different answers and the card must not conflate them.
  const badge = registrationBadge({ status: "upcoming", start_date: inDays(10), registration_deadline: null }, NOW);
  assert.equal(badge.state, "none");
  assert.equal(badge.label, "NO ONLINE REGISTRATION");
});

test("a finished event is closed whatever its deadline says", () => {
  // The deadline is about entries; the event has already answered the question.
  const badge = registrationBadge(
    { status: "upcoming", start_date: agoDays(30), end_date: agoDays(29), registration_deadline: inDays(5) },
    NOW,
  );
  assert.equal(badge.state, "expired");
  assert.equal(badge.label, "REGISTRATION CLOSED");
});

test("a cancelled event says so rather than offering entry", () => {
  const badge = registrationBadge(
    { status: "cancelled", start_date: inDays(10), registration_deadline: inDays(5) },
    NOW,
  );
  assert.equal(badge.label, "CANCELLED");
});

test("a window that has not opened yet counts down to opening", () => {
  const badge = registrationBadge(
    {
      status: "upcoming",
      start_date: inDays(40),
      registration_deadline: inDays(30),
      registration_opens_at: inDays(3),
    },
    NOW,
  );
  assert.equal(badge.state, "soon");
  assert.match(badge.label, /^REGISTRATION OPENS IN 3 DAYS$/);
});

test("the countdown shows two units at most, and the right two", () => {
  const H = 3_600_000;
  const M = 60_000;
  assert.equal(formatRemaining(5 * 24 * H + 6 * H), "5 DAYS 6 HOURS");
  // Days present, so minutes are noise.
  assert.equal(formatRemaining(5 * 24 * H + 6 * H + 30 * M), "5 DAYS 6 HOURS");
  // Under a day, minutes start mattering.
  assert.equal(formatRemaining(6 * H + 12 * M), "6 HOURS 12 MINUTES");
  // Under an hour, minutes are all that is left.
  assert.equal(formatRemaining(22 * M), "22 MINUTES");
  // Singular, because "1 DAYS" looks like a bug to everyone who sees it.
  assert.equal(formatRemaining(24 * H), "1 DAY");
  assert.equal(formatRemaining(1 * H + 1 * M), "1 HOUR 1 MINUTE");
});

test("the last seconds round up to a minute rather than showing nothing", () => {
  // "REG. ENDS IN " with an empty tail is worse than a slightly generous 1.
  assert.equal(formatRemaining(30_000), "1 MINUTE");
  assert.equal(formatRemaining(0), "");
});
