# TKD Manager

A web-based event & student management system for organizing Taekwon-Do
events and keeping club/student data up to date year-round.

Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and Supabase
(Postgres) — deployable to Vercel.

## What's included

- **Login** with a seeded Super Admin account (User ID `Admin`, password
  `SuperAdmin@225588` — change this after your first login).
- **Role-based access control** with three roles out of the box (Super
  Admin, Event Manager, Club User) and a visual **access-rights matrix**
  (Users & Access → Access rights matrix) where a Super Admin can toggle,
  per role: create/edit/delete/view for Users, Events, and Students.
- **Clubs** management (Super Admin only) — the base data students and
  Club User accounts attach to.
- **Students** page with Club, First/Last name, Email, Birthday, Weight
  (KG), Height (cm), Gup (1–10), Dan (1–9), Gender, Nationality, ID number,
  Passport ID, and Active/Inactive. Club User accounts only ever see and
  edit their own club's students.
- **Events** page inspired by sportdata.org's event-info layout: header
  (dates, venue, organizer, registration deadline, status), categories /
  divisions, registered clubs & athletes, and a documents/downloads list.
  The categories list shows each division's entry count, and only offers
  **Remove** on an empty one — deleting a category takes its draw with it and
  leaves its entries with no category at all, which is not something a stray
  click on one row of forty should be able to do.
- **Registration & approval** — entries land in a pending list until an
  organizer confirms them; confirmed competitors are auto-assigned a
  competition number, and each club can export its confirmed list as CSV.
- **Draws** (competition events) — a Draws tab listing every category with
  its confirmed-competitor count and bracket status, plus a full bracket
  view with score entry (0–5 per side), manual first-round swaps, and
  draft/publish control. See "Draw seeding" below.
- **Grading registration** (grading events) — generates a Tally.so form per
  event; submissions arrive by webhook, auto-match existing students by
  national ID / passport, and stage unknown registrants for Super Admin
  approval, which creates the student profile. See "Grading setup" below.
- **Live scoreboard** — rings with a five-character join code, a judge's pad
  per phone, a hall display, and a per-event design for both. See "Scoring a
  bout" below.
- **Public pages** — a signed-out event list and published brackets.

## The five disciplines

Open a category under **Draw & Scoreboard** and it gives you the tool that
discipline actually needs, because ITF runs three different shapes of
competition:

| Category type | What you get |
| ------------- | ------------ |
| Pattern, Sparring, Pre-arrange | a draw, a bracket and the live scoreboard |
| Team Pattern, Team Sparring | the same, plus a team sheet to build the teams first |
| Power Breaking, Special Event | a score sheet and a standings table — no draw |

### Teams

A team is entered as a competitor in its own right: name it, pick the club it
competes for, and put people on the sheet in the order they compete. Reserves
are marked as such and carried, since ITF allows substitutes and a reserve
still has to be registered like everyone else.

Everything after that treats a team exactly like any other entrant — the draw
seeds it (keeping clubmates apart the same way), it gets a competition number,
and the scoreboard names it. There is no separate team bracket because none is
needed.

### Power test and special technique

Nobody faces anybody, so there is no draw. Each competitor takes a set number
of attempts at each of a set list of techniques, and the category is ranked on
the totals.

- **Power test** records boards broken; **special technique** records the
  height reached, in centimetres.
- A competitor's mark at a technique is their **best** attempt at it, and their
  total is the sum of those bests.
- Type a number for each attempt. Leave a box **empty** for an attempt not
  taken, or **x** for one that missed — the two are different, and the
  difference decides ties.
- A tie on the total is broken by who needed **fewer attempts** to get there.
  Anything still level is shown as level (`1=`) rather than separated by
  whichever row the database happened to return first; ITF orders a re-try,
  which you record as a further attempt.

Each category picks its own techniques and attempt count, under **Techniques &
attempts** — a junior power test is not the senior one.

**Show standings publicly** puts the running order on a public link so the hall
can follow along, which is what a published bracket does for a fought division.
Nothing is final until the event's results are published.

### Waivers

An individual entry collects one signature. **A team collects one per member** —
the signing link is shared, and the page is a checklist the coach hands round,
showing who has signed and who hasn't. An entry counts as signed only when
everyone on its sheet has.

## Scoring a bout

Three modes, one shape: judges each reach their own verdict and the majority
decides the bout, which is how ITF scores it.

| Mode     | The judge does                                              |
| -------- | ----------------------------------------------------------- |
| Sparring | awards 1, 2 or 3                                            |
| Pattern  | starts at the event's mark and deducts for faults           |
| Flag     | picks a side                                                |

