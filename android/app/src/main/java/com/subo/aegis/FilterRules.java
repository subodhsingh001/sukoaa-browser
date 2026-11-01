// SPDX-License-Identifier: GPL-3.0-or-later
package com.subo.aegis;

import java.net.URI;
import java.util.*;

/** Domain-boundary matching, never arbitrary URL substring matching. */
public final class FilterRules {
  private final Set<String> domains;

  public FilterRules(Collection<String> hosts) {
    domains = Collections.unmodifiableSet(new HashSet<>(hosts));
  }

  public boolean blocks(String url) {
    try {
      URI request = new URI(url);
      return blocksRequest(request.getHost(), request.getPath());
    } catch (Exception e) {
      return false;
    }
  }

  /** Use the host already parsed by WebResourceRequest; avoid reparsing every URL. */
  private static String canonicalHost(String host) {
    if (host == null) return "";
    String h = host.toLowerCase(Locale.ROOT);
    // A fully qualified DNS name with a final dot resolves to the same server.
    while (h.endsWith(".")) h = h.substring(0, h.length() - 1);
    return h;
  }

  public boolean blocksHost(String host) {
    return blockedDomain(canonicalHost(host));
  }

  public boolean blocksRequest(String host, String path) {
    String h = canonicalHost(host);
    // Narrow supplement for a dedicated advertising integration endpoint missed
    // by the extracted host list. Do not block Google services or other paths.
    return blockedDomain(h)
        || ("adservice.google.com".equals(h) && path != null && path.startsWith("/adsid/"));
  }

  private boolean blockedDomain(String host) {
    String h = host;
    while (!h.isEmpty()) {
      if (domains.contains(h)) return true;
      int dot = h.indexOf('.');
      if (dot < 0) return false;
      h = h.substring(dot + 1);
    }
    return false;
  }

  public int size() {
    return domains.size();
  }
}
