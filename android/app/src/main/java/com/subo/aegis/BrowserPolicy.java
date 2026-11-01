// SPDX-License-Identifier: GPL-3.0-or-later
package com.subo.aegis;

import java.net.URI;

/** Navigation guard shared by advanced regular/private tabs. */
public final class BrowserPolicy {
  private BrowserPolicy() {}

  public static boolean allowed(String value, boolean extensionPages) {
    if ("about:blank".equals(value)) return true;
    try {
      URI uri = new URI(value);
      if (uri.getUserInfo() != null || uri.getHost() == null || uri.getHost().isEmpty())
        return false;
      return "https".equalsIgnoreCase(uri.getScheme())
          || (extensionPages && "moz-extension".equalsIgnoreCase(uri.getScheme()));
    } catch (Exception ignored) {
      return false;
    }
  }
}
