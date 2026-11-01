import com.subo.aegis.ThemePalette;

public class ThemePaletteTest {
  static double channel(int c) {
    double v = c / 255.0;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  static double luminance(int c) {
    return .2126 * channel((c >> 16) & 255)
        + .7152 * channel((c >> 8) & 255)
        + .0722 * channel(c & 255);
  }

  static double contrast(int a, int b) {
    double x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  }

  public static void main(String[] args) {
    int checks = 0;
    for (String mode : new String[] {"system", "light", "dark"})
      for (String style : new String[] {"standard", "refined"})
        for (String accent : new String[] {"mint", "blue", "violet"})
          for (boolean system : new boolean[] {false, true}) {
            ThemePalette p = ThemePalette.resolve(mode, style, accent, system);
            if (p.dark != (mode.equals("dark") || (mode.equals("system") && system)))
              throw new AssertionError("system/override");
            for (int foreground : new int[] {p.text, p.muted, p.accent, p.privateAccent}) {
              for (int background : new int[] {p.background, p.surface}) {
                if (contrast(foreground, background) < 4.5)
                  throw new AssertionError(
                      mode
                          + " "
                          + style
                          + " "
                          + accent
                          + " text contrast "
                          + contrast(foreground, background));
                checks++;
              }
            }
          }
    ThemePalette invalid = ThemePalette.resolve("bad", "bad", "bad", true);
    if (!invalid.dark || !invalid.refined || !invalid.accentName.equals("mint"))
      throw new AssertionError("invalid preference fallback");
    System.out.println(
        "PASS: 36 appearance combinations, "
            + checks
            + " text contrast checks, saved override/system and invalid preference handling");
  }
}
