// SPDX-License-Identifier: GPL-3.0-or-later
import com.subo.aegis.ExternalAppPolicy;
public class ExternalAppPolicyTest {
 public static void main(String[] args) {
  check(ExternalAppPolicy.youtube("https://www.youtube.com/watch?v=test&t=42"));
  check(ExternalAppPolicy.youtube("https://youtu.be/test"));
  check(!ExternalAppPolicy.youtube("https://youtube.com.evil.example/watch"));
  check(!ExternalAppPolicy.youtube("https://user@youtube.com/watch"));
  check(ExternalAppPolicy.appData("vnd.youtube:test"));
  check(ExternalAppPolicy.appData("tel:+911234567890"));
  check(ExternalAppPolicy.appData("mailto:user@example.com"));
  for(String s:new String[]{"javascript:alert(1)","file:///private","content://provider/path","data:text/html,hello","https://user:pass@example.com","https://example.com/\n"})check(!ExternalAppPolicy.appData(s));
  check(!ExternalAppPolicy.web("http://example.com/fallback"));
  check(!ExternalAppPolicy.web("intent://unsafe"));
  check(ExternalAppPolicy.web("https://example.com/fallback?q=1"));
  System.out.println("PASS: app handoff permits HTTPS/approved schemes; rejects spoofed YouTube hosts, credentials, local/executable URLs and unsafe fallback links");
 }
 static void check(boolean ok){if(!ok)throw new AssertionError();}
}
