# Dev Environment

**One-time setup. Do this Day 0 before kickoff so Day 1 isn't installing toolchains.**

---

## TL;DR

You need: **Node 22+**, **npm** (or **bun**), **JDK 17**, **Android Studio (Koala or later)**, **Xcode 16+ on a Mac**, **Supabase CLI**, and a code editor of your choice.

---

## 1. Node 22+

Cap 8 requires Node 22 or higher.

```bash
# Install via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
# Restart shell, then:
nvm install 22
nvm use 22
nvm alias default 22

# Verify
node -v    # → v22.x.x
npm -v     # → 10.x.x
```

If you previously had Node 18/20 and `node_modules` from then, blow it away:
```bash
cd <repo>
rm -rf node_modules package-lock.json bun.lockb
npm install
```

---

## 2. Package manager — pick one and commit

The repo currently has BOTH `bun.lockb` and `package-lock.json` (a Lovable artifact). Pick npm for the sprint:

```bash
# In repo root, Day 1:
rm bun.lockb
npm install
git add package-lock.json
git rm bun.lockb
git commit -m "chore: standardize on npm; remove bun.lockb"
```

Rationale: Capacitor's docs and most plugin install guides assume npm. Bun works but adds friction when an error message says "run `npm install foo`".

---

## 3. JDK 17

Android Gradle 8+ needs JDK 17 (not 11, not 8).

**macOS:**
```bash
brew install --cask zulu17
# Or: brew install openjdk@17

# Set JAVA_HOME (add to ~/.zshrc or ~/.bashrc):
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

**Linux:**
```bash
sudo apt install openjdk-17-jdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
```

**Windows:**
Download from https://www.azul.com/downloads/?package=jdk. During install, check "Set JAVA_HOME variable".

Verify:
```bash
java -version    # openjdk version "17.x"
```

---

## 4. Android Studio

Download from https://developer.android.com/studio. Use the latest stable (Koala or newer as of May 2026).

After install, open Android Studio and use the SDK Manager to install:

- **Android SDK Platform** for API 35 (Android 15) and API 34 (Android 14)
- **Android SDK Build-Tools** 35.0.0
- **Android Emulator**
- **Android SDK Platform-Tools**
- **Google Play services**

Then, create at least one Android Virtual Device (AVD):
- Pixel 7 / API 34 (Android 14) — primary test device
- (Optional) Pixel 4a / API 30 (Android 11) — low-end fallback

Set environment variables (`~/.zshrc` or `~/.bashrc`):
```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"   # macOS
export PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
```

Verify:
```bash
adb --version
emulator -list-avds
```

---

## 5. Xcode 16+ (Mac only)

Required for the iOS build. Cap 8 needs Xcode 16+ on the latest macOS.

```bash
# Install Xcode from the Mac App Store (it's ~30GB and slow — start Day 0)
# After install:
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcode-select --install   # Command Line Tools
```

Then install CocoaPods (Ruby gem):
```bash
sudo gem install cocoapods
pod --version    # 1.15+
```

Configure your Apple ID in Xcode → Settings → Accounts so you can sign builds.

---

## 6. Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Linux / Windows: see https://supabase.com/docs/guides/cli/getting-started

# Verify
supabase --version
```

Link to the cbee project (Swaroop's account):
```bash
supabase login
supabase link --project-ref <PROJECT_REF>
```

The project ref is in the Supabase dashboard URL (it's the subdomain of the project URL). The `.env` file already has `VITE_SUPABASE_PROJECT_ID="vnooaiqjkxnkgteejjmp"` — use that as the project-ref.

---

## 7. Git config

Make sure your commit identity is Spurt-attributed (not personal):

```bash
git config user.name "Bhaskar Datta P (Spurt Studios)"
git config user.email "<your spurt email>"
```

---

## 8. Editor setup

Use any editor you prefer. Recommended extensions / plugins:

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- GitLens
- Capacitor (Ionic's official marketplace extension)
- Supabase

---

## 9. First build verification

After all the above, in the repo root:

```bash
# Install deps
npm install

# Build the web bundle
npm run build

# Sync to Android
npx cap sync android

# Open in Android Studio (verifies the project is valid)
npx cap open android
```

Expect: Android Studio opens with the `android/` project, Gradle sync completes, you can hit Run and the app launches on the AVD.

If anything fails: check error messages against `docs/04_GOTCHAS.md`.

---

## 10. Convenient scripts

Add these to `package.json` if not already there (most are already):

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",

    "cap:sync": "npm run build && npx cap sync",
    "cap:android": "npm run cap:sync && npx cap open android",
    "cap:ios": "npm run cap:sync && npx cap open ios",
    "cap:run:android": "npm run cap:sync && npx cap run android",
    "cap:run:ios": "npm run cap:sync && npx cap run ios",

    "db:reset": "supabase db reset",
    "db:push": "supabase db push --linked",
    "db:types": "supabase gen types typescript --linked > src/integrations/supabase/types.ts"
  }
}
```

`npm run db:types` after every migration is good hygiene — it regenerates the typed Supabase client so TanStack queries don't drift.

---

## 11. Recommended VS Code / Windsurf settings

Drop this into `.vscode/settings.json` if it doesn't exist (gitignored or committed, either is fine):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

---

## 12. Troubleshooting

| Symptom                                           | Fix                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `npx cap sync` says "no platforms"                | Run `npx cap add android` (or `ios`)                              |
| Gradle fails with "Unsupported class file version" | Wrong JDK. Verify `java -version` shows 17.                       |
| Xcode "Signing for App requires a development team" | Open Xcode → Signing & Capabilities → pick your team               |
| Android emulator hangs                            | Cold-boot: AVD Manager → menu → Cold Boot Now                     |
| `supabase` command not found                      | Re-source shell or use full path: `/opt/homebrew/bin/supabase`     |
| `pod install` fails "ffi cannot load"             | `sudo arch -x86_64 gem install ffi` (Apple Silicon Macs)           |
| Vite dev server doesn't hot-reload after save     | See `docs/04_GOTCHAS.md` G-23; clear `node_modules/.vite`         |
| `npx cap sync` says Cap 7 plugins incompatible    | Bump @capacitor/* to ^8 — see `docs/05_CAPACITOR_8_NOTES.md`       |

---

## 13. Once everything works

Run this smoke test:

```bash
npm run dev
# Browser opens to http://localhost:5173. App loads. Login screen.
```

Then:
```bash
npm run cap:run:android
# AVD launches, app installs, login screen.
```

If both work, you're set up. Commit your dotfiles (excluding secrets), notify Bhaskar in Slack/WhatsApp, and proceed to Day 1 of the sprint.

---

**Next:** `docs/build/ios_setup.md` for the iOS-specific bootstrap, or `docs/build/android_signing.md` for the keystore generation.
