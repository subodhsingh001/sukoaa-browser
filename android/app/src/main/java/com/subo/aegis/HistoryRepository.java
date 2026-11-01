// SPDX-License-Identifier: GPL-3.0-or-later
package com.subo.aegis;

import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

final class HistoryRepository implements VisitHistory.Backend {
  private final SharedPreferences prefs;

  HistoryRepository(SharedPreferences prefs) {
    this.prefs = prefs;
  }

  public List<VisitHistory.Entry> load() {
    List<VisitHistory.Entry> entries = new ArrayList<>();
    boolean migrated = false;
    try {
      JSONArray array = new JSONArray(prefs.getString("history", "[]"));
      for (int i = 0; i < array.length(); i++) {
        JSONObject item = array.getJSONObject(i);
        String id = item.optString("id", "");
        if (id.isEmpty()) {
          id = UUID.randomUUID().toString();
          migrated = true;
        }
        entries.add(
            new VisitHistory.Entry(
                id, item.getString("url"), item.optString("title", item.getString("url"))));
      }
      if (migrated) save(entries);
    } catch (Exception ignored) {
    }
    return entries;
  }

  public void save(List<VisitHistory.Entry> entries) {
    JSONArray array = new JSONArray();
    try {
      for (VisitHistory.Entry entry : entries)
        array.put(
            new JSONObject()
                .put("id", entry.id())
                .put("url", entry.url())
                .put("title", entry.title()));
      prefs.edit().putString("history", array.toString()).apply();
    } catch (Exception ignored) {
    }
  }
}
