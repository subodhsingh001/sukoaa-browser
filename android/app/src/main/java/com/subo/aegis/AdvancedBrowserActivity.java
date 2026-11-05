// SPDX-License-Identifier: GPL-3.0-or-later
package com.subo.aegis;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.view.inputmethod.EditorInfo;
import android.widget.*;
import java.io.*;
import java.net.URLEncoder;
import java.util.*;
import java.util.concurrent.*;
import org.mozilla.geckoview.*;

/** Gecko-backed tabs: real private mode and signed Firefox-compatible add-ons. */
public class AdvancedBrowserActivity extends Activity {
  private BrowserPermissions permissions;
  private static GeckoRuntime runtime;
  private final ArrayList<Tab> tabs = new ArrayList<>();
  private final Map<String, WebExtension.Action> actions = new HashMap<>();
  private final Map<String, WebExtension> ownedAddons = new HashMap<>();
  private GeckoResult<WebExtension.PermissionPromptResponse> pendingPrompt;
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private LinearLayout root, toolbar, navigation;
  private TextView mode, status;
  private EditText address;
  private GeckoView view;
  private Tab current;
  private VisitHistory history;
  private boolean fullScreen, foreground;
  private boolean policyReady;
  private final List<Runnable> pendingTabs=new ArrayList<>();
  private AlertDialog popupDialog;
  private PopupDecision popupDecision;
  private ThemePalette palette;
  private String appearanceKey = "";

  private static class Tab {
    BrowserPermissions.Scope permissionScope;
    GeckoSession session;
    boolean privateMode, canBack, textOnly, addressPending;
    MediaSession media;
    VisitHistory.Scope historyScope;
    String url = "", title = "New tab", contextId;
  }

  int dp(int value) {
    return (int) (value * getResources().getDisplayMetrics().density + .5f);
  }

