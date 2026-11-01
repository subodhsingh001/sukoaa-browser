// SPDX-License-Identifier: GPL-3.0-or-later
package com.subo.aegis;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Only live, regular sessions may write to persistent browsing history. */
public final class VisitHistory {
  public record Entry(String id, String url, String title) {}

  public interface Backend {
    List<Entry> load();

    void save(List<Entry> entries);
  }

  public static final class Scope {
    private final boolean privateMode;
    private boolean closed;

    public Scope(boolean privateMode) {
      this.privateMode = privateMode;
    }

    public void close() {
      closed = true;
    }
  }

  private final Backend backend;

  public VisitHistory(Backend backend) {
    this.backend = backend;
  }

  public void record(Scope scope, String url, String title) {
    if (scope == null
        || scope.privateMode
        || scope.closed
        || url == null
        || !url.startsWith("https://")
        || url.startsWith("https://aegis.invalid/")) return;
    List<Entry> next = new ArrayList<>(backend.load());
    next.add(0, new Entry(UUID.randomUUID().toString(), url, title == null ? url : title));
    backend.save(new ArrayList<>(next.subList(0, Math.min(100, next.size()))));
  }

  public List<Entry> entries() {
    return new ArrayList<>(backend.load());
  }

  public void remove(String id) {
    List<Entry> next = new ArrayList<>(backend.load());
    next.removeIf(entry -> entry.id().equals(id));
    backend.save(next);
  }

  public void clear() {
    backend.save(new ArrayList<>());
  }
}
