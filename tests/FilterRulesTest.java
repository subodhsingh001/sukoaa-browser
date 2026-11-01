import com.subo.aegis.FilterRules;
import java.util.*;

public class FilterRulesTest {
  public static void main(String[] args) {
    FilterRules rules = new FilterRules(Arrays.asList("ads.example"));
    check(rules.blocks("https://ads.example/a"));
    check(rules.blocks("https://sub.ads.example/a"));
    check(!rules.blocks("https://notads.example/a"));
    check(!rules.blocks("https://safe.example/?url=https://ads.example"));
    check(!rules.blocks("not a URL"));
    check(rules.blocks("https://sub.ads.example./a"));
    check(rules.blocksHost("ADS.EXAMPLE."));
    check(!rules.blocksHost("notads.example"));
    check(!rules.blocksHost(null));
    check(rules.blocksRequest("adservice.google.com", "/adsid/integrator.js"));
    check(!rules.blocksRequest("adservice.google.com", "/help"));
    check(!rules.blocksRequest("support.google.com", "/adsid/integrator.js"));
    check(!rules.blocks("https://safe.example/?next=adservice.google.com/adsid/integrator.js"));
    System.out.println(
        "PASS Android filter matcher: exact domain, subdomain, boundary, query safety, malformed"
            + " input");
  }

  static void check(boolean value) {
    if (!value) throw new AssertionError();
  }
}
