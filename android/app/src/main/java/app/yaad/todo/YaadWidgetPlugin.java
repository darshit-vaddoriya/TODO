package app.yaad.todo;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;
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
}
