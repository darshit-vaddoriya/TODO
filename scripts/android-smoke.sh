#!/usr/bin/env bash
# Runs inside an Android emulator (see .github/workflows/ci.yml, job android-smoke).
#   1. Fresh install WITHOUT notification permission, cold start: no crash, and the app must ask
#      for the permission (a real phone does; granting it up front hid this path before).
#   2. Settings > Reminder settings, clicking the real buttons through the WebView (scripts/cdp.mjs):
#      "Show now" must post a notification; "Ring in 1 min" must arm an alarm.
#   3. The app is killed like a swipe-away (not a force-stop, which cancels alarms) and Android
#      must still ring that alert a minute later.
#   4. Wellness presets > add Drink water (the earlier crash).
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


js() { node scripts/cdp.mjs "$1" 2>&1; }  # evaluate JS in the app's WebView
click_text() { # click the first button/link whose text contains $1 (case-insensitive)
  js "(() => { const w = ${1@Q}.toLowerCase(); const el = [...document.querySelectorAll('button,a')].find(b => b.textContent.trim().toLowerCase().includes(w)); if (!el) return 'NOT FOUND'; el.click(); return 'clicked'; })()"
}
forward() { # point DevTools at the app's current process
  local pid
  pid=$(adb shell pidof "$PKG" | tr -d '\r' | awk '{print $1}')
  adb forward --remove-all > /dev/null 2>&1 || true
  adb forward tcp:9222 "localabstract:webview_devtools_remote_$pid" > /dev/null
}

adb uninstall "$PKG" > /dev/null 2>&1 || true
adb install -r "$APK" > "$OUT/install.txt" 2>&1 || { cat "$OUT/install.txt"; echo "INSTALL FAILED"; exit 1; }
echo "-- notification permission right after install:"
adb shell dumpsys package "$PKG" | grep -n "POST_NOTIFICATIONS" | head -3
adb logcat -c

echo "== 1. fresh install, cold start, no permission yet"
adb shell am start -n "$PKG/.MainActivity" > /dev/null
sleep 20
alive && echo "app is running" || { echo "APP IS NOT RUNNING after launch"; FAIL=1; }
adb exec-out screencap -p > "$OUT/launch.png" 2>/dev/null || true
adb logcat -d > "$OUT/logcat-launch.txt"
crashes "$OUT/logcat-launch.txt" launch
echo "-- does the permission dialog appear?"
if tap_text "Allow"; then echo "PASS: the app asked for the notification permission and it was allowed"; else echo "FAIL: no permission dialog appeared (a real phone would show none either)"; FAIL=1; fi
sleep 3
echo "-- permission state now:"
adb shell dumpsys package "$PKG" | grep -n "POST_NOTIFICATIONS" | head -3
if ! adb shell dumpsys package "$PKG" | grep "POST_NOTIFICATIONS" | grep -q "granted=true"; then
  echo "(granting it by hand so the rest of the test can run)"; adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS || true
fi

echo "== 2. Settings > Reminder settings"
adb shell am start -a android.intent.action.VIEW -d "yaad://settings/reminders" "$PKG" > /dev/null
sleep 6
forward
echo "-- DevTools reachable: $(js 'document.title')"
echo "-- the check card as the user sees it:"
js "(() => { const t = document.body.innerText; const i = t.indexOf('Ringing while'); return i < 0 ? 'CARD NOT FOUND. Page text: ' + t.slice(0, 600) : t.slice(i, i + 700); })()" | tee "$OUT/card-before.txt"
adb exec-out screencap -p > "$OUT/settings.png" 2>/dev/null || true

adb logcat -c
echo "click Show now: $(click_text 'Show now')"
sleep 4
adb shell dumpsys notification --noredact > "$OUT/dumpsys-notification-now.txt"
if grep -q "Yaad test" "$OUT/dumpsys-notification-now.txt"; then echo "PASS: Show now posted a notification"; else echo "FAIL: Show now posted nothing"; FAIL=1; fi
echo "-- the card after Show now (look for 'Last problem'):"
js "(() => { const t = document.body.innerText; const i = t.indexOf('Ringing while'); return i < 0 ? 'CARD NOT FOUND' : t.slice(i, i + 700); })()" | tee "$OUT/card-after-show-now.txt"
echo "-- toasts / errors on screen:"; js "[...document.querySelectorAll('[role=status],[role=alert]')].map(e => e.textContent.trim()).join(' | ')"
adb logcat -d > "$OUT/logcat-settings.txt"
crashes "$OUT/logcat-settings.txt" "Show now"
echo "-- native/JS errors after Show now:"; grep -E "Capacitor|AndroidRuntime|YaadWidget|NotifyHelper" "$OUT/logcat-settings.txt" | grep -iE "error|exception|fail|denied" | head -15

echo "== 3. Ring in 1 min, then close the app like a swipe-away"
echo "click Ring in 1 min: $(click_text 'Ring in 1 min')"
sleep 4
adb shell cmd notification cancel_all > /dev/null 2>&1 || adb shell service call notification 1 > /dev/null 2>&1 || true
echo "-- alarm registered?"
adb shell dumpsys alarm | grep -B1 -A4 "$PKG" | head -16 | tee "$OUT/dumpsys-alarm-test.txt"
adb shell input keyevent KEYCODE_HOME
sleep 2
adb shell am kill "$PKG"
sleep 2
alive && echo "(process still alive after kill)" || echo "process is gone, app is closed"
echo "-- waiting for the test to ring"
sleep 70
adb shell dumpsys notification --noredact > "$OUT/dumpsys-notification.txt"
adb logcat -d > "$OUT/logcat-alarm.txt"
if grep -q "rang while Yaad was closed" "$OUT/dumpsys-notification.txt"; then echo "PASS: Ring in 1 min rang while the app was closed"; else echo "FAIL: Ring in 1 min did not ring"; FAIL=1; fi
crashes "$OUT/logcat-alarm.txt" "alarm path"

echo "== 4. Wellness presets > add Drink water"
adb logcat -c
adb shell am start -a android.intent.action.VIEW -d "yaad://presets" "$PKG" > /dev/null
sleep 6
forward
echo "click Add: $(click_text 'Add')"
sleep 6
alive && echo "app still running after adding the preset" || { echo "APP DIED after adding the preset"; FAIL=1; }
adb logcat -d > "$OUT/logcat-preset.txt"
crashes "$OUT/logcat-preset.txt" "adding the preset"
adb shell dumpsys alarm | grep -B1 -A4 "$PKG" | head -12 | tee "$OUT/dumpsys-alarm-preset.txt"
adb exec-out screencap -p > "$OUT/after-preset.png" 2>/dev/null || true

exit "$FAIL"
