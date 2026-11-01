// SPDX-License-Identifier: GPL-3.0-or-later
package com.subo.aegis;

import android.app.*;
import android.content.*;
import android.content.res.*;
import android.graphics.Color;
import android.graphics.drawable.*;
import android.os.Build;
import android.view.*;
import android.webkit.WebView;
import android.widget.*;
import java.util.Locale;

/** Shared native appearance, applied in place so live/private tabs keep their sessions. */
public final class BrowserAppearance {
  private BrowserAppearance() {}

  static SharedPreferences preferences(Context context) {
    return context.getSharedPreferences("aegis", Context.MODE_PRIVATE);
  }

  public static ThemePalette palette(Context context) {
    SharedPreferences p = preferences(context);
    boolean systemDark =
        (context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
            == Configuration.UI_MODE_NIGHT_YES;
    return ThemePalette.resolve(
        p.getString("appearance-mode", "system"),
        p.getString("appearance-style", "refined"),
        p.getString("appearance-accent", "mint"),
        systemDark);
  }

  public static int theme(Context context) {
    return palette(context).dark ? R.style.AppThemeDark : R.style.AppThemeLight;
  }

  public static String key(ThemePalette p) {
    return p.mode + ":" + p.style + ":" + p.accentName + ":" + p.dark;
  }

  static int dp(Context c, int n) {
    return Math.round(n * c.getResources().getDisplayMetrics().density);
  }

  static GradientDrawable shape(Context c, ThemePalette p, int fill, int radius) {
    GradientDrawable d = new GradientDrawable();
    d.setColor(fill);
    d.setCornerRadius(dp(c, radius));
    d.setStroke(dp(c, 1), p.line);
    return d;
  }

  public static void window(Activity a, ThemePalette p) {
    a.setTheme(p.dark ? R.style.AppThemeDark : R.style.AppThemeLight);
    a.getWindow().setStatusBarColor(p.background);
    a.getWindow().setNavigationBarColor(p.background);
    if (Build.VERSION.SDK_INT >= 30) {
      WindowInsetsController controller = a.getWindow().getInsetsController();
      if (controller != null)
        controller.setSystemBarsAppearance(
            p.dark
                ? 0
                : WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
    } else {
      View decor = a.getWindow().getDecorView();
      int mask = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
      decor.setSystemUiVisibility((decor.getSystemUiVisibility() & ~mask) | (p.dark ? 0 : mask));
    }
  }

  public static void apply(View view, ThemePalette p) {
    if (view == null) return;
    // Page renderers own their pixels; never recolour arbitrary website internals.
    if (view instanceof WebView
        || view instanceof SurfaceView
        || view.getClass().getName().startsWith("org.mozilla.geckoview.")) return;
    Context c = view.getContext();
    String tag = String.valueOf(view.getTag());
    int tint =
        "chrome-private".equals(tag)
            ? p.privateAccent
            : "chrome-accent".equals(tag) || "chrome-logo".equals(tag)
                ? p.accent
                : "chrome-muted".equals(tag) || "chrome-muted-icon".equals(tag) ? p.muted : p.text;
    ColorStateList colors =
        new ColorStateList(
            new int[][] {new int[] {-android.R.attr.state_enabled}, new int[] {}},
            new int[] {(p.muted & 0x00ffffff) | 0x66000000, tint});
    if ("chrome-root".equals(tag)) view.setBackgroundColor(p.background);
    if ("chrome-card".equals(tag) || "chrome-input".equals(tag)) {
      view.setBackground(shape(c, p, p.surface, p.refined ? 16 : 7));
      view.setElevation(p.refined ? dp(c, 2) : 0);
    }
    if ("chrome-nav".equals(tag)) {
      GradientDrawable bg =
          new GradientDrawable(
              GradientDrawable.Orientation.TOP_BOTTOM,
              new int[] {p.surface, p.refined ? p.background : p.surface});
      view.setBackground(bg);
    }
    if (view instanceof TextView) {
      TextView text = (TextView) view;
      text.setTextColor(colors);
      text.setCompoundDrawableTintList(colors);
      if (text instanceof EditText) {
        text.setHintTextColor(p.muted);
        text.setHighlightColor((p.accent & 0x00ffffff) | 0x44000000);
      }
    }
    if (view instanceof Button || view instanceof ImageButton) {
      int fill = view instanceof ImageButton ? Color.TRANSPARENT : p.surface;
      view.setBackground(
          new RippleDrawable(
              ColorStateList.valueOf((p.accent & 0x00ffffff) | 0x33000000),
              shape(c, p, fill, p.refined ? 12 : 5),
              null));
    }
    if (view instanceof ImageView) ((ImageView) view).setImageTintList(colors);
    if (view instanceof ProgressBar)
      ((ProgressBar) view).setProgressTintList(ColorStateList.valueOf(p.accent));
    if (view instanceof ViewGroup) {
      ViewGroup group = (ViewGroup) view;
      for (int i = 0; i < group.getChildCount(); i++) apply(group.getChildAt(i), p);
    }
  }

  static String hex(int color) {
    return String.format(Locale.ROOT, "#%06x", color & 0xffffff);
  }

  public static String homeCss(ThemePalette p) {
    return "html[data-platform=android]{color-scheme:"
        + (p.dark ? "dark" : "light")
        + ";--bg:"
        + hex(p.background)
        + ";--surface:"
        + hex(p.surface)
        + ";--text:"
        + hex(p.text)
        + ";--muted:"
        + hex(p.muted)
        + ";--accent:"
        + hex(p.accent)
        + ";--highlight:"
        + hex(p.accent)
        + ";--line:"
        + (p.dark ? "#ffffff22" : "#17212f22")
        + "}"
        + "html[data-platform=android] .wallpaper{display:"
        + (p.refined ? "block" : "none")
        + ";background:radial-gradient(ellipse at 90% 20%,"
        + hex(p.accent)
        + "18,transparent 65%)}html[data-platform=android]"
        + " .clock{background:none;color:var(--text);-webkit-text-fill-color:currentColor}html[data-platform=android]"
        + " .search>button,html[data-platform=android] dialog button[type=submit]{color:"
        + (p.dark ? "#0c1118" : "#ffffff")
        + "}"
        + "html[data-platform=android] .search{box-shadow:"
        + (p.refined ? "0 12px 38px #00000012" : "none")
        + ";border-radius:"
        + (p.refined ? "18px" : "8px")
        + "}";
  }

  public static void show(Activity activity, Runnable changed) {
    ThemePalette p = palette(activity);
    String themeName =
        "system".equals(p.mode) ? "Follow system" : "light".equals(p.mode) ? "Light" : "Dark";
    String accentName =
        "blue".equals(p.accentName) ? "Blue" : "violet".equals(p.accentName) ? "Violet" : "Mint";
    new AlertDialog.Builder(activity)
        .setTitle("Appearance")
        .setItems(
            new String[] {
              "Theme · " + themeName,
              "Style · " + (p.refined ? "Refined" : "Standard"),
              "Accent · " + accentName
            },
            (dialog, choice) -> {
              String key;
              String[] values, labels;
              int selected;
              if (choice == 0) {
                key = "appearance-mode";
                values = new String[] {"system", "light", "dark"};
                labels = new String[] {"Follow system", "Light", "Dark"};
                selected = "light".equals(p.mode) ? 1 : "dark".equals(p.mode) ? 2 : 0;
              } else if (choice == 1) {
                key = "appearance-style";
                values = new String[] {"standard", "refined"};
                labels =
                    new String[] {"Standard · simple surfaces", "Refined · rounded cards & depth"};
                selected = p.refined ? 1 : 0;
              } else {
                key = "appearance-accent";
                values = new String[] {"mint", "blue", "violet"};
                labels = new String[] {"Mint", "Blue", "Violet"};
                selected = "blue".equals(p.accentName) ? 1 : "violet".equals(p.accentName) ? 2 : 0;
              }
              new AlertDialog.Builder(activity)
                  .setTitle(
                      choice == 0 ? "Theme" : choice == 1 ? "Interface style" : "Accent colour")
                  .setSingleChoiceItems(
                      labels,
                      selected,
                      (picker, index) -> {
                        preferences(activity).edit().putString(key, values[index]).apply();
                        picker.dismiss();
                        changed.run();
                      })
                  .setNegativeButton("Cancel", null)
                  .show();
            })
        .setPositiveButton("Done", null)
        .show();
  }
}
