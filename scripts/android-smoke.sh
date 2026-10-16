#!/usr/bin/env bash
# Runs inside an Android emulator (see .github/workflows/ci.yml, job android-smoke).
#   1. Cold start: the app must stay alive with no crash.
#   2. Settings > Reminder settings: tap "Show now" and "Ring in 1 min" the way a user does;
#      no crash, and "Show now" must really post a notification.
#   3. Closed-app alarm: a stored alert is picked up by the app at start, the app is then killed
#      like a swipe-away (not a force-stop, which cancels alarms), and Android must still ring it.
# Everything useful is also printed to the job log.
set -u
PKG=app.yaad.todo
APK="${1:-apk/app-debug.apk}"
OUT="${2:-smoke}"
mkdir -p "$OUT"
FAIL=0
TEST_ID=7000001   # AlarmStore.TEST_ID: a stored alert with this id survives the app's own re-plan

crashes() { # $1 = logcat file, $2 = label
  if grep -q "FATAL EXCEPTION" "$1"; then echo "CRASH ($2):"; grep -n "FATAL EXCEPTION" -A 30 "$1" | head -90; FAIL=1; fi
}
alive() { [ -n "$(adb shell pidof "$PKG" | tr -d '\r')" ]; }

tap_text() { # tap the first on-screen element whose text/description contains $1
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
  adb pull /sdcard/ui.xml "$OUT/ui.xml" > /dev/null 2>&1
  local xy
  xy=$(python3 - "$1" "$OUT/ui.xml" <<'PY'
import re, sys
want, path = sys.argv[1].lower(), sys.argv[2]
try:
    xml = open(path, encoding='utf-8').read()
except OSError:
    sys.exit()
hits = []
for m in re.finditer(r'<node[^>]*?(?:text|content-desc)="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
    text = m.group(1).strip().lower()
    if want == text or want in text:
        x1, y1, x2, y2 = map(int, m.groups()[1:])
        if x2 <= x1 or y2 <= y1:
            continue  # hidden or zero-size node
        hits.append((0 if want == text else 1, (x1 + x2) // 2, (y1 + y2) // 2))
if hits:
    hits.sort(key=lambda h: h[0])  # an exact match beats a partial one; screen order breaks ties
    print(hits[0][1], hits[0][2])
PY
)
  if [ -n "$xy" ]; then echo "tap '$1' at $xy"; adb shell input tap $xy; return 0; fi
  echo "could not find '$1' on screen. Texts on screen:"; grep -o 'text="[^"]\+"' "$OUT/ui.xml" | head -30; return 1
}

adb install -r "$APK" > "$OUT/install.txt" 2>&1 || { cat "$OUT/install.txt"; echo "INSTALL FAILED"; exit 1; }
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS 2>/dev/null || true
adb logcat -c

echo "== 1. cold start"
adb shell am start -n "$PKG/.MainActivity" > /dev/null
sleep 25
alive && echo "app is running" || { echo "APP IS NOT RUNNING after launch"; FAIL=1; }
adb logcat -d > "$OUT/logcat-launch.txt"
crashes "$OUT/logcat-launch.txt" launch
echo "-- JS console errors at launch:"; grep -E "Capacitor/Console|chromium.*(ERROR|Uncaught)" "$OUT/logcat-launch.txt" | grep -iE "error|uncaught|exception" | head -20
adb exec-out screencap -p > "$OUT/launch.png" 2>/dev/null || true

echo "== 2. Settings buttons"
adb logcat -c
adb shell am start -a android.intent.action.VIEW -d "yaad://settings/reminders" "$PKG" > /dev/null
sleep 6
adb exec-out screencap -p > "$OUT/settings.png" 2>/dev/null || true
if tap_text "Show now"; then
  sleep 4
  alive && echo "app still running after Show now" || { echo "APP DIED after Show now"; FAIL=1; }
  adb shell dumpsys notification --noredact > "$OUT/dumpsys-notification-now.txt"
  if grep -q "Yaad test" "$OUT/dumpsys-notification-now.txt"; then echo "PASS: Show now posted a notification"; else echo "FAIL: Show now posted nothing"; FAIL=1; fi
else FAIL=1; fi
adb logcat -d > "$OUT/logcat-settings.txt"
crashes "$OUT/logcat-settings.txt" "settings screen"
adb exec-out screencap -p > "$OUT/after-show-now.png" 2>/dev/null || true

echo "== 2b. Wellness presets > add Drink water (the reported crash)"
adb logcat -c
adb shell am start -a android.intent.action.VIEW -d "yaad://presets" "$PKG" > /dev/null
sleep 5
adb exec-out screencap -p > "$OUT/presets.png" 2>/dev/null || true
if tap_text "Add"; then
  sleep 6
  alive && echo "app still running after adding the preset" || { echo "APP DIED after adding the preset"; FAIL=1; }
  adb exec-out screencap -p > "$OUT/after-preset.png" 2>/dev/null || true
  echo "-- alarm registered for the new reminder?"
  adb shell dumpsys alarm | grep -B1 -A6 "$PKG" | head -24 | tee "$OUT/dumpsys-alarm-preset.txt"
else FAIL=1; fi
adb logcat -d > "$OUT/logcat-preset.txt"
crashes "$OUT/logcat-preset.txt" "adding the preset"
echo "-- native/JS errors after adding:"; grep -E "Capacitor|AndroidRuntime|YaadWidget|AlarmStore" "$OUT/logcat-preset.txt" | grep -iE "error|exception|fail|denied" | head -20

echo "== 3. closed-app alarm"
adb shell am force-stop "$PKG"
DEV=$(adb shell date +%s | tr -d '\r')
AT=$(( (DEV + 60) * 1000 ))
cat > "$OUT/yaad_alarms.xml" <<XML
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="items">[{"id":$TEST_ID,"at":$AT,"title":"Smoke test reminder","body":"rang while closed","taskId":null,"actions":false,"snoozeLabel":"Snooze"}]</string>
</map>
XML
adb push "$OUT/yaad_alarms.xml" /data/local/tmp/yaad_alarms.xml > /dev/null
adb shell "run-as $PKG sh -c 'mkdir -p shared_prefs && cp /data/local/tmp/yaad_alarms.xml shared_prefs/yaad_alarms.xml && ls -la shared_prefs'" || { echo "run-as failed"; FAIL=1; }
adb shell dumpsys notification --noredact > /dev/null  # (keeps the service warm)
adb logcat -c
adb shell am start -n "$PKG/.MainActivity" > /dev/null   # the app re-plans at start and keeps the stored test alert
sleep 15
echo "-- alarm registered after app start?"
adb shell dumpsys alarm | grep -B2 -A8 "$PKG" | head -40 | tee "$OUT/dumpsys-alarm.txt"
adb shell input keyevent KEYCODE_HOME
sleep 2
adb shell am kill "$PKG"   # like swiping the app away: kills the process, keeps its alarms
sleep 2
alive && echo "(process still alive after kill)" || echo "process is gone, app is closed"
echo "-- waiting for the alert to ring"
sleep 60
adb shell dumpsys notification --noredact > "$OUT/dumpsys-notification.txt"
adb logcat -d > "$OUT/logcat-alarm.txt"
if grep -q "Smoke test reminder" "$OUT/dumpsys-notification.txt"; then
  echo "PASS: the alert rang while the app was closed"
else
  echo "FAIL: the alert did not ring. Native log lines:"
  grep -iE "yaad|AlarmReceiver|AlarmManager.*todo" "$OUT/logcat-alarm.txt" | tail -30
  FAIL=1
fi
crashes "$OUT/logcat-alarm.txt" "alarm path"
exit "$FAIL"
