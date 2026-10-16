package app.yaad.todo;

import android.content.Context;
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
}
