package com.subo.aegis;

import android.content.SharedPreferences;
import java.lang.reflect.Proxy;
import java.util.*;

/** JVM adapter regression; real JSON with an in-memory SharedPreferences interface. */
public class HistoryRepositoryTest {
  static void check(boolean yes, String message) {
    if (!yes) throw new AssertionError(message);
  }

  public static void main(String[] args) {
    Map<String, String> memory = new HashMap<>();
    memory.put(
        "history",
        "[{\"url\":\"https://example.com/old\",\"title\":\"Legacy\"},{\"url\":\"https://example.com/old\",\"title\":\"Older"
            + " duplicate\"}]");
    SharedPreferences prefs =
        (SharedPreferences)
            Proxy.newProxyInstance(
                HistoryRepositoryTest.class.getClassLoader(),
                new Class<?>[] {SharedPreferences.class},
                (p, method, values) -> {
                  if (method.getName().equals("getString"))
                    return memory.getOrDefault((String) values[0], (String) values[1]);
                  if (method.getName().equals("edit")) {
                    Map<String, String> pending = new HashMap<>();
                    return Proxy.newProxyInstance(
                        HistoryRepositoryTest.class.getClassLoader(),
                        new Class<?>[] {SharedPreferences.Editor.class},
                        (editor, operation, arguments) -> {
                          if (operation.getName().equals("putString")) {
                            pending.put((String) arguments[0], (String) arguments[1]);
                            return editor;
                          }
                          if (operation.getName().equals("apply")) {
                            memory.putAll(pending);
                            return null;
                          }
                          throw new UnsupportedOperationException(operation.getName());
                        });
                  }
                  throw new UnsupportedOperationException(method.getName());
                });
    VisitHistory history = new VisitHistory(new HistoryRepository(prefs));
    var snapshot = history.entries();
    check(snapshot.size() == 2, "legacy entries lost");
    check(!snapshot.get(0).id().equals(snapshot.get(1).id()), "duplicate IDs");
    VisitHistory otherScreen = new VisitHistory(new HistoryRepository(prefs));
    check(
        otherScreen.entries().get(0).id().equals(snapshot.get(0).id()),
        "migration ID not persistent");
    otherScreen.record(new VisitHistory.Scope(false), "https://example.com/new", "Later visit");
    history.remove(snapshot.get(0).id());
    var remaining = history.entries();
    check(
        remaining.size() == 2
            && remaining.get(0).title().equals("Later visit")
            && remaining.get(1).title().equals("Older duplicate"),
        "stale dialog deletion lost later or duplicate visit");
    String diskBefore = memory.get("history");
    otherScreen.record(
        new VisitHistory.Scope(true), "https://google.com/search?q=secret", "Secret");
    check(memory.get("history").equals(diskBefore), "private record changed JSON");
    System.out.println(
        "HistoryRepository legacy migration/stale dialog/private persistence scenarios passed");
  }
}