  Button button(String label, Runnable click) {
    Button b = new Button(this);
    b.setText(label);
    b.setAllCaps(false);
    b.setTextSize(12);
    b.setTextColor(Color.WHITE);
    b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xff243846));
    b.setOnClickListener(v -> click.run());
    return b;
  }

  void toast(String text) {
    Toast.makeText(this, text, Toast.LENGTH_LONG).show();
  }

  @Override
  public void onCreate(Bundle saved) {
    setTheme(BrowserAppearance.theme(this));
    super.onCreate(saved);
    permissions = new BrowserPermissions(this);
    permissions.reloadNormal=()->{
      if(runtime!=null)runtime.getStorageController().clearData(StorageController.ClearFlags.PERMISSIONS).accept(unused->{for(Tab tab:new ArrayList<>(tabs))if(!tab.privateMode)tab.session.reload();});
    };
    palette = BrowserAppearance.palette(this);
    getWindow()
        .setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
    root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setTag("chrome-root");
    root.setBackgroundColor(0xff101820);
    root.setOnApplyWindowInsetsListener(
        (v, insets) -> {
          if (Build.VERSION.SDK_INT >= 30) {
            android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars());
            v.setPadding(i.left, i.top, i.right, i.bottom);
          } else
            v.setPadding(
                insets.getSystemWindowInsetLeft(),
                insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(),
                insets.getSystemWindowInsetBottom());
          return insets;
        });
    mode = new TextView(this);
    mode.setTextColor(0xffd8bcff);
    mode.setPadding(dp(12), dp(8), dp(12), dp(6));
    root.addView(mode);
    toolbar = new LinearLayout(this);
    toolbar.setGravity(Gravity.CENTER_VERTICAL);
    toolbar.setPadding(dp(12), dp(4), dp(12), dp(8));
    address = new EditText(this);
    address.setSingleLine(true);
    address.setSaveEnabled(false);
    address.setTag("chrome-input");
    address.setPadding(dp(12), 0, dp(12), 0);
    address.setTextColor(Color.WHITE);
    address.setTextSize(14);
    address.setHintTextColor(0xffa4afb8);
    address.setHint("Search or HTTPS address");
    address.setInputType(
        android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
    address.setImeOptions(EditorInfo.IME_ACTION_GO | EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING);
    address.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
    address.setOnEditorActionListener(
        (v, id, event) -> {
          navigate(address.getText().toString());
          return true;
        });
    toolbar.addView(address, new LinearLayout.LayoutParams(0, dp(50), 1));
    toolbar.addView(button("Go", () -> navigate(address.getText().toString())));
    root.addView(toolbar);
    status = new TextView(this);
    status.setTag("chrome-muted");
    status.setTextColor(0xff98b0bd);
    status.setPadding(dp(12), 0, dp(12), dp(4));
    root.addView(status);
    view = new GeckoView(this);
    view.setOnFocusChangeListener((v,focused)->{if(focused && current!=null && current.addressPending)view.post(()->{if(current!=null && current.addressPending)restoreNewTabFocus(current);});});
    view.setOnTouchListener((v,event)->{if(event.getActionMasked()==MotionEvent.ACTION_DOWN && current!=null)current.addressPending=false;return false;});
    view.setSaveEnabled(false);
    view.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
    root.addView(view, new LinearLayout.LayoutParams(-1, 0, 1));
    navigation = new LinearLayout(this);
    navigation.setGravity(Gravity.CENTER);
    navigation.setTag("chrome-nav");
    navigation.setPadding(dp(8), dp(4), dp(8), dp(4));
    navigation.addView(
        button("Back", this::handleBack), new LinearLayout.LayoutParams(0, dp(50), 1));
    navigation.addView(
        button(
            "Reload",
            () -> {
              if (current != null) current.session.reload(GeckoSession.LOAD_FLAGS_BYPASS_CACHE);
            }),
        new LinearLayout.LayoutParams(0, dp(50), 1));
    navigation.addView(button("Tabs", this::tabList), new LinearLayout.LayoutParams(0, dp(50), 1));
    navigation.addView(button("Menu", this::menu), new LinearLayout.LayoutParams(0, dp(50), 1));
    root.addView(navigation);
    setContentView(root);
    applyAppearance();
    if (Build.VERSION.SDK_INT >= 33)
      getOnBackInvokedDispatcher()
          .registerOnBackInvokedCallback(
              android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
    if (runtime == null)
      runtime =
          GeckoRuntime.create(
              getApplicationContext(),
              new GeckoRuntimeSettings.Builder()
                  .remoteDebuggingEnabled(false)
                  .allowInsecureConnections(GeckoRuntimeSettings.HTTPS_ONLY)
                  .contentBlocking(
                      new ContentBlocking.Settings.Builder()
                          .antiTracking(ContentBlocking.AntiTracking.DEFAULT)
                          .safeBrowsing(ContentBlocking.SafeBrowsing.DEFAULT)
                          .build())
                  .build());
    history = new VisitHistory(new HistoryRepository(getSharedPreferences("aegis", MODE_PRIVATE)));
    configureAddons();
    // Finish installation before opening any page, including the first private page.
    runtime.getWebExtensionController().ensureBuiltIn("resource://android/assets/sukoaa-policy/","page-policy@sukoaa.local")
      .accept(extension->runOnUiThread(()->{
        if(isFinishing() || isDestroyed())return;
        runtime.getWebExtensionController().setAllowedInPrivateBrowsing(extension,true)
          .accept(allowed->runOnUiThread(()->finishPolicy(true)),error->runOnUiThread(()->finishPolicy(false)));
      }),error->runOnUiThread(()->finishPolicy(false)));
    boolean priv = getIntent().getBooleanExtra("private", true);
    String initial = getIntent().getStringExtra("url");
    runtime.getStorageController().clearData(StorageController.ClearFlags.PERMISSIONS).accept(
        unused->{if(!isFinishing()&&!isDestroyed())newTab(priv,initial);},
        error->toast("Could not initialize site permissions. Restart the browser."));
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    newTab(intent.getBooleanExtra("private", true), intent.getStringExtra("url"));
  }

  Tab newTab(boolean priv, String initial) {
    return newTab(priv, initial, false, null);
  }

  Tab newTab(boolean priv, String initial, boolean popup, String parentContext) {
    if(!policyReady){pendingTabs.add(()->newTab(priv,initial,popup,parentContext));return null;}
    if (tabs.size() >= 20) {
      toast("Close a tab first (20 tab limit)");
      return null;
    }
    Tab t = new Tab();
    t.privateMode = priv;
    t.addressPending=initial==null;
    t.historyScope = new VisitHistory.Scope(priv);
    GeckoSessionSettings.Builder settings =
        new GeckoSessionSettings.Builder().usePrivateMode(priv).useTrackingProtection(true).suspendMediaWhenInactive(false);
    if (priv) {
      t.contextId = parentContext != null ? parentContext : "aegis-private-" + UUID.randomUUID();
      settings.contextId(t.contextId);
    }
    t.session = new GeckoSession(settings.build());
    t.session.setMediaSessionDelegate(new MediaSession.Delegate() {
      @Override public void onActivated(GeckoSession session,MediaSession media) {t.media=media;if(!foreground){media.muteAudio(true);media.pause();}}
      @Override public void onPlay(GeckoSession session,MediaSession media) {
        t.media=media;
        if(!foreground){media.muteAudio(true);media.pause();}
      }
    });
    t.session.setPermissionDelegate(
        new GeckoSession.PermissionDelegate() {
          @Override public void onAndroidPermissionsRequest(GeckoSession s,String[] names,Callback cb) {
            if(names==null){cb.reject();return;}
            List<String> kinds=new ArrayList<>();
            for(String name:names){
              String kind=name.equals(android.Manifest.permission.CAMERA)?"camera":name.equals(android.Manifest.permission.RECORD_AUDIO)?"microphone":(name.equals(android.Manifest.permission.ACCESS_COARSE_LOCATION)||name.equals(android.Manifest.permission.ACCESS_FINE_LOCATION))?"location":null;
              if(kind==null){cb.reject();return;}if(!kinds.contains(kind))kinds.add(kind);
            }
            permissions.ask(permissionScope(t),t.url,kinds,allow->{if(allow)cb.grant();else cb.reject();});
          }
          @Override public void onMediaPermissionRequest(GeckoSession s,String uri,MediaSource[] video,MediaSource[] audio,MediaCallback cb) {
            // Screen/system capture is outside this camera/microphone permission flow.
            MediaSource camera=null,mic=null;
            if(video!=null)for(MediaSource source:video)if(source.source==MediaSource.SOURCE_CAMERA){camera=source;break;}
            if(audio!=null)for(MediaSource source:audio)if(source.source==MediaSource.SOURCE_MICROPHONE){mic=source;break;}
            if((video!=null&&camera==null)||(audio!=null&&mic==null)){cb.reject();return;}
            final MediaSource v=camera,a=mic;List<String> kinds=new ArrayList<>();if(video!=null)kinds.add("camera");if(audio!=null)kinds.add("microphone");
            permissions.ask(permissionScope(t),uri,kinds,allow->{if(allow)cb.grant(v,a);else cb.reject();});
          }

          @Override
          public GeckoResult<Integer> onContentPermissionRequest(
              GeckoSession s, ContentPermission p) {
            GeckoResult<Integer> result=new GeckoResult<>();
            if(p.permission!=PERMISSION_GEOLOCATION || (p.thirdPartyOrigin!=null && !p.thirdPartyOrigin.isEmpty())){return GeckoResult.fromValue(ContentPermission.VALUE_DENY);}
            permissions.ask(permissionScope(t),p.uri,Collections.singletonList("location"),allow->result.complete(allow?ContentPermission.VALUE_ALLOW:ContentPermission.VALUE_DENY));
            return result;
          }
        });
    t.session.setPromptDelegate(
        new GeckoSession.PromptDelegate() {
          @Override
          public GeckoResult<PromptResponse> onPopupPrompt(
              GeckoSession session, PopupPrompt prompt) {
            String target =
                prompt.targetUri == null || prompt.targetUri.isEmpty()
                    ? "about:blank"
                    : prompt.targetUri;
            if (t != current
                || popupDecision != null
                || !BrowserPolicy.allowed(target, !t.privateMode)
                || tabs.size() >= 20
                || isFinishing()
                || isDestroyed()) return GeckoResult.fromValue(prompt.dismiss());
            GeckoResult<PromptResponse> result = new GeckoResult<>();
            PopupDecision decision =
                new PopupDecision(
                    allow ->
                        result.complete(
                            prompt.confirm(
                                allow && t == current && !isFinishing() && !isDestroyed()
                                    ? AllowOrDeny.ALLOW
                                    : AllowOrDeny.DENY)));
            popupDecision = decision;
            String destination =
                "about:blank".equals(target)
                    ? "The page will supply the destination after opening."
                    : target;
            popupDialog =
                new AlertDialog.Builder(AdvancedBrowserActivity.this)
                    .setTitle("Open link?")
                    .setMessage(
                        "This page asked to open another tab. If you tapped a story, choose"
                            + " Open.\n\n"
                            + destination)
                    .setPositiveButton("Open", (d, which) -> decision.resolve(true))
                    .setNegativeButton("Block", (d, which) -> decision.resolve(false))
                    .create();
            popupDialog.setOnDismissListener(
                d -> {
                  decision.resolve(false);
                  if (popupDecision == decision) {
                    popupDecision = null;
                    popupDialog = null;
                  }
                });
            prompt.setDelegate(
                new PromptInstanceDelegate() {
                  @Override
                  public void onPromptDismiss(BasePrompt ignored) {
                    decision.resolve(false);
                    if (popupDecision == decision && popupDialog != null) popupDialog.dismiss();
                  }
                });
            popupDialog.show();
            return result;
          }
        });
    t.session.setNavigationDelegate(
        new GeckoSession.NavigationDelegate() {
          @Override
          public GeckoResult<AllowOrDeny> onLoadRequest(GeckoSession s, LoadRequest r) {
            String uri =
                r.target == TARGET_WINDOW_NEW && (r.uri == null || r.uri.isEmpty())
                    ? "about:blank"
                    : r.uri;
            boolean safe = BrowserPolicy.allowed(uri, !t.privateMode);
            if (!safe && t == current) status.setText("Only HTTPS pages are supported.");
            // Gecko's popup blocker invokes onPopupPrompt for script-created
            // windows. Keep that native decision rather than rejecting the link
            // a second time because a direct tap flag was lost.
            if (r.target == TARGET_WINDOW_NEW
                && (t != current || tabs.size() >= 20 || isFinishing() || isDestroyed()))
              return GeckoResult.fromValue(AllowOrDeny.DENY);
            return GeckoResult.fromValue(safe ? AllowOrDeny.ALLOW : AllowOrDeny.DENY);
          }

          @Override
          public GeckoResult<GeckoSession> onNewSession(GeckoSession opener, String uri) {
            String requested = uri == null || uri.isEmpty() ? "about:blank" : uri;
            if (t != current
                || !BrowserPolicy.allowed(requested, !t.privateMode)
                || isFinishing()
                || isDestroyed()) return null;
            // Gecko must receive an UNOPENED session; it opens it and loads the
            // requested window itself, preserving script/open-window semantics.
            Tab child = newTab(t.privateMode, null, true, t.contextId);
            if (child == null) return null;
            view.post(
                () -> {
                  if (tabs.contains(child)
                      && child.session.isOpen()
                      && !isFinishing()
                      && !isDestroyed()) select(child);
                });
            return GeckoResult.fromValue(child.session);
          }

          @Override
          public void onLocationChange(
              GeckoSession s,
              String url,
              List<GeckoSession.PermissionDelegate.ContentPermission> p,
              Boolean gesture) {
            if (!tabs.contains(t)) return;
            if(!"about:blank".equals(url))t.addressPending=false;
            permissions.cancel();if(t.permissionScope!=null)t.permissionScope.revision++;
            for(GeckoSession.PermissionDelegate.ContentPermission permission:p)
              if(permission.permission==GeckoSession.PermissionDelegate.PERMISSION_GEOLOCATION)
                runtime.getStorageController().setPermission(permission,GeckoSession.PermissionDelegate.ContentPermission.VALUE_PROMPT);
            t.url = url == null ? "" : url;
            if (t == current) update();
          }

          @Override
          public void onCanGoBack(GeckoSession s, boolean back) {
            t.canBack = back;
          }
        });
    t.session.setProgressDelegate(
        new GeckoSession.ProgressDelegate() {
          @Override
          public void onPageStart(GeckoSession s, String uri) {
            permissions.cancel();if(t.permissionScope!=null)t.permissionScope.revision++;
            if (t == current) status.setText("Loading…");
          }

          @Override
          public void onPageStop(GeckoSession s, boolean success) {
            if (!tabs.contains(t) || isFinishing() || isDestroyed()) return;
            if (success) history.record(t.historyScope, t.url, t.title);
            if(t==current && t.addressPending)restoreNewTabFocus(t);
            if (t == current)
              status.setText(
                  success
                      ? "Tracking protection on · Reload bypasses HTTP cache"
                      : "Page could not load");
          }
        });
    t.session.setContentDelegate(
        new GeckoSession.ContentDelegate() {
          @Override
          public void onTitleChange(GeckoSession s, String title) {
            t.title = title == null ? "Page" : title;
          }

          @Override
          public void onFullScreen(GeckoSession s, boolean enabled) {
            if (t == current) setFullScreen(enabled);
          }

          @Override
          public void onCloseRequest(GeckoSession s) {
            closeTab(t);
          }
        });
    tabs.add(t);
    if (!popup) {
      t.session.open(runtime);
      select(t);
      if (initial != null && initial.startsWith("https://")) load(t, initial);
      else t.session.loadUri("about:blank");
      if(initial==null) {
        address.setText("");restoreNewTabFocus(t);
      }
    }
    return t;
  }

  void finishPolicy(boolean success) {
    if(isFinishing() || isDestroyed())return;
    if(!success)toast("Early YouTube filtering could not initialize. Ads may appear.");
    policyReady=true;
    List<Runnable> waiting=new ArrayList<>(pendingTabs);pendingTabs.clear();
    for(Runnable action:waiting)action.run();
  }

  void pauseMedia(Tab tab) {
    if(tab.media!=null){tab.media.muteAudio(true);tab.media.pause();}
  }

  void restoreNewTabFocus(Tab tab) {
    if(current!=tab)return;
    address.requestFocus();
    address.postDelayed(()->{if(current==tab&&address.hasFocus()&&!isFinishing())
      ((android.view.inputmethod.InputMethodManager)getSystemService(INPUT_METHOD_SERVICE))
        .showSoftInput(address,android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT);},100);
  }

  void select(Tab t) {
    if (t == null || !tabs.contains(t) || !t.session.isOpen() || isFinishing() || isDestroyed())
      return;
    if(current!=t)permissions.cancel();
    setFullScreen(false);
    if (current != null) current.session.setActive(false);
    if (view.getSession() != null) view.releaseSession();
    current = t;
    view.setSession(t.session);
    t.session.setActive(foreground);
    if(t.media!=null)t.media.muteAudio(!foreground);
    runtime.getWebExtensionController().setTabActive(t.session, true);
    update();
    if(t.addressPending)restoreNewTabFocus(t);
  }

  void update() {
    if (current == null) return;
    mode.setText(
        current.privateMode
            ? "Private · no history or saved tabs"
            : "Sukoaa · Add-ons");
    mode.setTag(current.privateMode ? "chrome-private" : "chrome-accent");
    mode.setTextColor(current.privateMode ? palette.privateAccent : palette.accent);
    if (!address.hasFocus()) address.setText("about:blank".equals(current.url) ? "" : current.url);
  }

  void load(Tab t, String url) {
    t.addressPending=false;
    t.session.load(
        new GeckoSession.Loader()
            .uri(url)
            .flags(
                t.privateMode
                    ? GeckoSession.LOAD_FLAGS_BYPASS_CACHE
                    : GeckoSession.LOAD_FLAGS_NONE));
  }

  void navigate(String value) {
    if (current == null) return;
    String input = value.trim(), url = input;
    try {
      if (!input.contains("://"))
        url =
            input.contains(".") && !input.contains(" ")
                ? "https://" + input
                : "https://www.google.com/search?q=" + URLEncoder.encode(input, "UTF-8");
      Uri uri = Uri.parse(url);
      if (!"https".equalsIgnoreCase(uri.getScheme())
          || uri.getHost() == null
          || uri.getUserInfo() != null) {
        toast("Enter a valid HTTPS website or search");
        return;
      }
      address.clearFocus();
      ((android.view.inputmethod.InputMethodManager) getSystemService(INPUT_METHOD_SERVICE))
          .hideSoftInputFromWindow(address.getWindowToken(), 0);
      load(current, url);
    } catch (Exception e) {
      toast("Invalid address");
    }
  }

  void closeTab(Tab t) {
    if (t == null || !tabs.contains(t)) return;
    permissions.cancel();
    if(t.permissionScope!=null){t.permissionScope.revision++;t.permissionScope.temporary.clear();}
    t.historyScope.close();
    boolean selected = t == current;
    int index = tabs.indexOf(t);
    if (selected) {
      setFullScreen(false);
      if (view.getSession() != null) view.releaseSession();
      current = null;
    }
    tabs.remove(t);
    t.session.setNavigationDelegate(null);
    t.session.setProgressDelegate(null);
    t.session.setContentDelegate(null);
    t.session.close();
    t.url = "";
    t.title = "";
    if (t.contextId != null
        && tabs.stream().noneMatch(other -> t.contextId.equals(other.contextId)))
      runtime.getStorageController().clearDataForSessionContext(t.contextId);
    if (tabs.isEmpty()) {
      current = null;
      address.setText("");
      finish();
      return;
    }
    if (selected) select(tabs.get(Math.min(index, tabs.size() - 1)));
  }

  void tabActions(Tab tab) {
    if(!tabs.contains(tab))return;
    new AlertDialog.Builder(this).setTitle(tab.title)
      .setItems(new String[]{"New tab","New private tab","Duplicate tab","Close tab"},(dialog,index)->{
        if(!tabs.contains(tab))return;
        if(index==0)newTab(false,null);
        if(index==1)newTab(true,null);
        if(index==2)newTab(tab.privateMode,tab.url.isEmpty()||"about:blank".equals(tab.url)?null:tab.url);
        if(index==3)closeTab(tab);
      }).setNegativeButton("Cancel",null).show();
  }

  void tabList() {
    List<BrowserListDialog.Row> rows = new ArrayList<>();
    for (Tab tab : new ArrayList<>(tabs))
      rows.add(
          new BrowserListDialog.Row(
              (tab == current ? "● " : "") + tab.title,
              (tab.privateMode ? "Private · " : "Regular · ") + tab.url,
              () -> select(tab),
              () -> closeTab(tab),null,() -> tabActions(tab)));
    BrowserListDialog.show(
        this,
        "Tabs · " + tabs.size(),
        rows,
        "Close tab",
        "New private tab",
        () -> newTab(true, null),
        this::tabList);
  }

  void reloadPermissions(Tab owner) {
    runtime.getStorageController().clearData(StorageController.ClearFlags.PERMISSIONS).accept(unused->{if(tabs.contains(owner))owner.session.reload();});
  }
  BrowserPermissions.Scope permissionScope(Tab t) {
    if(t.permissionScope==null)t.permissionScope=new BrowserPermissions.Scope(t.privateMode,()->t.url,()->current==t && tabs.contains(t) && !isFinishing() && !isDestroyed());
    return t.permissionScope;
  }
  @Override public void onRequestPermissionsResult(int code,String[] names,int[] results) {
    super.onRequestPermissionsResult(code,names,results);permissions.onResult(code);
  }
  void menu() {
    String[] choices = {
      "New private tab",
      "New regular add-on tab",
      "Clean test this page",
      "Install signed Firefox add-on (.xpi)",
      "Manage add-ons",
      current.textOnly ? "Enable page JavaScript" : "Text mode: disable page JavaScript",
      "Close all private tabs",
      "About private browsing & add-ons",
      "Clear Gecko cookies & cache",
      "Appearance · theme, style & colours",
      "Privacy & open-source licenses",
      "Site permissions · camera, microphone, location",
      "Fix this page"
    };
    new AlertDialog.Builder(this)
        .setTitle("Advanced browser")
        .setNeutralButton(
            "Appearance", (dialog, which) -> BrowserAppearance.show(this, this::applyAppearance))
        .setItems(
            choices,
            (d, i) -> {
              if(i==12) {Tab owner=current;new AlertDialog.Builder(this).setTitle("Fix this private page")
                .setMessage("Try reloading without cache for a loading problem, or review camera, microphone and location permissions. Tap inside the page before using Copy. For a popup prompt, choose Open only for a link you intended. This view keeps tracking protection enabled.")
                .setPositiveButton("Reload without cache",(x,w)->owner.session.reload(GeckoSession.LOAD_FLAGS_BYPASS_CACHE))
                .setNeutralButton("Site permissions",(x,w)->permissions.settings(permissionScope(owner),()->reloadPermissions(owner)))
                .setNegativeButton("Close",null).show();}
              if (i == 11) {Tab owner=current;permissions.settings(permissionScope(owner),()->reloadPermissions(owner));}
              if (i == 10) BrowserLegal.show(this);
              if (i == 9) BrowserAppearance.show(this, this::applyAppearance);
              if (i == 0) newTab(true, null);
              if (i == 1) newTab(false, null);
              if (i == 2) newTab(true, current.url);
              if (i == 3) {
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.setType("*/*");
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                startActivityForResult(picker, 70);
              }
              if (i == 4) manageAddons();
              if (i == 5) {
                current.textOnly = !current.textOnly;
                current.session.getSettings().setAllowJavascript(!current.textOnly);
                current.session.reload(GeckoSession.LOAD_FLAGS_BYPASS_CACHE);
                toast(
                    current.textOnly
                        ? "Page JavaScript disabled; some sites will not work"
                        : "Page JavaScript enabled");
              }
              if (i == 6) {
                for (Tab t : new ArrayList<>(tabs)) if (t.privateMode) closeTab(t);
              }
              if (i == 8)
                new AlertDialog.Builder(this)
                    .setTitle("Clear Gecko site data?")
                    .setMessage(
                        "Signs you out of regular Gecko pages, clears cookies/cache/site storage"
                            + " and reloads open Gecko tabs. Add-on site data may reset. The"
                            + " regular WebView browser has separate clearing controls.")
                    .setNegativeButton("Cancel", null)
                    .setPositiveButton(
                        "Clear",
                        (x, y) ->
                            runtime
                                .getStorageController()
                                .clearData(
                                    StorageController.ClearFlags.COOKIES
                                        | StorageController.ClearFlags.ALL_CACHES
                                        | StorageController.ClearFlags.DOM_STORAGES)
                                .accept(
                                    v -> {
                                      for (Tab t : tabs)
                                        t.session.reload(GeckoSession.LOAD_FLAGS_BYPASS_CACHE);
                                      toast("Gecko site data cleared");
                                    },
                                    error -> toast("Could not clear Gecko site data")))
                    .show();
              if (i == 7)
                new AlertDialog.Builder(this)
                    .setTitle("Private tabs and add-ons")
                    .setMessage(
                        "Private tabs use GeckoView's private mode and are not written to browser"
                            + " history or restored. Close all private tabs when finished. Private"
                            + " browsing does not hide your IP from websites or your network."
                            + " Reload bypasses HTTP cache; site JavaScript can still use temporary"
                            + " storage.\n\n"
                            + "Add-ons must be signed Firefox-compatible .xpi packages. Chrome Web"
                            + " Store/CRX packages are unsupported. Add-ons are disabled in private"
                            + " tabs and run only in regular Gecko tabs, not the WebView browser."
                            + " Some Firefox APIs and add-on interfaces may be unsupported.\n\n"
                            + "This preview has not been tested on a physical phone. The original"
                            + " WebView browser remains available using Android Back or the app"
                            + " launcher.")
                    .setPositiveButton("OK", null)
                    .show();
            })
        .setNegativeButton("Done", null)
        .show();
  }

  void answerInstall(GeckoResult<WebExtension.PermissionPromptResponse> result, boolean allow) {
    if (pendingPrompt != result) return;
    pendingPrompt = null;
    result.complete(new WebExtension.PermissionPromptResponse(allow, false, false));
  }

  void configureAddons() {
    runtime
        .getWebExtensionController()
        .setPromptDelegate(
            new WebExtensionController.PromptDelegate() {
              @Override
              public GeckoResult<WebExtension.PermissionPromptResponse> onInstallPromptRequest(
                  WebExtension extension,
                  String[] permissions,
                  String[] origins,
                  String[] dataPermissions) {
                GeckoResult<WebExtension.PermissionPromptResponse> result = new GeckoResult<>();
                runOnUiThread(
                    () -> {
                      if (pendingPrompt != null) answerInstall(pendingPrompt, false);
                      pendingPrompt = result;
                      if (isFinishing() || isDestroyed()) {
                        answerInstall(result, false);
                        return;
                      }
                      new AlertDialog.Builder(AdvancedBrowserActivity.this)
                          .setTitle("Add " + name(extension) + "?")
                          .setMessage(
                              "Requested permissions: "
                                  + Arrays.toString(permissions)
                                  + "\nSites: "
                                  + Arrays.toString(origins)
                                  + "\nData access: "
                                  + Arrays.toString(dataPermissions)
                                  + "\n\n"
                                  + "Install only add-ons you trust. Access to private tabs and"
                                  + " optional technical/interaction data is not granted.")
                          .setNegativeButton("Cancel", (d, i) -> answerInstall(result, false))
                          .setPositiveButton("Install", (d, i) -> answerInstall(result, true))
                          .setOnCancelListener(d -> answerInstall(result, false))
                          .show();
                    });
                return result;
              }
            });
    runtime
        .getWebExtensionController()
        .list()
        .accept(
            list -> {
              for (WebExtension extension : list) prepareAddon(extension);
            },
            error -> toast("Could not load add-on list"));
  }

  String name(WebExtension extension) {
    return extension.metaData != null && extension.metaData.name != null
        ? extension.metaData.name
        : extension.id;
  }

  void prepareAddon(WebExtension extension) {
    if("page-policy@sukoaa.local".equals(extension.id))return;
    if (isFinishing() || isDestroyed()) return;
    ownedAddons.put(extension.id, extension);
    runtime.getWebExtensionController().setAllowedInPrivateBrowsing(extension, false);
    extension.setActionDelegate(
        new WebExtension.ActionDelegate() {
          @Override
          public void onBrowserAction(WebExtension e, GeckoSession s, WebExtension.Action action) {
            actions.put(e.id, action);
          }

          @Override
          public GeckoResult<GeckoSession> onTogglePopup(
              WebExtension e, WebExtension.Action action) {
            if (isFinishing() || isDestroyed() || current == null || current.privateMode) {
              toast("Open a regular add-on tab first");
              return null;
            }
            GeckoSession popup = new GeckoSession();
            popup.open(runtime);
            GeckoView popupView = new GeckoView(AdvancedBrowserActivity.this);
            popupView.setSession(popup);
            AlertDialog dialog =
                new AlertDialog.Builder(AdvancedBrowserActivity.this)
                    .setTitle(name(e))
                    .setView(popupView)
                    .setNegativeButton("Close", null)
                    .create();
            dialog.setOnDismissListener(
                d -> {
                  popupView.releaseSession();
                  popup.close();
                });
            dialog.show();
            dialog.getWindow().setLayout(-1, dp(480));
            return GeckoResult.fromValue(popup);
          }
        });
  }

  void manageAddons() {
    runtime
        .getWebExtensionController()
        .list()
        .accept(
            allExtensions -> {
              final List<WebExtension> list=new ArrayList<>();
              for(WebExtension e:allExtensions)if(!"page-policy@sukoaa.local".equals(e.id))list.add(e);
              if (list.isEmpty()) {
                toast("No add-ons installed. Choose a Mozilla-signed .xpi file to add one.");
                return;
              }
              String[] labels = new String[list.size()];
              for (int i = 0; i < labels.length; i++) labels[i] = name(list.get(i));
              new AlertDialog.Builder(this)
                  .setTitle("Installed add-ons")
                  .setItems(
                      labels,
                      (d, i) -> {
                        WebExtension e = list.get(i);
                        String[] options = {"Open action", "Enable", "Disable", "Remove"};
                        new AlertDialog.Builder(this)
                            .setTitle(name(e))
                            .setItems(
                                options,
                                (dd, which) -> {
                                  WebExtensionController c = runtime.getWebExtensionController();
                                  if (which == 0) {
                                    if (current.privateMode) {
                                      toast("Add-ons are unavailable in private tabs");
                                      return;
                                    }
                                    WebExtension.Action action = actions.get(e.id);
                                    if (action != null) action.click();
                                    else
                                      toast(
                                          "No supported action; content scripts run on matching"
                                              + " regular pages");
                                  }
                                  if (which == 1)
                                    c.enable(e, WebExtensionController.EnableSource.USER)
                                        .accept(
                                            this::prepareAddon,
                                            error -> toast("Could not enable add-on"));
                                  if (which == 2)
                                    c.disable(e, WebExtensionController.EnableSource.USER)
                                        .accept(
                                            v -> toast("Disabled; reload regular pages"),
                                            error -> toast("Could not disable add-on"));
                                  if (which == 3)
                                    new AlertDialog.Builder(this)
                                        .setTitle("Remove " + name(e) + "?")
                                        .setNegativeButton("Cancel", null)
                                        .setPositiveButton(
                                            "Remove",
                                            (x, y) ->
                                                c.uninstall(e)
                                                    .accept(
                                                        v -> toast("Removed; reload regular pages"),
                                                        error -> toast("Could not remove add-on")))
                                        .show();
                                })
                            .setNegativeButton("Done", null)
                            .show();
                      })
                  .setNegativeButton("Done", null)
                  .show();
            },
            error -> toast("Could not load add-ons"));
  }

  @Override
  protected void onActivityResult(int request, int result, Intent data) {
    super.onActivityResult(request, result, data);
    if (request != 70 || result != RESULT_OK || data == null || data.getData() == null) return;
    Uri source = data.getData();
    status.setText("Reading add-on package…");
    worker.execute(
        () -> {
          File file = new File(getCacheDir(), "addon-" + UUID.randomUUID() + ".xpi");
          try (InputStream in = getContentResolver().openInputStream(source);
              OutputStream out = new FileOutputStream(file)) {
            if (in == null) throw new IOException();
            byte[] buffer = new byte[32768];
            long total = 0;
            int count;
            while ((count = in.read(buffer)) != -1) {
              total += count;
              if (total > 50L * 1024 * 1024) throw new IOException("Package too large");
              out.write(buffer, 0, count);
            }
          } catch (Exception e) {
            file.delete();
            runOnUiThread(() -> toast("Could not read package (50 MB limit)"));
            return;
          }
          runOnUiThread(
              () -> {
                if (isFinishing() || isDestroyed()) {
                  file.delete();
                  return;
                }
                runtime
                    .getWebExtensionController()
                    .install(file.toURI().toString())
                    .accept(
                        e -> {
                          file.delete();
                          prepareAddon(e);
                          toast("Installed " + name(e) + ". Open a regular add-on tab to use it.");
                        },
                        error -> {
                          file.delete();
                          toast(
                              "Install failed: use a Mozilla-signed Firefox-compatible .xpi. Chrome"
                                  + " CRX/ZIP packages are unsupported.");
                        });
              });
        });
  }

  void setFullScreen(boolean value) {
    fullScreen = value;
    mode.setVisibility(value ? View.GONE : View.VISIBLE);
    toolbar.setVisibility(value ? View.GONE : View.VISIBLE);
    status.setVisibility(value ? View.GONE : View.VISIBLE);
    navigation.setVisibility(value ? View.GONE : View.VISIBLE);
    if (Build.VERSION.SDK_INT >= 30 && getWindow().getInsetsController() != null) {
      if (value) {
        getWindow().getInsetsController().hide(WindowInsets.Type.systemBars());
        getWindow()
            .getInsetsController()
            .setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
      } else getWindow().getInsetsController().show(WindowInsets.Type.systemBars());
    } else
      getWindow()
          .getDecorView()
          .setSystemUiVisibility(
              value
                  ? View.SYSTEM_UI_FLAG_FULLSCREEN
                      | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                      | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                  : View.SYSTEM_UI_FLAG_VISIBLE);
    if (!value && palette != null) BrowserAppearance.window(this, palette);
  }

  void handleBack() {
    if (fullScreen) {
      current.session.exitFullScreen();
      return;
    }
    if (current != null && current.canBack) current.session.goBack();
    else if (current != null) closeTab(current);
    else finish();
  }

  // Android 13+ uses OnBackInvokedDispatcher; this fallback supports API 29–32.
  @android.annotation.SuppressLint("GestureBackNavigation")
  @Override
  public void onBackPressed() {
    handleBack();
  }

  @Override
  public void onWindowFocusChanged(boolean focus) {
    super.onWindowFocusChanged(focus);
    if (focus && fullScreen) setFullScreen(true);
  }

  void applyAppearance() {
    palette = BrowserAppearance.palette(this);
    appearanceKey = BrowserAppearance.key(palette);
    BrowserAppearance.window(this, palette);
    BrowserAppearance.apply(root, palette);
    if (current != null) update();
  }

  @Override
  public void onConfigurationChanged(android.content.res.Configuration configuration) {
    super.onConfigurationChanged(configuration);
    applyAppearance();
  }

  @Override
  protected void onPause() {
    foreground=false;
    for(Tab t:tabs){pauseMedia(t);t.session.setActive(false);}
    super.onPause();
  }

  @Override
  protected void onResume() {
    super.onResume();
    foreground=true;
    if (root != null
        && !appearanceKey.equals(BrowserAppearance.key(BrowserAppearance.palette(this))))
      applyAppearance();
    if (current != null) {current.session.setActive(true);if(current.media!=null)current.media.muteAudio(false);}
  }

  @Override
  protected void onDestroy() {
    if (popupDecision != null) popupDecision.resolve(false);
    if (popupDialog != null) popupDialog.dismiss();
    if (pendingPrompt != null) answerInstall(pendingPrompt, false);
    if (runtime != null) runtime.getWebExtensionController().setPromptDelegate(null);
    for (WebExtension extension : ownedAddons.values()) extension.setActionDelegate(null);
    ownedAddons.clear();
    if (view != null && view.getSession() != null) view.releaseSession();
    List<Tab> closing = new ArrayList<>(tabs);
    tabs.clear();
    current = null;
    address.setText("");
    for (Tab t : closing) {
      permissions.cancel();
      if(t.permissionScope!=null){t.permissionScope.revision++;t.permissionScope.temporary.clear();}
      t.historyScope.close();
      t.session.setNavigationDelegate(null);
      t.session.setProgressDelegate(null);
      t.session.setContentDelegate(null);
      t.session.close();
      if (t.contextId != null)
        runtime.getStorageController().clearDataForSessionContext(t.contextId);
    }
    worker.shutdownNow();
    if(permissions!=null)permissions.destroy();
    super.onDestroy();
  }
}
