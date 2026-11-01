import com.subo.aegis.BrowserPolicy;

public class BrowserPolicyTest {
  public static void main(String[] args) {
    check(BrowserPolicy.allowed("https://example.com/path?x=1", false));
    check(BrowserPolicy.allowed("https://EXAMPLE.com/", false));
    check(BrowserPolicy.allowed("about:blank", false));
    check(!BrowserPolicy.allowed("http://example.com/", false));
    check(!BrowserPolicy.allowed("file:///etc/passwd", false));
    check(!BrowserPolicy.allowed("javascript:alert(1)", false));
    check(!BrowserPolicy.allowed("https://user:pass@example.com", false));
    check(!BrowserPolicy.allowed("https://", false));
    check(!BrowserPolicy.allowed("moz-extension://abcdef/page.html", false));
    check(BrowserPolicy.allowed("moz-extension://abcdef/page.html", true));
    System.out.println(
        "PASS: Android advanced navigation permits HTTPS, blocks credentials/local/executable URLs,"
            + " and excludes extension pages from private tabs");
  }

  static void check(boolean value) {
    if (!value) throw new AssertionError();
  }
}
