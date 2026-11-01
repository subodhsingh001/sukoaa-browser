import com.subo.aegis.PopupDecision;
import java.util.ArrayList;
import java.util.List;

public class PopupDecisionTest {
  public static void main(String[] args) {
    List<Boolean> answers = new ArrayList<>();
    PopupDecision open = new PopupDecision(answers::add);
    if (!open.resolve(true) || open.resolve(false) || answers.size() != 1 || !answers.get(0))
      throw new AssertionError("Open followed by dialog dismissal must preserve exactly one allow");
    PopupDecision cancelled = new PopupDecision(answers::add);
    if (!cancelled.resolve(false)
        || cancelled.resolve(true)
        || answers.size() != 2
        || answers.get(1))
      throw new AssertionError(
          "Cancel/destroy must reject once; stale Open must not allow a window");
    System.out.println("PASS: popup Open/dismiss and cancel/destroy resolve exactly once");
  }
}
