import com.subo.aegis.VisitHistory;
import java.util.*;

public class VisitHistoryTest {
  static class Disk implements VisitHistory.Backend {
    List<VisitHistory.Entry> saved = new ArrayList<>();
    int writes, reads;

    public List<VisitHistory.Entry> load() {
      reads++;
      return new ArrayList<>(saved);
    }

    public void save(List<VisitHistory.Entry> value) {
      writes++;
      saved = new ArrayList<>(value);
    }
  }

  static void check(boolean yes, String message) {
    if (!yes) throw new AssertionError(message);
  }

  public static void main(String[] args) {
    Disk disk = new Disk();
    VisitHistory history = new VisitHistory(disk);
    var normal = new VisitHistory.Scope(false);
    var priv = new VisitHistory.Scope(true);
    history.record(normal, "https://example.com/normal", "Normal");
    int writes = disk.writes, reads = disk.reads;
    history.record(priv, "https://www.google.com/search?q=secret", "Secret");
    history.record(priv, "https://example.com/private-popup", "Private child");
    priv.close();
    history.record(priv, "https://example.com/late-private", "Late callback");
    check(
        disk.writes == writes && disk.reads == reads, "private session touched persistent storage");
    check(history.entries().size() == 1, "private visit leaked");
    normal.close();
    history.record(normal, "https://example.com/late-normal", "Closed tab");
    check(disk.writes == writes, "closed session wrote history");
    var second = new VisitHistory.Scope(false);
    history.record(second, "https://example.com/normal", "Duplicate URL visit");
    var rows = history.entries();
    String survivor = rows.get(1).id();
    history.remove(rows.get(0).id());
    check(
        history.entries().size() == 1 && history.entries().get(0).id().equals(survivor),
        "delete removed wrong duplicate visit");
    history.record(second, "https://aegis.invalid/", "Home");
    check(history.entries().size() == 1, "home logged");
    for (int i = 0; i < 110; i++) history.record(second, "https://example.com/" + i, "Page");
    check(history.entries().size() == 100, "history cap");
    history.clear();
    check(history.entries().isEmpty(), "clear failed");
    var privateOnly = new VisitHistory.Scope(true);
    history.record(privateOnly, "https://example.com/secret", "Secret");
    check(history.entries().isEmpty(), "private repopulated cleared history");
    System.out.println("VisitHistory privacy/lifecycle/individual deletion scenarios passed");
  }
}
