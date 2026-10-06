---
name: android-build-pitfalls
description: Read before building Android APKs or AVDs in this dev image: global gradle 8.9, no wrapper, skin-key trap, 2g heap.
---
# Android Build Pitfalls (dev image)

This dev image ships the Android SDK preinstalled and a GLOBAL Gradle at `/opt/gradle-8.9`, on PATH as `gradle`.
Fresh projects have NO gradle wrapper, and the image has specific traps (AVD skin keys, AAPT2 memory, apt's ancient
gradle) that burn hours if learned by trial. Everything below is ground truth for THIS image.

## Hard rules

1. **Build with the global gradle.** `gradle assembleDebug` works out of the box. If you want a wrapper, generate it
   ONCE with the global binary — `gradle wrapper --gradle-version 8.9` — after which `./gradlew` exists and works.
   `gradle wrapper` itself needs a working gradle; the global one is it. Never run `./gradlew` in a repo that has no
   wrapper: it fails with `sh: ./gradlew: not found`.
2. **Never `apt-get install gradle`.** apt's gradle is ancient and cannot load the `com.android.application` plugin.
3. **The debug APK lands at** `app/build/outputs/apk/debug/app-debug.apk`. `assembleRelease` fails without a signing
   config — for internal testing always ship the debug APK.
4. **JDK is preinstalled.** On any JAVA_HOME complaint: `update-alternatives --list java`, then export JAVA_HOME to
   the JDK root (two directories up from the `java` binary). Do NOT install another JDK.
5. **First build downloads dependencies: allow 5–10 minutes.** Do not kill it as "hung".
6. **Heap: exactly `org.gradle.jvmargs=-Xmx2g`** in `gradle.properties`. Higher values get the AAPT2 daemon
   OOM-killed in the sandbox (`AAPT2 process unexpectedly exit`). 2g is the tested ceiling here, not a suggestion.
7. **Always pass `--no-daemon`** for CI-style runs — otherwise orphan gradle daemons accumulate in the sandbox.
8. **AVD `config.ini`: DELETE skin keys, never blank them.** `skin.name=` (empty value) kills the emulator with
   `unknown skin name ''`. Never pass `-d <device>` to avdmanager — a device profile drags in a skin that overrides
   `hw.lcd.*`. Set `hw.lcd.width` / `hw.lcd.height` / `hw.lcd.density` directly instead.
9. **On any failure, read the FIRST error line before changing anything.** Gradle prints the real cause exactly once,
   followed by pages of cascading noise. Never rerun a failed build unmodified.

## Build a debug APK (works as-is)

```sh
#!/bin/sh
# build-debug.sh — debug APK with the GLOBAL gradle (no wrapper). POSIX sh, dash-safe.
set -eu

PROJECT_DIR="${1:-/workspace/app-project}"
cd "$PROJECT_DIR"

# Set by the image; fail loudly if the env got wiped. Never guess a path.
: "${ANDROID_SDK_ROOT:?ANDROID_SDK_ROOT unset - check the login shell env}"

# 1) Preempt "SDK location not found": local.properties is per-project.
printf 'sdk.dir=%s\n' "$ANDROID_SDK_ROOT" > local.properties

# 2) Accept SDK licenses (idempotent, ~5 s).
yes | sdkmanager --licenses > /dev/null 2>&1 || true

# 3) Heap cap: exactly 2g. Higher OOM-kills the AAPT2 daemon in this sandbox.
grep -q '^org.gradle.jvmargs=' gradle.properties 2>/dev/null || \
  printf 'org.gradle.jvmargs=-Xmx2g\n' >> gradle.properties

# 4) JAVA_HOME repair (only if unset/broken) — never install another JDK.
if [ -z "${JAVA_HOME:-}" ] || [ ! -x "${JAVA_HOME:-/nonexistent}/bin/java" ]; then
  JAVA_BIN="$(update-alternatives --list java | head -n 1)"  # .../<jdk>/bin/java
  JAVA_HOME="$(dirname "$(dirname "$JAVA_BIN")")"
  export JAVA_HOME
fi

# 5) Build. First run downloads dependencies: allow 5-10 min. Do not kill it.
gradle assembleDebug --no-daemon --stacktrace

# 6) Verify and report the size — a missing file here means the build lied.
APK="app/build/outputs/apk/debug/app-debug.apk"
ls -la "$APK"
printf 'APK boyutu: %s bayt\n' "$(wc -c < "$APK")"
```

## Known-good version trio: Gradle 8.9 + AGP 8.5.2 + Kotlin 2.0.21

Use this exact set for new projects; version drift is the top cause of `Unsupported class file major version`
and "requires Gradle X" failures.

```kotlin
// ---- settings.gradle.kts ----
pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositories { google(); mavenCentral() }
}
rootProject.name = "MyApp"
include(":app")

// ---- build.gradle.kts (project root) ----
plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
}

// ---- app/build.gradle.kts ----
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.example.app"
    compileSdk = 34                 // "requires compileSdk 34" errors: fix HERE
    defaultConfig {
        applicationId = "com.example.app"
        minSdk = 24                 // "minSdkVersion cannot be smaller than X" errors: fix HERE
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
```

## Create and boot an AVD (KVM on the node)

