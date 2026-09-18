# Tinroof Android

This is a small native Android shell around the deployed Tinroof player. It
keeps the APK small by streaming the existing recordings and live player over
HTTPS instead of duplicating the 454 MB web audio library in the application.

## Build

Use Java 17 and the Android SDK with platform 35 and build-tools 35.0.0:

```sh
./gradlew assembleDebug
```

The APK is written to `app/build/outputs/apk/debug/app-debug.apk`. Install it
with `adb install -r app/build/outputs/apk/debug/app-debug.apk`.

The app preserves the tested web player modes and controls. Android or device
power policies may suspend live Web Audio in the background; the recorded
modes are the reliable choice for a locked screen.