The sparring values are the ITF ones — 1 for a hand attack to mid or high
section and a foot attack to mid; 2 for a hand attack in the air to high, a
jumping or flying kick to mid, and a foot attack to high; 3 for a jumping or
flying kick to high. Each button says what it is for. The minus buttons beneath
them are corrections, for a judge who spots a mistake after Undo can no longer
reach it; they are not deductions. A **deduction** is the referee's call and is
pressed on the ring screen, where three warnings also cost a point.

Nothing stores a running total. Every press is a row, so an undo is one row
marked void and a disputed bout can be recounted press by press, weeks later.

**Time up on the final round ends the bout**, whether or not anybody has
pressed End — the pads stop taking presses at the bell.

**A level bout** is settled the ITF way: fight an extra round, and if the
judges are still level after it the referee gives it to whoever showed
superiority. Both are on the ring screen when — and only when — the judges are
actually level. A result won that way is recorded as won on a decision, so a
result sheet never shows "2–2" beside a winner's name.

### The judge app

Judges score on their own phones at `/public/judge` with the code the ring
official gives them. There is no account: the code grants exactly one thing,
pressing a scoring button on that ring, so it is safe to say out loud in a hall.

Guessing at codes is throttled by counting **different** wrong codes, not
attempts — a dozen inside fifteen minutes and that address waits. The
distinction matters because a venue is one address for the whole hall:
retyping the same fumbled code as often as you like is a person, and a run of
different ones is a script.

The pad is installable. On the sign-in screen, **Add to home screen** puts it
on the phone properly, where it opens full-screen with no address bar to
fat-finger mid-bout — and where the phone treats its storage as worth keeping.

**It keeps working when the wifi drops.** Every press is written to the phone
before it is sent, and leaves the phone only once the ring has confirmed it. A
judge who loses signal for half a round keeps pressing; a line at the top says
how many presses are still waiting, and they go by themselves when the signal
comes back. Two things make that safe, and both are enforced by the server: a
press that arrives twice is counted once, and a press made during one bout is
refused if the ring has moved on to the next.

### The Android app

There is also an APK, for referees who would rather install an app than add a
web page to their home screen. It is a wrapper around the same pad — a Trusted
Web Activity — so there is no second codebase and no second set of scoring
rules, and **the app updates when the site deploys**. Nobody reinstalls
anything for a rule change.

Building and signing it is documented in [`android/README.md`](android/README.md).
The signing key is yours to generate and hold; it is the one file here that
cannot be regenerated.

## Draw seeding

First-round pairings are chosen greedily to keep clubmates and compatriots
apart for as long as possible. Each candidate pairing is scored:

| Severity | Meaning                                  |
| -------- | ---------------------------------------- |
| 0        | different club **and** different country |
| 1        | same country, different club             |
| 2        | same club                                |

The algorithm always takes the lowest available severity, so competitors
only meet a compatriot when there is no other option, and only meet a
clubmate as a last resort. Pairs are then distributed across the bracket so
that large clubs are spread over different quarters rather than stacked.

Byes are assigned automatically when the entry count isn't a power of two.

There is **no third-place match**: both beaten semi-finalists take a bronze,
which is how Taekwon-Do is medalled, so there is nothing left for them to
fight over. (An earlier version of this file claimed the opposite. The code
has always done it this way.)

## Officials

**Officials** lists everyone umpiring a competition, and seats them on rings.

They are their own list rather than students, because most of a panel isn't on
the system — an international umpire flies in, judges for two days and goes
home. Linking one to a member is offered, not required; picking a member fills
in their name and club.

Seat numbers are the scoreboard's own: **slot 0 is the referee**, 1–9 are the
corner judges, so a press and the person who made it line up without a
translation step. Seating somebody already sitting elsewhere moves them rather
than listing them twice.

What this buys you:

- a judge's pad says **their name** rather than "Judge 3", so they can see at a
  glance they're on the right seat
- the ring screen names the referee and each judge beside their marks
- **every confirmed result carries a copy of the panel that called it** — not a
  reference to it. Panels rotate through the day, so by evening the ring says
  who is sitting there *now*; a bout questioned a week later needs to know who
  sat there *then*. Removing an official afterwards doesn't take the record
  with them.

None of it is required. A club competition can leave the list empty and judges
just take a seat number, exactly as before.

## Results

Once the day is done, **Results** on a competition shows every division's
podium and the medal table, by club and by country. It is gathered from the
draws and the score sheets rather than stored, so correcting a bout corrects
the medal table and there is no second copy to drift out of step.

Medal tables are ordered by golds first, then silvers, then bronzes — one gold
outranks any number of silvers. Clubs level on all three share a rank.

Results stay private until **Publish results** is pressed, which puts them on
the event's public page. Divisions still being fought are shown to organisers
(so they can see what is left) but left off the public page, where a half
podium would read as a result rather than as an absence.

## Grading setup

Grading events use a Tally.so form instead of manual entry.