```sh
#!/bin/sh
# make-avd.sh — create + boot a headless KVM AVD without the skin trap. POSIX sh.
set -eu

AVD_NAME="${1:-test-api34}"
SYS_IMG="system-images;android-34;google_apis;x86_64"
: "${ANDROID_SDK_ROOT:?ANDROID_SDK_ROOT unset}"

yes | sdkmanager --licenses > /dev/null 2>&1 || true
sdkmanager "$SYS_IMG" > /dev/null           # ~1-2 min download on first use

# NO -d/--device flag: a device profile drags in a skin that silently
# overrides hw.lcd.* — your resolution settings then have no effect.
echo no | avdmanager create avd -n "$AVD_NAME" -k "$SYS_IMG" --force

CFG="$HOME/.android/avd/${AVD_NAME}.avd/config.ini"

# DELETE skin keys. Blanking them ('skin.name=') kills the emulator with:
#   emulator: ERROR: unknown skin name ''
sed -i '/^skin\./d; /^hw\.lcd\./d' "$CFG"
{
  printf 'hw.lcd.width=1080\n'
  printf 'hw.lcd.height=1920\n'
  printf 'hw.lcd.density=420\n'
  printf 'hw.gpu.enabled=yes\n'
  printf 'hw.gpu.mode=swiftshader_indirect\n'
} >> "$CFG"

"$ANDROID_SDK_ROOT/emulator/emulator" -avd "$AVD_NAME" \
  -no-window -no-audio -no-boot-anim > /tmp/emulator.log 2>&1 &

# Wait for full boot: poll sys.boot_completed, 5 s x 60 = 300 s ceiling.
adb start-server > /dev/null 2>&1
i=0
while [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
  i=$((i + 1))
  [ "$i" -gt 60 ] && { echo "boot timeout (300 s) - bkz. /tmp/emulator.log"; exit 1; }
  sleep 5
done
echo "AVD hazir: $AVD_NAME"
```

## Common failures → exact fixes

| FIRST error line contains | Cause | Fix |
|---|---|---|
| `SDK location not found` | no `local.properties` | write `sdk.dir=$ANDROID_SDK_ROOT` into `local.properties` (build script step 1) |
| `licences have not been accepted` | unaccepted SDK licenses | pipe `yes` into `sdkmanager --licenses` |
| `AAPT2 process unexpectedly exit` / `Daemon startup failed` | heap too big → AAPT2 OOM-killed | set `org.gradle.jvmargs=-Xmx2g`, no higher |
| `uses-sdk:minSdkVersion 21 cannot be smaller than version 24 declared in library` | a dependency needs newer minSdk | raise `minSdk` in `app/build.gradle.kts` → `defaultConfig` |
| `requires ... compileSdk ... 34` / `compileSdkVersion is not specified` | old or missing compileSdk | set `compileSdk = 34` in the `android {}` block |
| `Unsupported class file major version` / AGP-Gradle version complaints | version drift | pin Gradle 8.9 + AGP 8.5.2 + Kotlin 2.0.21 (trio above) |
| `unknown skin name ''` | blanked `skin.*` keys in AVD `config.ini` | delete the `skin.*` lines entirely (AVD script) |
| `JAVA_HOME is set to an invalid directory` | stale env | `update-alternatives --list java` → export JAVA_HOME (build script step 4) |

## Verification

After a successful build, always run `ls -la app/build/outputs/apk/debug/app-debug.apk` and report the byte size
(a minimal debug APK is roughly 5–8 MB; a missing file means the build did not produce what you think it did).
Install-testing on real targets goes through the platform's android device tool (`android_device` / `android_test`) —
never adb-over-network improvisations. adb is acceptable only against a local AVD you booted yourself.

## Self-check

- [ ] Built with `gradle` (global 8.9) or a wrapper I generated via `gradle wrapper --gradle-version 8.9` — never a phantom `./gradlew`.
- [ ] `local.properties` contains `sdk.dir` before the first build.
- [ ] `gradle.properties` contains `org.gradle.jvmargs=-Xmx2g` — exactly 2g.
- [ ] Ran with `--no-daemon`.
- [ ] Gave the first build 5–10 min before judging it stuck.
- [ ] Built `assembleDebug`, not Release, for internal testing.
- [ ] Verified the APK with `ls -la` and reported its byte size.
- [ ] AVD `config.ini` has zero `skin.*` lines and explicit `hw.lcd.width/height/density`; no `-d` device profile used.
- [ ] On failure I quoted the FIRST error line before changing anything, and changed something before any rerun.
- [ ] Install-test done through the platform android device tool, not adb hacks.

## Anti-patterns (seen in real runs)

- `./gradlew assembleDebug` in a fresh project → `sh: ./gradlew: not found`, then "fixing" it with apt gradle. Two
  mistakes stacked; the fix was `gradle assembleDebug` all along.
- `apt-get install gradle` → Gradle 4.x, instantly dies loading the `com.android.application` plugin.
- `sed -i 's/^skin.name=.*/skin.name=/' config.ini` → `unknown skin name ''`. Skin keys must be DELETED, not blanked.
- `avdmanager create avd -d pixel_6 ...` → the device profile's skin overrides `hw.lcd.*`; resolution edits do nothing.
- Bumping `-Xmx` to 4g/6g "to speed things up" → AAPT2 daemon OOM-killed; build gets slower and flakier, not faster.
- Rerunning a failed build 5 times unchanged hoping for a flake — gradle failures are deterministic; the answer was
  in the first error line of run 1.
- `apt-get install openjdk-17-jdk` on a JAVA_HOME complaint → two JDKs, new conflicts. `update-alternatives` was enough.
- Spending 30 min on keystore/signing for `assembleRelease` when the deliverable was an internal test build —
  the debug APK was the correct artifact.
