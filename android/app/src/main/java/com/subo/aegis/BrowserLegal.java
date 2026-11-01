// SPDX-License-Identifier: GPL-3.0-or-later
package com.subo.aegis;
import android.app.*;
import android.widget.*;
import java.nio.charset.StandardCharsets;
final class BrowserLegal {
  static void show(Activity activity) {
    String[] labels = {"Privacy notice", "Third-party notices", "GPL license", "Source access"};
    String[] files = {"privacy.txt", "notices.txt", "gpl.txt", "sources.txt"};
    new AlertDialog.Builder(activity).setTitle("Privacy & licenses").setItems(labels, (d, i) -> {
      try (java.io.InputStream input = activity.getAssets().open("legal/" + files[i])) {
        java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
        byte[] buffer = new byte[8192]; int count;
        while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
        TextView text = new TextView(activity); text.setText(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
        text.setTextIsSelectable(true); text.setPadding(24, 16, 24, 16);
        ScrollView scroll = new ScrollView(activity); scroll.addView(text);
        new AlertDialog.Builder(activity).setTitle(labels[i]).setView(scroll).setPositiveButton("Done", null).show();
      } catch (Exception error) { Toast.makeText(activity, "Document unavailable", Toast.LENGTH_SHORT).show(); }
    }).setNegativeButton("Done", null).show();
  }
}
