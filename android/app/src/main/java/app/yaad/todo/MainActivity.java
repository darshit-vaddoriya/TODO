package app.yaad.todo;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins must be registered before the bridge is created.
        registerPlugin(YaadWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
