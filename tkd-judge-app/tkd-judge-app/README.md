# TKD Judge

The judge's pad, as an Android app. One judge, one ring, one screen.

Everything else about the scoreboard — setting the bout up, the clock, warnings
and deductions, confirming the result — stays with the operator on the web,
where there is a keyboard and a monitor.

## What it does

1. The judge types the scoreboard address and the 5-character join code.
2. They pick their seat number.
3. They score.

**Presses are never lost.** A press is recorded on the phone first and sent
afterwards. If the wifi drops, the button still works, the header says
`Offline · 3 waiting`, and everything goes out the moment the connection
returns. Closing the app doesn't lose them either — the queue is saved on the
device.

**Presses are never counted twice.** Each one is given a name by the phone, and
the server refuses a second press with the same name. That is what makes it
safe for a phone to resend something it isn't sure arrived.

**A press can't land on the wrong bout.** Each press remembers which bout it
was made in. If the ring has moved on by the time it is sent, it is dropped and
the judge is told, rather than quietly scoring the next pair.

---

## Building the APK

You need a free [Expo account](https://expo.dev). Everything below is typed
into a terminal in this folder.

### One time only

```
npm install
npm install -g eas-cli
eas login
eas build:configure
```

`eas build:configure` fills in the project id in `app.json` — the placeholder
that currently says `REPLACE-AFTER-FIRST-EAS-BUILD`. Let it.

### Every time you want a new APK

```
eas build --platform android --profile apk
```

The build runs on Expo's servers, takes roughly 10–15 minutes, and ends with a
download link. That `.apk` file is what you send to the judges.

### Installing it on a phone

Android will warn about installing an app from outside the Play Store. That
warning is expected — the app isn't published, which is what you asked for.
The judge taps **Install anyway** (the exact wording varies by phone).

### Trying it before you build

```
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app from the Play Store. This runs the
real app on a real phone without building anything, which is the fastest way to
check it against a live ring.

---

## What to type as the scoreboard address

Whatever you use to reach the web app, without the `https://`:

```
tkd-manager.vercel.app
```

The app remembers it, so a judge only types it the first time.

## Getting the join code

The operator's Scoreboard tab shows it next to the ring name. It is the same
code the web judge page uses — the app and the browser can be mixed at the same
table, and both go through the same server code.

---

## Files

| File | What it is |
| --- | --- |
| `App.tsx` | The three screens: join, pick a seat, score |
| `src/api.ts` | Talking to the scoreboard, and telling "offline" apart from "refused" |
| `src/queue.ts` | Presses waiting to be sent. Pure, and tested — this is the part that matters |
| `src/scoring.ts` | Scoring arithmetic, copied from the web app's `src/lib/scoreboard.ts` |

`src/scoring.ts` is a **copy**, not a shared package. If the scoring rules ever
change, the web file is the source of truth and this one should be replaced
from it wholesale rather than edited. The app never decides a result — the
server tallies the bout — so a drift here would only affect what one judge sees
on their own pad, but it would still be wrong.

## iOS

`eas build --platform ios` works from the same code, but Apple requires a paid
developer account ($99/year) and there is no equivalent of sideloading an APK.
That is the only reason this is Android-first, and nothing in the code is
Android-specific.
