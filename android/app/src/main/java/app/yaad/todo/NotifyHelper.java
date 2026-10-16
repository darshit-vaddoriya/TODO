package app.yaad.todo;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONObject;

/** Builds and posts a reminder notification. Used by the alarm receiver and the app's "show now". */
final class NotifyHelper {
    static final String CHANNEL = "reminders";

    private NotifyHelper() {}

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Reminders", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Task and habit reminders");
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }

    private static String text(JSONObject item, String key) {
        return item.isNull(key) ? null : item.optString(key, null);
    }

    /** yaad://... opens the app on a screen (see src/services/widget.ts). */
    private static PendingIntent link(Context context, int id, String uri, int slot) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, id * 4 + slot, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void post(Context context, JSONObject item) {
        ensureChannel(context);
        int id = item.optInt("id");
        String title = text(item, "title");
        String body = text(item, "body");
        String taskId = text(item, "taskId");

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_yaad)
                .setContentTitle(title == null ? "Yaad" : title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setDefaults(NotificationCompat.DEFAULT_SOUND)
                .setAutoCancel(true)
                .setContentIntent(link(context, id, taskId == null ? "yaad://" : "yaad://task/" + taskId, 0));

        if (taskId != null && item.optBoolean("actions")) {
            String snooze = text(item, "snoozeLabel");
            builder.addAction(0, snooze == null ? "Snooze" : snooze, link(context, id, "yaad://act/snooze/" + taskId, 1));
            builder.addAction(0, "Done", link(context, id, "yaad://act/done/" + taskId, 2));
        }
        try {
            NotificationManagerCompat.from(context).notify(id, builder.build());
        } catch (SecurityException e) {
            // Notifications are not allowed; nothing to show.
        }
    }
}
