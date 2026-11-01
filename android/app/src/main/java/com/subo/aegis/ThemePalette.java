// SPDX-License-Identifier: GPL-3.0-or-later
package com.subo.aegis;

/** Validated, Android-independent appearance values used by both browser activities. */
public final class ThemePalette {
  public final boolean dark, refined;
  public final int background, surface, raised, text, muted, accent, privateAccent, line;
  public final String mode, style, accentName;

  private ThemePalette(String mode, String style, String accentName, boolean systemDark) {
    this.mode = mode;
    this.style = style;
    this.accentName = accentName;
    dark = "dark".equals(mode) || ("system".equals(mode) && systemDark);
    refined = "refined".equals(style);
    background = dark ? (refined ? 0xff0c1118 : 0xff16191e) : (refined ? 0xfff3f6fa : 0xfff2f2f2);
    surface = dark ? 0xff17212d : 0xffffffff;
    raised = dark ? 0xff223143 : 0xffe8eef5;
    text = dark ? 0xffedf2f8 : 0xff17212f;
    muted = dark ? 0xffa6b3c2 : 0xff526276;
    privateAccent = dark ? 0xffd8bcff : 0xff6b35ab;
    line = dark ? 0x24ffffff : 0x18132134;
    accent =
        "blue".equals(accentName)
            ? (dark ? 0xff9bc2ff : 0xff235fca)
            : "violet".equals(accentName)
                ? (dark ? 0xffd5b8ff : 0xff7043b9)
                : (dark ? 0xff86e2c8 : 0xff08745d);
  }

  public static ThemePalette resolve(String mode, String style, String accent, boolean systemDark) {
    if (!"light".equals(mode) && !"dark".equals(mode)) mode = "system";
    if (!"standard".equals(style)) style = "refined";
    if (!"blue".equals(accent) && !"violet".equals(accent)) accent = "mint";
    return new ThemePalette(mode, style, accent, systemDark);
  }
}
