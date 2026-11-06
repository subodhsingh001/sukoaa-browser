// SPDX-License-Identifier: GPL-3.0-or-later
package com.subo.aegis;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.widget.Toast;
import java.util.function.Consumer;

/** Native handoff only; no cookie, clipboard or page-script privileges are transferred. */
public final class ExternalApps {
  private ExternalApps() {}
  /** Preserve a short native tap across a site's asynchronous app-link redirect. */
  static final class Gesture {
    float x,y;long tappedAt;boolean down;
    void touch(android.view.MotionEvent event,int tolerance) {
      int action=event.getActionMasked();
      if(action==android.view.MotionEvent.ACTION_DOWN){x=event.getX();y=event.getY();down=true;}
      if(action==android.view.MotionEvent.ACTION_MOVE && Math.hypot(event.getX()-x,event.getY()-y)>tolerance)down=false;
      if(action==android.view.MotionEvent.ACTION_UP){if(down)tappedAt=android.os.SystemClock.elapsedRealtime();down=false;}
      if(action==android.view.MotionEvent.ACTION_CANCEL)down=false;
    }
    boolean recent(){return tappedAt>0 && android.os.SystemClock.elapsedRealtime()-tappedAt<2500;}
  }
  private static void say(Activity a,String message){Toast.makeText(a,message,Toast.LENGTH_LONG).show();}
  @androidx.annotation.UiThread
  public static void openPage(Activity a,String url,boolean privateMode) {
    if(a.isFinishing() || a.isDestroyed())return;
    if(!ExternalAppPolicy.web(url)){say(a,"Open an HTTPS page first.");return;}
    Intent target=new Intent(Intent.ACTION_VIEW,Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE);
    if(ExternalAppPolicy.youtube(url))target.setPackage("com.google.android.youtube");
    else if(Build.VERSION.SDK_INT>=30)target.addFlags(Intent.FLAG_ACTIVITY_REQUIRE_NON_BROWSER);
    Runnable open=()->launch(a,target,null,null);
    if(privateMode)new AlertDialog.Builder(a).setTitle("Leave private browsing?")
      .setMessage("The page address will be shared with the other app. That app has its own history, account and privacy settings.")
      .setPositiveButton("Open app",(d,w)->open.run()).setNegativeButton("Stay here",null).show();
    else open.run();
  }
  @androidx.annotation.UiThread
  public static boolean intercept(Activity a,String value,boolean userGesture,boolean privateMode,Consumer<String> openFallback) {
    if(a.isFinishing() || a.isDestroyed())return true;
    if(value==null || (!value.startsWith("intent:") && !ExternalAppPolicy.appData(value)) || ExternalAppPolicy.web(value))return false;
    if(!ExternalAppPolicy.clean(value))return true;
    if(!userGesture){say(a,"App opening needs your tap. Use Browser menu > Open in app.");return true;}
    try {
      Intent parsed=value.startsWith("intent:")?Intent.parseUri(value,Intent.URI_INTENT_SCHEME):new Intent(Intent.ACTION_VIEW,Uri.parse(value));
      Uri uri=parsed.getData();String fallback=parsed.getStringExtra("browser_fallback_url");
      if(uri==null || !ExternalAppPolicy.appData(uri.toString())){say(a,"This app link is not supported.");return true;}
      if(!ExternalAppPolicy.web(fallback))fallback=null;
      // Reconstruct from approved data only. Never inherit component, selector, flags, ClipData or extras.
      Intent target=new Intent(Intent.ACTION_VIEW,uri).addCategory(Intent.CATEGORY_BROWSABLE);
      String pkg=parsed.getPackage();
      if("vnd.youtube".equalsIgnoreCase(uri.getScheme()) || "youtube".equalsIgnoreCase(uri.getScheme()))pkg="com.google.android.youtube";
      if(pkg!=null && pkg.matches("[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)+") && !pkg.equals(a.getPackageName()))target.setPackage(pkg);
      else if(Build.VERSION.SDK_INT>=30 && "https".equalsIgnoreCase(uri.getScheme()))target.addFlags(Intent.FLAG_ACTIVITY_REQUIRE_NON_BROWSER);
      final String safeFallback=fallback;
      String message="This page wants to open another app. Only the link is shared."+(privateMode?" The other app can keep its own history, including this private page address.":"");
      message+="\n\n"+uri.toString().substring(0,Math.min(240,uri.toString().length()));
      AlertDialog.Builder dialog=new AlertDialog.Builder(a).setTitle("Open in app?").setMessage(message)
        .setPositiveButton("Open app",(d,w)->launch(a,target,safeFallback,openFallback)).setNegativeButton("Stay here",null);
      if(safeFallback!=null)dialog.setNeutralButton("Open website",(d,w)->openFallback.accept(safeFallback));
      dialog.show();
    } catch(Exception error){say(a,"Could not open this app link. You can keep using the website.");}
    return true;
  }
  private static void launch(Activity a,Intent target,String fallback,Consumer<String> openFallback) {
    try {a.startActivity(target);}
    catch(ActivityNotFoundException|SecurityException error) {
      if(fallback!=null && openFallback!=null)openFallback.accept(fallback);
      else say(a,"No compatible app is installed or allowed to open this link. Install/enable it in Android, or continue on the website.");
    }
  }
}
