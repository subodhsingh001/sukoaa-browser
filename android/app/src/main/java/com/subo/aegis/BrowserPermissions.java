// SPDX-License-Identifier: GPL-3.0-or-later
package com.subo.aegis;

import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;
import java.util.*;
import java.lang.ref.WeakReference;
import java.util.function.*;

/** Per-origin decisions; private decisions never enter SharedPreferences. */
final class BrowserPermissions {
  static final int REQUEST = 7304;
  static final String[] KINDS = {"camera", "microphone", "location"};
  static final Map<String,String> SESSION = new HashMap<>();
  static final List<WeakReference<BrowserPermissions>> LIVE = new ArrayList<>();
  Runnable reloadNormal=()->{};
  Scope pendingScope;
  void normalChanged() {
    LIVE.removeIf(ref->ref.get()==null);
    for(WeakReference<BrowserPermissions> ref:new ArrayList<>(LIVE)) {
      BrowserPermissions manager=ref.get();if(manager==null)continue;
      if(manager.pendingScope!=null && !manager.pendingScope.privateMode)manager.cancel();
      manager.reloadNormal.run();
    }
  }
  void destroy() {cancel();LIVE.removeIf(ref->ref.get()==null || ref.get()==this);}

  static class Scope {
    final boolean privateMode;
    final Map<String,String> temporary = new HashMap<>();
    final Supplier<String> url;
    final BooleanSupplier active;
    int revision;
    Scope(boolean p, Supplier<String> u, BooleanSupplier a) {privateMode=p;url=u;active=a;}
  }
  final Activity activity;
  final SharedPreferences saved;
  Runnable pendingDeny;
  Runnable runtimeResult;
  AlertDialog prompt;
  BrowserPermissions(Activity a) {activity=a;saved=a.getSharedPreferences("sukoaa-site-permissions",0);LIVE.add(new WeakReference<>(this));}
  static String origin(String raw) {
    try {
      Uri u=Uri.parse(raw);String scheme=u.getScheme(),host=u.getHost();
      if(host==null || u.getUserInfo()!=null || !("https".equals(scheme) || ("http".equals(scheme) && ("localhost".equals(host)||"127.0.0.1".equals(host)||"::1".equals(host))))) return "";
      host=host.toLowerCase(java.util.Locale.ROOT); if(host.contains(":"))host="["+host+"]";
      int port=u.getPort();return scheme+"://"+host+(port==-1 || ("https".equals(scheme)&&port==443) || ("http".equals(scheme)&&port==80) ? "" : ":"+port);
    } catch(Exception e) {return "";}
  }
  String key(String site,String kind) {return site+"|"+kind;}
  String get(Scope scope,String site,String kind) {
    String key=key(site,kind);
    if(scope.privateMode)return scope.temporary.getOrDefault(key,"ask");
    String stored=saved.getString(key,"ask");
    if("block".equals(stored))return stored;
    return SESSION.getOrDefault(key,stored);
  }
  boolean osGranted(List<String> kinds) {
    for(String k:kinds) {
      if(k.equals("location")) {
        if(activity.checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED && activity.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)return false;
      } else if(activity.checkSelfPermission(k.equals("camera")?android.Manifest.permission.CAMERA:android.Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)return false;
    }
    return true;
  }
  void ask(Scope scope,String uri,List<String> kinds,Consumer<Boolean> callback) {
    String site=origin(uri), document=scope.url.get();int revision=scope.revision;
    if(site.isEmpty() || !site.equals(origin(document)) || !scope.active.getAsBoolean() || kinds.isEmpty() || !Arrays.asList(KINDS).containsAll(kinds) || pendingDeny!=null) {callback.accept(false);return;}
    final boolean[] done={false};
    Consumer<Boolean> finish=value->{if(!done[0]){done[0]=true;runtimeResult=null;pendingDeny=null;pendingScope=null;try{callback.accept(value && scope.active.getAsBoolean() && scope.revision==revision && document.equals(scope.url.get()));}catch(RuntimeException ignored){}}};
    pendingScope=scope;pendingDeny=()->finish.accept(false);
    for(String k:kinds)if(get(scope,site,k).equals("block")){finish.accept(false);return;}
    Consumer<Integer> decide=choice->{
      if(done[0] || !scope.active.getAsBoolean() || scope.revision!=revision || !document.equals(scope.url.get())){finish.accept(false);return;}
      boolean allow=scope.privateMode?choice==0:choice<2;
      boolean block=scope.privateMode?choice==1:choice==2;
      if(!allow){
        if(block)for(String k:kinds){if(scope.privateMode)scope.temporary.put(key(site,k),"block");else{SESSION.remove(key(site,k));saved.edit().putString(key(site,k),"block").apply();}}
        if(block && !scope.privateMode)normalChanged();
        finish.accept(false);return;
      }
      Runnable grant=()->{
        if(!scope.active.getAsBoolean() || scope.revision!=revision || !document.equals(scope.url.get()) || !osGranted(kinds)){finish.accept(false);return;}
        for(String k:kinds){if(scope.privateMode)scope.temporary.put(key(site,k),"allow");else if(choice==1)saved.edit().putString(key(site,k),"allow").apply();else SESSION.put(key(site,k),"allow");}
        finish.accept(true);
      };
      if(osGranted(kinds)){grant.run();return;}
      ArrayList<String> os=new ArrayList<>();
      if(kinds.contains("camera"))os.add(android.Manifest.permission.CAMERA);
      if(kinds.contains("microphone"))os.add(android.Manifest.permission.RECORD_AUDIO);
      if(kinds.contains("location")){os.add(android.Manifest.permission.ACCESS_COARSE_LOCATION);os.add(android.Manifest.permission.ACCESS_FINE_LOCATION);}
      runtimeResult=grant;
      try{activity.requestPermissions(os.toArray(new String[0]),REQUEST);}catch(Exception e){finish.accept(false);}
    };
    boolean all=true;for(String k:kinds)all &= get(scope,site,k).equals("allow");
    if(all){decide.accept(scope.privateMode?0:0);return;}
    if(!activity.hasWindowFocus()){finish.accept(false);return;}
    String[] choices=scope.privateMode?new String[]{"Allow for this private tab","Block for this private tab","Not now"}:new String[]{"Allow for this session","Always allow","Block","Not now"};
    prompt=new AlertDialog.Builder(activity).setTitle(site+" wants "+String.join(" and ",kinds))
      .setItems(choices,(d,i)->decide.accept(i)).setOnCancelListener(d->finish.accept(false)).create();
    prompt.show();
  }
  void onResult(int code) {if(code==REQUEST && runtimeResult!=null){Runnable r=runtimeResult;runtimeResult=null;r.run();}}
  void cancel() {if(pendingDeny!=null)pendingDeny.run();if(prompt!=null){prompt.dismiss();prompt=null;}}
  void settings(Scope scope,Runnable reload) {
    if(scope==null)return;
    Set<String> sites=new TreeSet<>();String current=origin(scope.url.get());if(!current.isEmpty())sites.add(current);
    Collection<String> keys=scope.privateMode?scope.temporary.keySet():saved.getAll().keySet();
    for(String k:keys)if(k.contains("|"))sites.add(k.substring(0,k.lastIndexOf('|')));
    if(!scope.privateMode)for(String k:SESSION.keySet())sites.add(k.substring(0,k.lastIndexOf('|')));
    String[] values=sites.toArray(new String[0]);
    new AlertDialog.Builder(activity).setTitle(scope.privateMode?"Site permissions · private tab":"Site permissions")
      .setItems(values,(d,i)->chooseSite(scope,values[i],reload))
      .setMessage(values.length==0?"Open an HTTPS website first.":null)
      .setPositiveButton("Reset all",(d,w)->{cancel();scope.revision++;if(scope.privateMode)scope.temporary.clear();else{saved.edit().clear().apply();SESSION.clear();}if(scope.privateMode)reload.run();else normalChanged();})
      .setNeutralButton("Android settings",(d,w)->activity.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+activity.getPackageName()))))
      .setNegativeButton("Close",null).show();
  }
  void chooseSite(Scope scope,String site,Runnable reload) {
    String[] labels=new String[KINDS.length];for(int i=0;i<KINDS.length;i++)labels[i]=KINDS[i]+": "+get(scope,site,KINDS[i]);
    new AlertDialog.Builder(activity).setTitle(site).setItems(labels,(d,i)->{
      String kind=KINDS[i];String[] states={"ask","allow","block"};
      new AlertDialog.Builder(activity).setTitle(kind+" · "+site).setItems(new String[]{"Ask","Allow","Block"},(dialog,n)->{
        cancel();scope.revision++;String key=key(site,kind);scope.temporary.remove(key);SESSION.remove(key);
        if(scope.privateMode){if(n!=0)scope.temporary.put(key,states[n]);}
        else if(n==0)saved.edit().remove(key).apply();else saved.edit().putString(key,states[n]).apply();
        if(scope.privateMode)reload.run();else normalChanged();
      }).setNegativeButton("Cancel",null).show();
    }).setNegativeButton("Close",null).show();
  }
}
