package app.yaad.todo;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.net.Uri;
import android.text.format.DateFormat;
import android.widget.RemoteViews;
import androidx.core.content.ContextCompat;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The "Today" home-screen widget: concentric rings for tasks done and habits
 * acknowledged, a headline, and the next few open tasks. It draws from the last
 * summary the app stored; if that summary is from an earlier day it asks you to
 * open the app instead of showing yesterday's numbers.
 */
public class YaadWidgetProvider extends AppWidgetProvider {
    private static final String PREFS = "yaad_widget";
    private static final String KEY = "summary";
    private static final int[] ROWS = {R.id.row1, R.id.row2, R.id.row3};

    static void save(Context context, String json) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply();
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, YaadWidgetProvider.class));
        for (int id : ids) manager.updateAppWidget(id, build(context));
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        RemoteViews views = build(context);
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    private static String today() {
        Calendar c = Calendar.getInstance();
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    private static JSONObject load(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY, null);
        if (json == null) return null;
        try {
            return new JSONObject(json);
        } catch (JSONException e) {
            return null;
        }
    }

    private static PendingIntent open(Context context, int code, String uri) {
        Intent intent = uri == null
                ? new Intent(context, MainActivity.class)
                : new Intent(Intent.ACTION_VIEW, Uri.parse(uri), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String clock(Context context, String hhmm) {
        String[] p = hhmm.split(":");
        int h = Integer.parseInt(p[0]);
        int m = Integer.parseInt(p[1]);
        if (DateFormat.is24HourFormat(context)) return String.format(Locale.US, "%02d:%02d", h, m);
        return String.format(Locale.US, "%d:%02d %s", h % 12 == 0 ? 12 : h % 12, m, h < 12 ? "AM" : "PM");
    }

    static RemoteViews build(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);
        views.setOnClickPendingIntent(R.id.widget_root, open(context, 1, null));
        views.setOnClickPendingIntent(R.id.widget_add, open(context, 2, "yaad://task/new"));

        JSONObject s = load(context);
        boolean fresh = false;
        int done = 0, total = 0, habitsDone = 0, habitsTarget = 0, overdue = 0;
        JSONArray next = null;
        try {
            if (s != null && today().equals(s.getString("date"))) {
                fresh = true;
                done = s.getInt("tasksDone");
                total = s.getInt("tasksTotal");
                habitsDone = s.getInt("habitsDone");
                habitsTarget = s.getInt("habitsTarget");
                overdue = s.getInt("overdue");
                next = s.getJSONArray("next");
            }
        } catch (JSONException e) {
            fresh = false;
        }

        views.setImageViewBitmap(R.id.rings, rings(context, done, total, habitsDone, habitsTarget));

        if (!fresh) {
            views.setTextViewText(R.id.headline, context.getString(R.string.widget_open_app));
            views.setTextViewText(R.id.subline, context.getString(R.string.widget_refresh_hint));
            for (int row : ROWS) views.setViewVisibility(row, android.view.View.GONE);
            return views;
        }

        int left = total - done;
        String headline = total == 0 ? context.getString(R.string.widget_nothing_planned)
                : left <= 0 ? context.getString(R.string.widget_all_done)
                : context.getResources().getQuantityString(R.plurals.widget_tasks_to_go, left, left);
        views.setTextViewText(R.id.headline, headline);

        StringBuilder sub = new StringBuilder();
        if (habitsTarget > 0) sub.append(context.getString(R.string.widget_habits, habitsDone, habitsTarget));
        if (overdue > 0) {
            if (sub.length() > 0) sub.append(" · ");
            sub.append(context.getString(R.string.widget_overdue, overdue));
        }
        views.setTextViewText(R.id.subline, sub.toString());
        views.setViewVisibility(R.id.subline, sub.length() == 0 ? android.view.View.GONE : android.view.View.VISIBLE);

        for (int i = 0; i < ROWS.length; i++) {
            if (next == null || i >= next.length()) {
                views.setViewVisibility(ROWS[i], android.view.View.GONE);
                continue;
            }
            try {
                JSONObject t = next.getJSONObject(i);
                String time = t.isNull("time") ? "" : clock(context, t.getString("time")) + "  ";
                views.setTextViewText(ROWS[i], time + t.getString("title"));
                views.setTextColor(ROWS[i], ContextCompat.getColor(context, t.getBoolean("overdue") ? R.color.yaad_red : R.color.yaad_ink));
                views.setViewVisibility(ROWS[i], android.view.View.VISIBLE);
            } catch (JSONException e) {
                views.setViewVisibility(ROWS[i], android.view.View.GONE);
            }
        }
        return views;
    }

    /** Concentric rings on a bitmap: tasks outside, habits inside, "done/total" in the middle. */
    private static Bitmap rings(Context context, int done, int total, int habitsDone, int habitsTarget) {
        final int size = 256;
        final float stroke = 24f;
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(stroke);
        paint.setStrokeCap(Paint.Cap.ROUND);

        drawRing(canvas, paint, stroke / 2f + 4, size, done, total, ContextCompat.getColor(context, R.color.yaad_teal), ContextCompat.getColor(context, R.color.yaad_track));
        if (habitsTarget > 0) {
            drawRing(canvas, paint, stroke * 1.5f + 12, size, habitsDone, habitsTarget, ContextCompat.getColor(context, R.color.yaad_info), ContextCompat.getColor(context, R.color.yaad_track));
        }

        Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
        text.setColor(ContextCompat.getColor(context, R.color.yaad_ink));
        text.setTextAlign(Paint.Align.CENTER);
        text.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        text.setTextSize(habitsTarget > 0 ? 44f : 56f);
        canvas.drawText(done + "/" + total, size / 2f, size / 2f + (habitsTarget > 0 ? 15f : 19f), text);
        return bitmap;
    }

    private static void drawRing(Canvas canvas, Paint paint, float inset, int size, int done, int total, int color, int track) {
        RectF box = new RectF(inset, inset, size - inset, size - inset);
        paint.setColor(track);
        canvas.drawArc(box, 0, 360, false, paint);
        if (total <= 0 || done <= 0) return;
        paint.setColor(color);
        float sweep = 360f * Math.min(1f, (float) done / total);
        canvas.drawArc(box, -90, sweep, false, paint);
    }
}
