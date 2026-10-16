#!/usr/bin/env bash
# Runs inside an Android emulator (see .github/workflows/ci.yml, job android-smoke).
# 1. Installs the debug APK and cold-starts it: it must stay alive with no crash.
# 2. Seeds one alert due in ~25 s, kills the app, re-arms from the stored plan the way a
#    reboot does, waits, and checks that Android really posted the notification while the
#    app was closed.
set -u
PKG=app.yaad.todo
APK="${1:-apk/app-debug.apk}"
OUT="${2:-smoke}"
mkdir -p "$OUT"
FAIL=0

adb install -r "$APK" > "$OUT/install.txt" 2>&1 || { cat "$OUT/install.txt"; echo "INSTALL FAILED"; exit 1; }
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS 2>/dev/null || true
adb logcat -c

echo "== 1. cold start"
adb shell am start -n "$PKG/.MainActivity" > /dev/null
sleep 25
if [ -z "$(adb shell pidof "$PKG" | tr -d '\r')" ]; then echo "APP IS NOT RUNNING after launch"; FAIL=1; else echo "app is running"; fi
adb logcat -d > "$OUT/logcat-launch.txt"
if grep -q "FATAL EXCEPTION" "$OUT/logcat-launch.txt"; then
  echo "CRASH ON LAUNCH:"; grep -n "FATAL EXCEPTION" -A 30 "$OUT/logcat-launch.txt" | head -80; FAIL=1
fi
adb exec-out screencap -p > "$OUT/launch.png" 2>/dev/null || true

echo "== 2. closed-app alarm"
DEV=$(adb shell date +%s | tr -d '\r')
AT=$(( (DEV + 25) * 1000 ))
cat > "$OUT/yaad_alarms.xml" <<XML
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="items">[{"id":7000002,"at":$AT,"title":"Smoke test reminder","body":"rang while closed","taskId":null,"actions":false,"snoozeLabel":"Snooze"}]</string>
</map>
XML
adb shell am force-stop "$PKG"
adb push "$OUT/yaad_alarms.xml" /data/local/tmp/yaad_alarms.xml > /dev/null
adb shell "run-as $PKG sh -c 'mkdir -p shared_prefs && cp /data/local/tmp/yaad_alarms.xml shared_prefs/yaad_alarms.xml'" || { echo "run-as failed"; FAIL=1; }
adb logcat -c
adb shell am broadcast -a android.intent.action.BOOT_COMPLETED -n "$PKG/.BootReceiver" > "$OUT/boot-broadcast.txt" 2>&1
sleep 3
echo "-- alarm registered?"
adb shell dumpsys alarm | grep -B2 -A6 "$PKG" | head -40 | tee "$OUT/dumpsys-alarm.txt"
echo "-- waiting for it to ring (app is closed)"
sleep 40
adb shell dumpsys notification --noredact > "$OUT/dumpsys-notification.txt"
adb logcat -d > "$OUT/logcat-alarm.txt"
if grep -q "Smoke test reminder" "$OUT/dumpsys-notification.txt"; then
  echo "PASS: the notification was posted while the app was closed"
else
  echo "FAIL: no notification appeared"; FAIL=1
fi
if grep -q "FATAL EXCEPTION" "$OUT/logcat-alarm.txt"; then echo "CRASH IN ALARM PATH:"; grep -n "FATAL EXCEPTION" -A 30 "$OUT/logcat-alarm.txt" | head -80; FAIL=1; fi
adb shell pidof "$PKG" > /dev/null && echo "(app process exists)" || echo "(app process not running, as expected for a closed app)"

exit "$FAIL"
