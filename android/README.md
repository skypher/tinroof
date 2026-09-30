# Tinroof Android

This is a native Android shell around a bundled copy of the Tinroof player. The
HTML, JavaScript, recordings, and live-mode samples are packaged in the APK, so
the player works without a network connection.

## Build

Use Java 17 and the Android SDK with platform 35 and build-tools 35.0.0:

```sh
./gradlew assembleDebug
```

The APK is written to `app/build/outputs/apk/debug/app-debug.apk`. Install it
with `adb install -r app/build/outputs/apk/debug/app-debug.apk`.

The app preserves the web player modes and controls. The complete sound library
adds roughly 460 MB to the APK. Android or device power policies may suspend
live Web Audio in the background; the recorded modes are the reliable choice
for a locked screen.

## Emulator tests

Start an API 35 emulator with hardware acceleration, then run from the project
root:

```sh
npm run test:android
```

The instrumentation suite verifies the offline WebView configuration and
bundled sample manifest, recorded playback and pause, four-hour playlist
transition, eight-hour wrap, and Endless mode sample loading, generated audio,
mute/restore, pause, and resume. Gradle writes the XML and HTML test reports to
`android/app/build/reports/androidTests/connected/`.
