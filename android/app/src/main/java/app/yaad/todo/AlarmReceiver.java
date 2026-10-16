package app.yaad.todo;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;

/** Rings whatever is due, then arms the alarm for the next stored alert. Works with the app closed. */
public class AlarmReceiver extends BroadcastReceiver {
    /** An alert later than this is not rung (the app shows it as missed when opened). */
    private static final long MAX_LATE_MS = 15 * 60_000L;

    @Override
    public void onReceive(Context context, Intent intent) {
        long now = System.currentTimeMillis();
        for (JSONObject item : AlarmStore.popDue(context, now + 1500, MAX_LATE_MS)) {
            NotifyHelper.post(context, item);
        }
        AlarmScheduler.arm(context);
    }
}
