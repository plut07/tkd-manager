# TKD Manager

A web-based event & student management system for organizing Taekwon-Do
events and keeping club/student data up to date year-round.

Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and Supabase
(Postgres) — deployable to Vercel.

## What's included

- **Role-based access control** with three roles out of the box (Super
  Admin, Event Manager, Club User) and a visual **access-rights matrix**
  (Users & Access → Access rights matrix) where a Super Admin can toggle,
  per role: create/edit/delete/view for Users, Events, and Students.
- **Clubs** management (Super Admin only) — the base data students and
  Club User accounts attach to.
- **Students** page with Club, First/Last name, Email, Birthday, Weight
  (KG), Height (cm), Gender, Nationality, ID number,
  Passport ID, and Active/Inactive. Club User accounts only ever see and
  edit their own club's students.
- **Events** page inspired by sportdata.org's event-info layout: header
  (dates, venue, organizer, registration deadline, status), categories /
  divisions, registered clubs & athletes, and a documents/downloads list.
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
- **Public pages** — a signed-out event list and published brackets.

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

Byes are assigned automatically when the entry count isn't a power of two,
and a third-place match is created whenever there are two semi-finals.

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

Visit http://localhost:3000, sign in then:

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
