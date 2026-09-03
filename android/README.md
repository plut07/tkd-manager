# The Android judge app

This is not a second codebase. The app is a **Trusted Web Activity**: the same
judge pad this site already serves, wrapped so it installs from an APK, appears
in the launcher, and runs with no browser chrome. One set of scoring code, one
thing to test, and a fix ships by deploying the site rather than by asking every
referee to update an app.

Everything the app needs is already live:

- the pad itself at `/public/judge`
- `/manifest.webmanifest`, which names and shapes it
- `/sw.js`, which lets it open without a signal
- the press queue, which is what actually keeps a judge scoring when the hall's
  wifi drops

What this folder adds is the wrapper.

## Building it

You need a JDK (17 or newer) and Node. Bubblewrap fetches the Android SDK
itself the first time.

### 1. Generate the signing key — once, ever

```bash
keytool -genkeypair -v -keystore android/android.keystore -alias tkdjudge -keyalg RSA -keysize 2048 -validity 10000
```

**Keep this file and its password.** An app signed with a different key is a
different app to Android: phones will refuse to update, and everyone has to
uninstall and reinstall. It is deliberately not in this repository and must not
be committed — `.gitignore` already excludes it.

### 2. Tell the site to vouch for the app

Read the key's fingerprint:

```bash
keytool -list -v -keystore android/android.keystore -alias tkdjudge
```

Copy the **SHA256** line, then set it on the Vercel deployment as
`ANDROID_CERT_FINGERPRINT` (Settings → Environment Variables) and redeploy.

Check it took:

```bash
curl https://tkd-manager-tkdtta.vercel.app/.well-known/assetlinks.json
```

An empty `[]` means the variable isn't set yet. Without it the app still runs,
but with an address bar across the top of the scoring buttons — which is the
whole reason for building it.

### 3. Build the APK

```bash
npx @bubblewrap/cli init --manifest https://tkd-manager-tkdtta.vercel.app/manifest.webmanifest
npx @bubblewrap/cli build
```

`init` will offer to use `twa-manifest.json` in this folder — take it, it is
already filled in. The APK lands as `app-release-signed.apk`.

### 4. Publish it

Sign in as an admin, go to **App releases**, and either upload the APK or
publish a link to it. A GitHub Release is the easier of the two: no size limit
worth worrying about and a permanent address. Judges then get it from
`/public/app`, or by scanning the poster.

## Updating

Because the app is a wrapper, **the scoring code updates when the site
deploys** — nobody reinstalls anything for a rule change or a bug fix.

Rebuild the APK only when the wrapper itself changes: a new icon, a new name, a
different start page. Bump `appVersionCode` in `twa-manifest.json` when you do,
or phones will refuse the update.
