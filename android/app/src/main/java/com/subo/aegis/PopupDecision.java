// SPDX-License-Identifier: GPL-3.0-or-later
package com.subo.aegis;

import java.util.function.Consumer;

/** Completes an asynchronous popup request once, including dialog dismiss/destroy paths. */
public final class PopupDecision {
  private final Consumer<Boolean> callback;
  private boolean resolved;

  public PopupDecision(Consumer<Boolean> callback) {
    this.callback = callback;
  }

  public boolean resolve(boolean allow) {
    if (resolved) return false;
    resolved = true;
    callback.accept(allow);
    return true;
  }
}
