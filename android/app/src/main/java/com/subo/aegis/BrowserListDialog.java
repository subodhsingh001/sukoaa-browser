// SPDX-License-Identifier: GPL-3.0-or-later
package com.subo.aegis;

import android.app.Activity;
import android.app.AlertDialog;
import android.widget.*;
import java.util.List;

/** Scrollable list with separate, accessible open and remove targets. */
final class BrowserListDialog {
  record Row(String title, String detail, Runnable open, Runnable remove, android.graphics.Bitmap icon) {
    Row(String title,String detail,Runnable open,Runnable remove){this(title,detail,open,remove,null);}
  }

  static void show(
      Activity activity,
      String title,
      List<Row> rows,
      String removeLabel,
      String actionLabel,
      Runnable action,
      Runnable refresh) {
    LinearLayout list = new LinearLayout(activity);
    list.setOrientation(LinearLayout.VERTICAL);
    ScrollView scroll = new ScrollView(activity);
    scroll.addView(list);
    AlertDialog dialog =
        new AlertDialog.Builder(activity)
            .setTitle(title)
            .setView(scroll)
            .setNegativeButton("Done", null)
            .setPositiveButton(actionLabel, (d, w) -> action.run())
            .create();
    if (rows.isEmpty()) {
      TextView empty = new TextView(activity);
      empty.setText("No entries");
      empty.setPadding(24, 24, 24, 24);
      list.addView(empty);
    }
    for (Row row : rows) {
      LinearLayout line = new LinearLayout(activity);
      line.setGravity(android.view.Gravity.CENTER_VERTICAL);
      int iconSize=(int)(28*activity.getResources().getDisplayMetrics().density);
      if(row.icon()!=null) {
        ImageView icon=new ImageView(activity);icon.setImageBitmap(row.icon());
        icon.setScaleType(ImageView.ScaleType.FIT_CENTER);icon.setImportantForAccessibility(android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        line.addView(icon,new LinearLayout.LayoutParams(iconSize,iconSize));
      } else {
        TextView badge=new TextView(activity);String label=row.detail();
        int start=label.indexOf("https://");if(start<0)start=label.indexOf("http://");
        String host=start<0?"":android.net.Uri.parse(label.substring(start)).getHost();
        String letter=host==null?"":host.replaceFirst("^www\\.","");
        badge.setText(letter.isEmpty()?"S":letter.substring(0,1).toUpperCase(java.util.Locale.ROOT));
        badge.setGravity(android.view.Gravity.CENTER);badge.setTextSize(16);
        badge.setTextColor(BrowserAppearance.palette(activity).accent);
        line.addView(badge,new LinearLayout.LayoutParams(iconSize,iconSize));
      }
      Button open = new Button(activity);
      open.setAllCaps(false);
      open.setText(row.title() + "\n" + row.detail());
      open.setGravity(android.view.Gravity.START | android.view.Gravity.CENTER_VERTICAL);
      open.setMaxLines(3);
      open.setEllipsize(android.text.TextUtils.TruncateAt.END);
      open.setTooltipText(row.title()+"\n"+row.detail());
      open.setOnClickListener(
          v -> {
            dialog.dismiss();
            row.open().run();
          });
      line.addView(open, new LinearLayout.LayoutParams(0, -2, 1));
      Button remove = new Button(activity);
      remove.setText("×");
      remove.setContentDescription(removeLabel + " " + row.title());
      remove.setOnClickListener(
          v -> {
            dialog.dismiss();
            row.remove().run();
            if (!activity.isFinishing()) refresh.run();
          });
      line.addView(
          remove,
          new LinearLayout.LayoutParams(
              (int) (56 * activity.getResources().getDisplayMetrics().density), -2));
      list.addView(line);
    }
    dialog.show();
  }
}
