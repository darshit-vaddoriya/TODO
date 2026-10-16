package app.yaad.todo;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The alerts the web app has planned, kept on the phone so they still ring when the
 * app is closed. Each item: {id, at (epoch ms), title, body, taskId|null, actions, snoozeLabel}.
 */
final class AlarmStore {
    /** The fixed id of the Settings "ring in 1 minute" test, so a re-plan doesn't wipe it. */
    static final int TEST_ID = 7_000_001;

    private static final String PREFS = "yaad_alarms";
    private static final String KEY = "items";

    private AlarmStore() {}

    static synchronized JSONArray load(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            return new JSONArray(prefs.getString(KEY, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static void save(Context context, JSONArray items) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, items.toString()).apply();
    }

    /** Replace the plan with `incoming`, keeping a test alert that has not rung yet. */
    static synchronized void replace(Context context, JSONArray incoming) {
        long now = System.currentTimeMillis();
        JSONArray out = new JSONArray();
        JSONArray old = load(context);
        for (int i = 0; i < old.length(); i++) {
            JSONObject o = old.optJSONObject(i);
            if (o != null && o.optInt("id") == TEST_ID && o.optLong("at") > now) out.put(o);
        }
        for (int i = 0; i < incoming.length(); i++) {
            JSONObject o = incoming.optJSONObject(i);
            if (o != null) out.put(o);
        }
        save(context, out);
    }

    /** Add one item (replacing any with the same id). */
    static synchronized void add(Context context, JSONObject item) {
        JSONArray old = load(context);
        JSONArray out = new JSONArray();
        for (int i = 0; i < old.length(); i++) {
            JSONObject o = old.optJSONObject(i);
            if (o != null && o.optInt("id") != item.optInt("id")) out.put(o);
        }
        out.put(item);
        save(context, out);
    }

    /**
     * Remove and return the alerts due by `until`. Ones more than `maxLateMs` overdue are
     * dropped without ringing (the app lists them as missed instead of a late flood).
     */
    static synchronized List<JSONObject> popDue(Context context, long until, long maxLateMs) {
        long now = System.currentTimeMillis();
        JSONArray old = load(context);
        JSONArray keep = new JSONArray();
        List<JSONObject> due = new ArrayList<>();
        for (int i = 0; i < old.length(); i++) {
            JSONObject o = old.optJSONObject(i);
            if (o == null) continue;
            long at = o.optLong("at");
            if (at > until) keep.put(o);
            else if (now - at <= maxLateMs) due.add(o);
        }
        save(context, keep);
        return due;
    }

    /** When the first stored alert rings, or -1 when there are none. */
    static synchronized long nextAt(Context context) {
        JSONArray items = load(context);
        long next = -1;
        for (int i = 0; i < items.length(); i++) {
            JSONObject o = items.optJSONObject(i);
            if (o == null) continue;
            long at = o.optLong("at");
            if (next < 0 || at < next) next = at;
        }
        return next;
    }

    static synchronized int count(Context context) {
        return load(context).length();
    }
}
