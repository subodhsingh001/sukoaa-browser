// SPDX-License-Identifier: GPL-3.0-or-later
package com.subo.aegis;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.*;

public final class FilterUpdater {
  public static Set<String> download() throws Exception {
    Set<String> blocked = new HashSet<>(), allowed = new HashSet<>();
    Pattern block = Pattern.compile("^\\|\\|([a-z0-9.-]+)\\^\\s*$"),
        allow = Pattern.compile("^@@\\|\\|([a-z0-9.-]+)\\^");
    for (String url :
        new String[] {
          "https://easylist.to/easylist/easylist.txt",
          "https://easylist.to/easylist/easyprivacy.txt"
        }) {
      HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
      c.setConnectTimeout(20000);
      c.setReadTimeout(20000);
      c.setInstanceFollowRedirects(false);
      try {
        if (c.getResponseCode() != 200) throw new IOException("Filter server unavailable");
        int chars = 0;
        boolean header = false;
        try (BufferedReader reader =
            new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8))) {
          String line;
          while ((line = reader.readLine()) != null) {
            chars += line.length();
            if (chars > 12000000) throw new IOException("Filter list too large");
            if (line.startsWith("[Adblock")) header = true;
            Matcher b = block.matcher(line);
            if (b.matches()) blocked.add(b.group(1));
            Matcher a = allow.matcher(line);
            if (a.find()) allowed.add(a.group(1));
          }
        }
        if (!header || chars < 10000) throw new IOException("Invalid filter list");
      } finally {
        c.disconnect();
      }
    }
    blocked.removeIf(
        h -> {
          String part = h;
          while (true) {
            if (allowed.contains(part)) return true;
            int dot = part.indexOf('.');
            if (dot < 0) return false;
            part = part.substring(dot + 1);
          }
        });
    if (blocked.size() < 10000) throw new IOException("Filter update incomplete");
    return blocked;
  }
}
