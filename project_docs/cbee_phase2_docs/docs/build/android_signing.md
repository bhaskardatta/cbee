# Android Signing & AAB

**Week 4 activity.** Generate the release keystore, sign the build, produce the signed Android App Bundle (AAB), test it locally, then hand it off to Swaroop.

This is irreversible: once you sign an AAB with a keystore and publish to Play Store, that keystore is forever the only thing that can update the app. Lose the keystore = lose the app (well, you'd have to publish a NEW app with a new bundle ID).

---

## The keystore — one-time generation

The keystore is a binary file holding a private key + certificate. We generate it ONCE at the start of Week 4 and use it for every future release.

```bash
cd <repo>
mkdir -p secrets   # NOT committed to git
cd secrets

keytool -genkey -v \
  -keystore cbee-release.jks \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias cbee
```

You'll be prompted for:
- **Keystore password:** pick a strong one. Write it down in a password manager (1Password / Bitwarden) and ALSO record it in `secrets/.passwords.txt` (gitignored).
- **Key password:** can be the same as keystore password (acceptable for personal apps). For more security, use a different password.
- **Name and address fields:** fill with Swaroop's real legal name, "cbee", "Bangalore", "Karnataka", "IN". (These are baked into the certificate; not changeable post-publish.)

After this, `secrets/cbee-release.jks` exists. Treat it like a private SSH key — back it up encrypted.

### Confirm `.gitignore` excludes secrets

Verify these are in `.gitignore`:
```
/secrets/
*.jks
*.keystore
*.p12
*.p8
```

Run `git status` after creating the keystore. It should NOT appear. If it does, fix `.gitignore` and `git rm --cached` the file.

---

## Configure Gradle to sign with the keystore

Edit `android/app/build.gradle`. Add a `signingConfigs.release` block and reference it from `buildTypes.release`.

```gradle
android {
    // … existing config …

    signingConfigs {
        release {
            // Pull from environment variables OR from a gitignored properties file.
            // For local builds, set these in ~/.gradle/gradle.properties:
            //   CBEE_KEYSTORE_PATH=/absolute/path/to/cbee-release.jks
            //   CBEE_KEYSTORE_PASSWORD=...
            //   CBEE_KEY_ALIAS=cbee
            //   CBEE_KEY_PASSWORD=...
            storeFile file(System.getenv("CBEE_KEYSTORE_PATH") ?: project.findProperty("CBEE_KEYSTORE_PATH") ?: "../../secrets/cbee-release.jks")
            storePassword System.getenv("CBEE_KEYSTORE_PASSWORD") ?: project.findProperty("CBEE_KEYSTORE_PASSWORD")
            keyAlias System.getenv("CBEE_KEY_ALIAS") ?: project.findProperty("CBEE_KEY_ALIAS") ?: "cbee"
            keyPassword System.getenv("CBEE_KEY_PASSWORD") ?: project.findProperty("CBEE_KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
        // … debug stays as-is …
    }
}
```

### Set the credentials locally

Edit (or create) `~/.gradle/gradle.properties`:

```properties
CBEE_KEYSTORE_PATH=/Users/you/path/to/cbee/secrets/cbee-release.jks
CBEE_KEYSTORE_PASSWORD=your_strong_password
CBEE_KEY_ALIAS=cbee
CBEE_KEY_PASSWORD=your_strong_password
```

This file is in your home directory — NOT the repo — so it's not in git. The Gradle script reads from these properties when building.

---

## Bump version code + name

Every Play Store upload requires a unique `versionCode` (integer) that increases monotonically. Phase 1 shipped versionCode 1. Phase 2 is versionCode 2.

In `android/app/build.gradle`:
```gradle
defaultConfig {
    applicationId "app.cbee.in"
    versionCode 2                  // ← CHANGED from 1
    versionName "2.0"              // ← CHANGED from "1.0"
    minSdkVersion 23
    targetSdkVersion 35            // Android 15 (verify Cap 8 doesn't bump this)
    compileSdkVersion 35
}
```

**Rule:** every future production upload bumps versionCode by 1, even hotfixes. versionName is the human-readable string ("2.0.1", "2.1", etc.).

---

## Build the signed AAB

From repo root:

```bash
# Ensure web bundle is up to date
npm run build
npx cap sync android

# Then build the AAB
cd android
./gradlew bundleRelease
```

Output:
```
android/app/build/outputs/bundle/release/app-release.aab
```

That's the file you upload to Play Store.

---

## Verify the signing

```bash
cd android/app/build/outputs/bundle/release
jarsigner -verify -verbose -certs app-release.aab | head -30
```

Should show `jar verified.` and your cert details.

For a deeper check (Google Play uses this internally):
```bash
# Requires bundletool (download from https://github.com/google/bundletool/releases)
bundletool validate --bundle=app-release.aab
```

---

## Test the AAB on a device before handoff

You can't directly install an AAB. You convert it to a set of APKs and use bundletool:

```bash
# 1. Generate device-specific APK set
bundletool build-apks \
  --bundle=app-release.aab \
  --output=app-release.apks \
  --connected-device \
  --ks=../../../../secrets/cbee-release.jks \
  --ks-key-alias=cbee \
  --ks-pass=pass:<keystore_password> \
  --key-pass=pass:<key_password>

# 2. Install on the connected device
bundletool install-apks --apks=app-release.apks
```

The signed release build now runs on your phone. Smoke-test:
- Launch
- Login
- Open camera (verify permissions prompt looks right)
- Take a photo
- Post it
- Open Reels (if any reels exist)
- Log out

If anything fails, fix and rebuild. If everything works, you have a shippable AAB.

---

## Build the debug APK too (handy for tester distribution)

For ad-hoc testing without the Play Store, also produce a debug APK:

```bash
cd android
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

Share this APK via Drive / WhatsApp for the Google Play 14-day closed test (tester instructions — see Welcome Pack). It's signed with the debug keystore (auto-generated, not your release keystore), so it's distinguishable. Don't use this for production.

---

## Handing off to Swaroop

Two files matter:

1. **`app-release.aab`** — the signed bundle to upload to Play Store
2. **`cbee-release.jks`** + the passwords — the keystore, REQUIRED for every future release

See `docs/handoff/keystore_handoff.md` for the secure transfer process.

The single most important file in the entire engagement is the keystore. Losing it is irrecoverable. Treat it accordingly.

---

## Common build failures

| Error                                                  | Fix                                                  |
| ------------------------------------------------------ | ---------------------------------------------------- |
| `Keystore file '...' not found`                        | Path in `gradle.properties` is wrong. Use absolute. |
| `Cannot recover key`                                   | Wrong key password. Try keystore password if same.  |
| `Failed to read key cbee from store '...': Keystore was tampered with, or password was incorrect` | Wrong keystore password. |
| `Lint found errors in the project; aborting build`     | Add `lintOptions { abortOnError false }` (or fix lints — preferred) |
| `R8: Missing class kotlin.Metadata`                    | Some Cap 8 plugin needs `proguard-rules.pro` updates. Disable minification (`minifyEnabled false`) to ship if you must, but real fix is to add the missing rule. |
| `Execution failed for task ':app:bundleReleaseResources'` | Usually a missing image/string resource. Check the trace. |

---

## ProGuard / R8 minification

The default `proguard-android-optimize.txt` covers most cases. Capacitor plugins typically ship their own consumer ProGuard rules.

If you get a runtime crash on the release build that doesn't happen in debug (`ClassNotFoundException`, `NoSuchMethodError`), it's usually R8 stripping something it shouldn't. Workarounds:

1. Quick fix: `minifyEnabled false` in `buildTypes.release`. Ships bigger APK but works.
2. Right fix: add `-keep class com.example.theclass.** { *; }` to `android/app/proguard-rules.pro` for the missing class.

For Phase 2, ship with minification ON unless something breaks; the smaller AAB is worth it.

---

## Future: Play App Signing

When you upload to Play Store for the first time, Google may offer (or require for new apps) **Play App Signing**. In that flow, you upload your AAB, Google extracts your signing key, and they re-sign each release with their own production key. You're left with the "upload key" — what you use to verify uploads.

If you accept Play App Signing:
- You can't lose the production signing key (Google holds it)
- You CAN rotate your upload key if compromised
- Recommended for personal-account-shipped apps

The Welcome Pack walks Swaroop through this on first upload.

---

**Next:** `docs/testing/acceptance_criteria.md` for definition-of-done, or `docs/handoff/keystore_handoff.md` for the secure transfer flow.