1. Create an API key at <https://tally.so/settings/api>.
2. Set `TALLY_API_KEY` and `APP_BASE_URL` in your environment (see below).
3. Open a grading event → **Grading registration** → **Create Tally form**.
   This creates a published form and registers a webhook back to
   `/api/grading-webhook`.
4. Share the form link. Submissions appear automatically:
   - a registrant matching an existing student (by national ID or passport)
     is registered for the event straight away;
   - anyone else is staged under **New registrants awaiting approval**,
     where a Super Admin assigns a club and approves, creating the student.

"Sync now" is only needed to backfill responses submitted before the
webhook existed — normal traffic arrives on its own. Webhook payloads are
verified with an HMAC-SHA256 signature, so only genuine Tally deliveries
are accepted.

## Tech notes

- Auth is custom (not Supabase Auth) so that logins use a plain "User ID"
  rather than an email address, per the spec. Passwords are hashed with
  bcrypt; sessions are signed JWTs in an httpOnly cookie.
- All database access happens server-side using the Supabase
  **service_role** key (via Server Components and Server Actions). That
  key is never sent to the browser. Row Level Security is enabled on every
  table with no public policies, so the anon/publishable key can't read or
  write anything even by mistake.
- Authorization is enforced in code (`src/lib/authz.ts`) on every page and
  server action, not just in the UI — links are hidden for users without a
  permission, but the server also refuses the action if attempted directly.
- `/api/grading-webhook` is the one route exempt from the auth middleware,
  since Tally calls it unauthenticated; it is protected by signature
  verification instead.

## 1. Create the Supabase project

1. In Supabase, create a new project (in your **TKD** organization).
2. Open the SQL editor and run every file in `supabase/migrations/`
   **in filename order**, `0001_schema.sql` through `0009_grading_tally.sql`.
   (`0002_seed.sql` creates the roles, the 12 permissions, and the `Admin`
   super admin login.)
3. Go to Project Settings → API and copy the **Project URL** and the
   **service_role** key (not the anon key — keep this secret).

## 2. Configure the app

```bash
cp .env.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_SECRET=<generate with: openssl rand -base64 48>

# Only needed for grading events:
TALLY_API_KEY=your-tally-api-key
APP_BASE_URL=https://your-app.vercel.app
```

`APP_BASE_URL` must be the publicly reachable URL of the deployment, since
Tally calls it to deliver submissions. Locally you can leave the Tally
variables unset — everything except the grading tab works without them.

## 3. Run it locally

```bash
npm install
npm run dev
```

Visit http://localhost:3000, sign in as `Admin` / `SuperAdmin@225588`, then:

1. Go to **Clubs** and add your clubs.
2. Go to **Users & Access** and create a Club User account per club (or an
   Event Manager account), assigning the right club.
3. Optionally adjust who can do what in **Access rights matrix**.
4. Start adding students and events.

If you ever get locked out of the Admin account, you can reset its
password from the command line:

```bash
npm run seed -- --password "NewPassword123!"
```

## 4. Deploy to Vercel

Connect this repo to Vercel rather than uploading files — Vercel then
builds each push incrementally, which is both faster and much safer than
re-uploading the whole tree.

1. Push this project to a Git repo (GitHub/GitLab/Bitbucket).
2. In Vercel: **Add New → Project → Import** that repo. Framework detection
   picks up Next.js automatically; no build settings need changing.
3. Add the environment variables from `.env.local` under **Settings →
   Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, and — if you use grading
   events — `TALLY_API_KEY` and `APP_BASE_URL`.
4. Deploy. Every later `git push` to the default branch ships to
   production; pushes to other branches get preview URLs.

After the first deploy, set `APP_BASE_URL` to the real production URL and
redeploy, so Tally webhooks point at the right place.

### Connecting to the existing `tkd-manager` Vercel project

If you want to keep the current production URLs rather than create a new
project, open the existing **tkd-manager** project in Vercel → **Settings →
Git → Connect Git Repository** and point it at the new repo. The aliases
(`tkd-manager-tkdtta.vercel.app` and friends) and existing environment
variables carry over; only the deploy mechanism changes.

## Known limitations / good next steps

- Event "documents" are stored as links (title + URL) rather than file
  uploads. Wiring up Supabase Storage for direct PDF/image uploads is a
  natural next step.
- No password-reset-by-email flow (admin resets passwords manually from
  the Users page, or via `npm run seed`).
- `npm test` covers the scoring arithmetic — the clock, the verdict, the
  penalties, the tie-break, and the measured-discipline standings — which is
  the part where being quietly wrong matters more than being broken. Nothing
  else has tests yet.
- Everything on the sportdata.org reference is now built: draws, the
  scoreboard, all five disciplines, officials, results and medal tables, and
  grading registration.
- No automated tests outside `npm test`'s scoring, standings, medal and waiver
  arithmetic — the parts where being quietly wrong is worse than being broken.
