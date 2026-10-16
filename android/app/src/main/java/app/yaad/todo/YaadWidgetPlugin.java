package app.yaad.todo;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;
import org.json.JSONException;
import org.json.JSONObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Receives the Today summary from the web app and redraws the home-screen widget.
 * The summary is stored as the JSON the app sent (see src/domain/widget.ts).
 */
@CapacitorPlugin(name = "YaadWidget")
public class YaadWidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        JSObject data = call.getData();
        Context context = getContext();
        YaadWidgetProvider.save(context, data.toString());
        YaadWidgetProvider.refreshAll(context);
        call.resolve();
    }

    /** Open this app's notification settings (to re-allow notifications once they were blocked). */
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        launch(intent, call);
    }

    /** Open the system list where battery optimisation can be turned off for this app. */
    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        launch(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS), call);
    }

    /** Is Android free to run this app's alarms in the background (battery use "Unrestricted")? */
    @PluginMethod
    public void batteryStatus(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject result = new JSObject();
        result.put("unrestricted", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(result);
    }

    private void launch(Intent intent, PluginCall call) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open settings");
        }
    }

    /** Replace the planned alerts and arm the alarm for the earliest one. */
    @PluginMethod
    public void schedulePlan(PluginCall call) {
        JSArray items = call.getArray("items");
        Context context = getContext();
        AlarmStore.replace(context, items == null ? new JSArray() : items);
        AlarmScheduler.arm(context);
        call.resolve(alarmState(context));
    }

    /** Show a notification right now. */
    @PluginMethod
    public void showNow(PluginCall call) {
        NotifyHelper.post(getContext(), call.getData());
        call.resolve();
    }

    /** A test alert: now (seconds = 0) or after `seconds`, ringing even if the app is closed. */
    @PluginMethod
    public void scheduleTest(PluginCall call) {
        int seconds = call.getInt("seconds", 60);
        Context context = getContext();
        try {
            JSONObject item = new JSONObject();
            item.put("id", AlarmStore.TEST_ID);
            item.put("title", "\uD83D\uDD14 Yaad test");
            item.put("taskId", JSONObject.NULL);
            item.put("actions", false);
            if (seconds <= 0) {
                item.put("body", "Notifications work.");
                NotifyHelper.post(context, item);
            } else {
                item.put("body", "This rang while Yaad was closed. Reminders will reach you.");
                item.put("at", System.currentTimeMillis() + seconds * 1000L);
                AlarmStore.add(context, item);
                AlarmScheduler.arm(context);
            }
            call.resolve(alarmState(context));
        } catch (JSONException e) {
            call.reject("Could not set the test");
        }
    }

    /** How many alerts are stored and when the first rings. */
    @PluginMethod
    public void alarmStatus(PluginCall call) {
        call.resolve(alarmState(getContext()));
    }

    private JSObject alarmState(Context context) {
        JSObject state = new JSObject();
        state.put("count", AlarmStore.count(context));
        state.put("nextAt", AlarmStore.nextAt(context));
        return state;
    }
}
