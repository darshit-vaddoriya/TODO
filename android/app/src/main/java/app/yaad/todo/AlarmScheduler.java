package app.yaad.todo;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

/**
 * Keeps one alarm set for the earliest stored alert. It uses the alarm-clock kind of alarm,
 * which Android does not delay in Doze or battery saver (ordinary "exact" alarms can be held
 * back for minutes while the phone is idle) and which needs no special permission. The cost:
 * the next reminder appears as the phone's "next alarm" in the status bar.
 */
final class AlarmScheduler {
    private AlarmScheduler() {}

    private static PendingIntent fire(Context context) {
        Intent intent = new Intent(context, AlarmReceiver.class).setAction("app.yaad.todo.ALARM");
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * (Re)arm the alarm for the earliest stored alert, or cancel it when there are none.
     * Never throws: Android can refuse exact alarms (SecurityException), and a crash here took the
     * whole app down. Then an inexact alarm is used instead, which may arrive a little late.
     *
     * @return true when an exact alarm was set (or nothing needed setting)
     */
    static boolean arm(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return false;
        PendingIntent fire = fire(context);
        long next = AlarmStore.nextAt(context);
        if (next < 0) {
            alarms.cancel(fire);
            return true;
        }
        long at = Math.max(next, System.currentTimeMillis() + 1000);
        Intent open = new Intent(context, MainActivity.class);
        PendingIntent show = PendingIntent.getActivity(context, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            alarms.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), fire);
            return true;
        } catch (SecurityException e) {
            try {
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
            } catch (RuntimeException ignored) {
                // Nothing more can be done; the app lists the alert as missed when opened.
            }
            return false;
        }
    }
}
