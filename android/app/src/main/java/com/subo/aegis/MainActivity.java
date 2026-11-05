// SPDX-License-Identifier: GPL-3.0-or-later
package com.subo.aegis;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.net.*;
import android.net.http.SslError;
import android.os.*;
import android.view.*;
import android.view.inputmethod.*;
import android.webkit.*;
import android.widget.*;
import java.io.*;
import java.net.URI;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.*;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.ScriptHandler;

public class MainActivity extends Activity {
  BrowserPermissions permissions;

  int BG = Color.rgb(11, 16, 26),
      CARD = Color.rgb(23, 34, 51),
      FG = Color.rgb(231, 240, 252),
      MINT = Color.rgb(128, 232, 200);
  LinearLayout root, bar;
  FrameLayout frame;
  EditText address;
  TextView status;
  Button tabsButton, shieldButton;
  ImageButton backButton, forwardButton, reloadButton;
  ProgressBar progress;
  final List<Tab> tabs = new ArrayList<>();
  Tab current;
  VisitHistory history;
  android.content.SharedPreferences prefs;
  volatile FilterRules rules = new FilterRules(Collections.emptyList());
  volatile Set<String> exceptions = Collections.emptySet();
  View videoView;
  FrameLayout videoContainer;
  int previousSystemUi;
  boolean previousKeepScreenOn, developerInspection = false;
  WebChromeClient.CustomViewCallback videoCallback;
  boolean focus = false, desktop = false;
  ValueCallback<Uri[]> upload;
  AlertDialog popupDialog;
  PopupDecision popupDecision;
  ThemePalette palette;
  String appearanceKey = "";
  final ExecutorService worker = Executors.newSingleThreadExecutor();

  static class Tab {
    BrowserPermissions.Scope permissionScope;
    WebView web;
    boolean addressPending;
    ScriptHandler youtubeScript;
    final VisitHistory.Scope historyScope = new VisitHistory.Scope(false);
    volatile String url = "";
    String title = "New tab";
    android.graphics.Bitmap icon;
    volatile long repairUntil;
    volatile String repairSite="";
    String lastProblem="";
    Runnable repairExpiry;
    AtomicInteger blocked = new AtomicInteger();
  }

  int dp(int n) {
    return (int) (n * getResources().getDisplayMetrics().density + .5f);
  }

  Button button(String text, Runnable action) {
    Button b = new Button(this);
    b.setText(text);
    b.setTextColor(FG);
    b.setTextSize(12);
    b.setAllCaps(false);
    b.setTypeface(
        android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL));
    b.setMinWidth(0);
    b.setMinimumWidth(0);
    b.setPadding(dp(9), 0, dp(9), 0);
    b.setBackground(
        new android.graphics.drawable.RippleDrawable(
            android.content.res.ColorStateList.valueOf(0x229AE4CD), rounded(CARD, 12), null));
    b.setOnClickListener(v -> action.run());
    return b;
  }

  android.graphics.drawable.GradientDrawable rounded(int color, int radius) {
    android.graphics.drawable.GradientDrawable bg =
        new android.graphics.drawable.GradientDrawable();
    bg.setColor(color);
    bg.setCornerRadius(dp(radius));
    bg.setStroke(dp(1), 0x162A4259);
    return bg;
  }

  ImageButton iconButton(int drawable, String label, Runnable action) {
    ImageButton b = new ImageButton(this);
    b.setImageResource(drawable);
    b.setContentDescription(label);
    b.setImageTintList(
        new android.content.res.ColorStateList(
            new int[][] {new int[] {-android.R.attr.state_enabled}, new int[] {}},
            new int[] {0x555F748A, FG}));
    b.setPadding(dp(13), dp(13), dp(13), dp(13));
    b.setBackground(
        new android.graphics.drawable.RippleDrawable(
            android.content.res.ColorStateList.valueOf(0x229AE4CD),
            rounded(Color.TRANSPARENT, 14),
            null));
    b.setOnClickListener(v -> action.run());
    return b;
  }

  void toast(String s) {
    Toast.makeText(this, s, Toast.LENGTH_SHORT).show();
  }

  @Override
  public void onCreate(Bundle saved) {
    setTheme(BrowserAppearance.theme(this));
    super.onCreate(saved);
    palette = BrowserAppearance.palette(this);
    BG = palette.background;
    CARD = palette.surface;
    FG = palette.text;
    MINT = palette.accent;
    // Developer inspection is an explicit, session-only choice.
    WebView.setWebContentsDebuggingEnabled(false);
    prefs = getSharedPreferences("aegis", MODE_PRIVATE);
    history = new VisitHistory(new HistoryRepository(prefs));
    permissions = new BrowserPermissions(this);
    permissions.reloadNormal=()->{for(Tab tab:new ArrayList<>(tabs))reloadTab(tab);};
    exceptions = new HashSet<>(prefs.getStringSet("exceptions", Collections.emptySet()));
    focus = prefs.getBoolean("focus", false);
    root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setTag("chrome-root");
    root.setBackgroundColor(BG);
    root.setOnApplyWindowInsetsListener(
        (v, insets) -> {
          if (Build.VERSION.SDK_INT >= 30) {
            android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars());
            v.setPadding(i.left, i.top, i.right, i.bottom);
          } else {
            v.setPadding(
                insets.getSystemWindowInsetLeft(),
                insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(),
                insets.getSystemWindowInsetBottom());
          }
          return insets;
        });
    setContentView(root);
    if (Build.VERSION.SDK_INT >= 33)
      getOnBackInvokedDispatcher()
          .registerOnBackInvokedCallback(
              android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, () -> handleBack());
    LinearLayout top = new LinearLayout(this);
    top.setPadding(dp(18), dp(4), dp(12), dp(4));
    top.setGravity(Gravity.CENTER_VERTICAL);
    ImageView logo = new ImageView(this);
    logo.setImageResource(R.drawable.ic_brand);
    logo.setTag("chrome-logo");
    top.addView(logo, new LinearLayout.LayoutParams(dp(27), dp(27)));
    TextView brand = new TextView(this);
    brand.setText("Sukoaa");
    brand.setTextColor(FG);
    brand.setTextSize(12);
    brand.setLetterSpacing(.18f);
    brand.setTypeface(
        android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL));
    brand.setPadding(dp(10), 0, 0, 0);
    brand.setGravity(Gravity.CENTER_VERTICAL);
    top.addView(brand, new LinearLayout.LayoutParams(0, dp(43), 1));
    Button privateButton =
        button(
            "Private",
            () -> {
              Intent intent = new Intent(this, AdvancedBrowserActivity.class);
              intent.putExtra("private", true);
              startActivity(intent);
            });
    privateButton.setTextColor(palette.privateAccent);
    privateButton.setTag("chrome-private");
    privateButton.setContentDescription("New private tab");
    top.addView(privateButton, new LinearLayout.LayoutParams(dp(80), dp(40)));
    shieldButton = button("0", () -> protection());
    shieldButton.setTextColor(MINT);
    shieldButton.setTag("chrome-accent");
    shieldButton.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_shield, 0, 0, 0);
    shieldButton.setCompoundDrawablePadding(dp(6));
    shieldButton.setContentDescription("Protection controls");
    top.addView(shieldButton, new LinearLayout.LayoutParams(-2, dp(40)));
    root.addView(top);
    bar = new LinearLayout(this);
    bar.setGravity(Gravity.CENTER_VERTICAL);
    bar.setPadding(dp(14), 0, dp(14), dp(6));
    LinearLayout addressCapsule = new LinearLayout(this);
    addressCapsule.setGravity(Gravity.CENTER_VERTICAL);
    addressCapsule.setTag("chrome-card");
    addressCapsule.setBackground(rounded(CARD, 14));
    addressCapsule.setPadding(dp(12), 0, dp(4), 0);
    ImageView searchIcon = new ImageView(this);
    searchIcon.setImageResource(R.drawable.ic_search);
    searchIcon.setTag("chrome-muted-icon");
    searchIcon.setAlpha(.65f);
    addressCapsule.addView(searchIcon, new LinearLayout.LayoutParams(dp(18), dp(18)));
    address = new EditText(this);
    address.setSingleLine(true);
    address.setTextSize(14);
    address.setTextColor(FG);
    address.setHintTextColor(0xFF8F9FB3);
    address.setHint("Search or enter a website");
    address.setBackgroundColor(Color.TRANSPARENT);
    address.setPadding(dp(11), 0, dp(3), 0);
    address.setInputType(
        android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
    address.setImeOptions(EditorInfo.IME_ACTION_GO);
    address.setSelectAllOnFocus(true);
    address.setContentDescription("Search or website address");
    addressCapsule.addView(address, new LinearLayout.LayoutParams(0, dp(48), 1));
    addressCapsule.addView(
        iconButton(R.drawable.ic_forward, "Go", () -> go(address.getText().toString())),
        new LinearLayout.LayoutParams(dp(43), dp(43)));
    bar.addView(addressCapsule, new LinearLayout.LayoutParams(-1, dp(48)));
    root.addView(bar);
    address.setOnEditorActionListener(
        (v, id, event) -> {
          if (id == EditorInfo.IME_ACTION_GO
              || (event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER)) {
            go(address.getText().toString());
            return true;
          }
          return false;
        });
    progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
    progress.setProgressTintList(android.content.res.ColorStateList.valueOf(MINT));
    root.addView(progress, new LinearLayout.LayoutParams(-1, dp(2)));
    status = new TextView(this);
    status.setTag("chrome-muted");
    status.setTextColor(0xFF8F9FB3);
    status.setTextSize(10);
    status.setPadding(dp(19), dp(1), dp(12), dp(5));
    status.setText("Loading local filters…");
    root.addView(status);
    frame = new FrameLayout(this);
    root.addView(frame, new LinearLayout.LayoutParams(-1, 0, 1));
    LinearLayout navigation = new LinearLayout(this);
    navigation.setGravity(Gravity.CENTER_VERTICAL);
    navigation.setTag("chrome-nav");
    navigation.setPadding(dp(8), dp(4), dp(8), dp(4));
    navigation.setBackgroundColor(BG);
    backButton =
        iconButton(
            R.drawable.ic_back,
            "Back",
            () -> {
              if (current != null && current.web.canGoBack()) current.web.goBack();
            });
    forwardButton =
        iconButton(
            R.drawable.ic_forward,
            "Forward",
            () -> {
              if (current != null && current.web.canGoForward()) current.web.goForward();
            });
    reloadButton =
        iconButton(
            R.drawable.ic_reload,
            "Reload page",
            () -> {
              if (current != null) reloadTab(current);
            });
    navigation.addView(backButton, new LinearLayout.LayoutParams(0, dp(48), 1));
    navigation.addView(forwardButton, new LinearLayout.LayoutParams(0, dp(48), 1));
    navigation.addView(
        iconButton(R.drawable.ic_home, "Home", () -> home(current)),
        new LinearLayout.LayoutParams(0, dp(48), 1));
    navigation.addView(reloadButton, new LinearLayout.LayoutParams(0, dp(48), 1));
    tabsButton = button("1", () -> tabList());
    tabsButton.setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_tabs, 0, 0, 0);
    tabsButton.setCompoundDrawablePadding(dp(4));
    tabsButton.setContentDescription("Open tabs");
    navigation.addView(tabsButton, new LinearLayout.LayoutParams(0, dp(42), 1));
    navigation.addView(
        iconButton(R.drawable.ic_menu, "Browser menu", () -> menu()),
        new LinearLayout.LayoutParams(0, dp(48), 1));
    root.addView(navigation);
    applyAppearance();

    worker.execute(
        () -> {
          try {
            List<String> hosts = new ArrayList<>();
            try (BufferedReader reader =
                new BufferedReader(
                    new InputStreamReader(
                        (new File(getFilesDir(), "domains.txt").exists()
                            ? new FileInputStream(new File(getFilesDir(), "domains.txt"))
                            : getAssets().open("domains.txt")),
                        java.nio.charset.StandardCharsets.UTF_8))) {
              String line;
              while ((line = reader.readLine()) != null) hosts.add(line);
            }
            rules = new FilterRules(hosts);
            runOnUiThread(
                () -> {
                  newTab(null);
                  Intent intent = getIntent();
                  if (intent.getData() != null) go(intent.getData().toString());
                });
          } catch (Exception e) {
            runOnUiThread(
                () -> {
                  toast("Filters unavailable");
                  newTab(null);
                });
          }
        });
  }

  void update() {
    if (current == null) return;
    tabsButton.setText(String.valueOf(tabs.size()));
    shieldButton.setText(String.valueOf(current.blocked.get()));
    backButton.setEnabled(current.web.canGoBack());
    forwardButton.setEnabled(current.web.canGoForward());
    status.setText(paused(current) ? "Protection paused" : "");
    status.setVisibility(paused(current) ? View.VISIBLE : View.GONE);
    if (!address.hasFocus()) address.setText(current.url);
  }

  String host(String url) {
    try {
      return new URI(url).getHost();
    } catch (Exception e) {
      return null;
    }
  }

  boolean paused(Tab t) {
    return exceptions.contains(host(t.url)) || (t.repairUntil>System.currentTimeMillis()&&t.repairSite.equals(BrowserPermissions.origin(t.url)));
  }

  String assetScript(String name) {
    try(InputStream input=getAssets().open(name)) {
      ByteArrayOutputStream out=new ByteArrayOutputStream();
      byte[] buffer=new byte[8192];int count;
      while((count=input.read(buffer))!=-1)out.write(buffer,0,count);
      return out.toString(java.nio.charset.StandardCharsets.UTF_8.name());
    } catch(IOException error) {throw new IllegalStateException("Missing bundled page policy",error);}
  }

  void refreshPagePolicy(Tab t) {
    if(!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))return;
    if(t.youtubeScript!=null)t.youtubeScript.remove();
    String excluded=new JSONArray(new ArrayList<>(exceptions)).toString();
    String repair=JSONObject.quote(t.repairSite);
    String script="if(!"+excluded+".includes(location.hostname) && !(location.origin==="+repair+" && Date.now()<"+t.repairUntil+")){"+assetScript("youtube-start.js")+"}";
    t.youtubeScript=WebViewCompat.addDocumentStartJavaScript(t.web,script,new HashSet<>(Arrays.asList("https://youtube.com","https://*.youtube.com")));
  }

  void reloadTab(Tab t) {refreshPagePolicy(t);t.web.reload();}

  void muteTab(Tab t,boolean mute) {
    if(WebViewFeature.isFeatureSupported(WebViewFeature.MUTE_AUDIO))WebViewCompat.setAudioMuted(t.web,mute);
  }

  void pauseTab(Tab t) {
    muteTab(t,true);
    t.web.evaluateJavascript("document.dispatchEvent(new Event('sukoaa-pause-media'));document.querySelectorAll('video,audio').forEach(m=>m.pause())",null);
    t.web.onPause();
  }

  void switchTab(Tab t) {
    if (t == null || !tabs.contains(t) || isFinishing() || isDestroyed()) return;
    if(current!=t)permissions.cancel();
    hideVideo();
    if (current != null && current != t) pauseTab(current);
    current = t;
    t.web.onResume();
    frame.removeAllViews();
    if (t.web.getParent() != null) ((android.view.ViewGroup) t.web.getParent()).removeView(t.web);
    frame.addView(t.web, new FrameLayout.LayoutParams(-1, -1));
    address.clearFocus();
    update();
    if(t.addressPending)restoreNewTabFocus(t);
  }

  Tab newTab(String initialUrl) {
    return newTab(initialUrl, false);
  }

  Tab newTab(String initialUrl, boolean popup) {
    if (tabs.size() >= 20) {
      toast("Close a tab first (20 tab limit)");
      return null;
    }
    Tab t = new Tab();
    t.web = new WebView(this);
    WebView w = t.web;
    w.setBackgroundColor(BG);
    w.setOnFocusChangeListener((v,focused)->{if(focused && current==t && t.addressPending)w.post(()->{if(current==t && t.addressPending)restoreNewTabFocus(t);});});
    if(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
      WebViewCompat.addDocumentStartJavaScript(w, assetScript("media-start.js"), Collections.singleton("*"));
      refreshPagePolicy(t);
    }
    w.setOnTouchListener((v,event)->{
      if(event.getActionMasked()==MotionEvent.ACTION_DOWN){t.addressPending=false;if(t==current)muteTab(t,false);}
      return false;
    });
    w.setOnKeyListener((v,key,event)->{if(event.getAction()==KeyEvent.ACTION_DOWN && t==current){t.addressPending=false;muteTab(t,false);}return false;});
    muteTab(t,true);
    WebSettings s = w.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setAllowFileAccess(false);
    s.setAllowContentAccess(false);
    s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    s.setSafeBrowsingEnabled(true);
    // Script-created links still require our Open/Block decision below.
    s.setJavaScriptCanOpenWindowsAutomatically(true);
    s.setSupportMultipleWindows(true);
    s.setMediaPlaybackRequiresUserGesture(true);
    s.setGeolocationEnabled(true);
    s.setBuiltInZoomControls(true);
    s.setDisplayZoomControls(false);
    CookieManager.getInstance().setAcceptThirdPartyCookies(w, false);
    w.setWebViewClient(
        new WebViewClient() {
          @Override
          public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String u = request.getUrl().toString();
            if(request.isForMainFrame()){t.addressPending=false;refreshPagePolicy(t);}
            if (popup && "about:blank".equals(u)) return false;
            if (!"https".equalsIgnoreCase(request.getUrl().getScheme())
                || !BrowserPolicy.allowed(u, false)) {
              if (request.isForMainFrame())
                toast("Only HTTPS navigation is supported in this view");
              return true;
            }
            return false;
          }

          @Override
          public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest r) {
            if (!r.isForMainFrame()
                && !paused(t)
                && rules.blocksRequest(r.getUrl().getHost(), r.getUrl().getPath())) {
              int count = t.blocked.incrementAndGet();
              if (count % 5 == 0 || count == 1) runOnUiThread(() -> update());
              return new WebResourceResponse(
                  "text/plain",
                  "UTF-8",
                  204,
                  "Blocked",
                  Collections.emptyMap(),
                  new ByteArrayInputStream(new byte[0]));
            }
            return null;
          }

          @Override
          public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
            if(!url.startsWith("https://aegis.invalid/"))t.addressPending=false;
            if(!t.addressPending)muteTab(t,true);
            permissions.cancel();
            if(t.permissionScope!=null)t.permissionScope.revision++;
            if (t == current) hideVideo();
            t.url = url.startsWith("https:") && !"aegis.invalid".equals(host(url)) ? url : "";
            if(!t.repairSite.equals(BrowserPermissions.origin(t.url))) {t.repairSite="";t.repairUntil=0;if(t.repairExpiry!=null)root.removeCallbacks(t.repairExpiry);}
            t.lastProblem="";
            t.icon=null;
            t.title=t.url.isEmpty()?"New tab":host(t.url);
            t.blocked.set(0);
            if (t == current) {
              if(!address.hasFocus())address.setText(t.url);
              update();
            }
          }

          @Override
          public void onPageFinished(WebView view, String url) {
            if (!tabs.contains(t) || isFinishing() || isDestroyed()) return;
            String title=view.getTitle();
            if(title!=null&&!title.trim().isEmpty())t.title=title;
            inject(t);
            history.record(t.historyScope, url, t.title);
            if(t!=current)pauseTab(t);
            if (t == current) {update();if(t.addressPending)restoreNewTabFocus(t);}
          }

          @Override
          public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            handler.cancel();t.lastProblem="Certificate error. The connection remains blocked.";
            runOnUiThread(() -> toast("Certificate error: connection blocked"));
          }

          @Override
          public void onSafeBrowsingHit(
              WebView view, WebResourceRequest r, int type, SafeBrowsingResponse response) {
            response.backToSafety(true);
          }

          @Override
          public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
            if (r.isForMainFrame()) {
              t.lastProblem="Page could not load: "+e.getDescription();
              status.setText(t.lastProblem);
              status.setVisibility(View.VISIBLE);
            }
          }
        });
    w.setWebChromeClient(
        new WebChromeClient() {
          @Override
          public void onShowCustomView(View view, CustomViewCallback callback) {
            if (videoView != null || t != current || isFinishing()) {
              callback.onCustomViewHidden();
              return;
            }
            videoView = view;
            videoCallback = callback;
            previousSystemUi = getWindow().getDecorView().getSystemUiVisibility();
            previousKeepScreenOn =
                (getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    != 0;
            videoContainer = new FrameLayout(MainActivity.this);
            videoContainer.setBackgroundColor(Color.BLACK);
            videoContainer.addView(view, new FrameLayout.LayoutParams(-1, -1));
            Button exit = button("Exit fullscreen", () -> hideVideo());
            FrameLayout.LayoutParams exitParams =
                new FrameLayout.LayoutParams(-2, dp(40), Gravity.TOP | Gravity.END);
            exitParams.setMargins(dp(12), dp(12), dp(12), 0);
            videoContainer.addView(exit, exitParams);
            root.setVisibility(View.GONE);
            addContentView(videoContainer, new android.view.ViewGroup.LayoutParams(-1, -1));
            getWindow()
                .addFlags(
                    WindowManager.LayoutParams.FLAG_FULLSCREEN
                        | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            immersiveVideo();
            view.requestFocus();
          }

          @Override
          public void onHideCustomView() {
            hideVideo();
          }

          @Override
          public void onCloseWindow(WebView window) {
            closeTab(t);
          }

          @Override
          public void onProgressChanged(WebView v, int value) {
            if (t == current) {
              progress.setProgress(value);
              progress.setVisibility(value == 100 ? View.GONE : View.VISIBLE);
            }
          }

          @Override public void onReceivedTitle(WebView v,String title) {
            if(tabs.contains(t)&&title!=null&&!title.trim().isEmpty())t.title=title;
          }
          @Override public void onReceivedIcon(WebView v,android.graphics.Bitmap icon) {
            if(tabs.contains(t)&&icon!=null)t.icon=android.graphics.Bitmap.createScaledBitmap(icon,32,32,true);
          }

          @Override
          public void onPermissionRequest(PermissionRequest r) {
            List<String> kinds=new ArrayList<>();
            for(String resource:r.getResources()) {
              if(PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource))kinds.add("camera");
              else if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource))kinds.add("microphone");
              else {r.deny();return;}
            }
            permissions.ask(permissionScope(t),r.getOrigin().toString(),kinds,allow->{if(allow)r.grant(r.getResources());else r.deny();});
          }

          @Override public void onPermissionRequestCanceled(PermissionRequest request) {permissions.cancel();}
          @Override
          public void onGeolocationPermissionsShowPrompt(
              String origin, GeolocationPermissions.Callback cb) {
            permissions.ask(permissionScope(t),origin,Collections.singletonList("location"),allow->cb.invoke(origin,allow,false));
          }

          @Override
          public boolean onCreateWindow(
              WebView v, boolean dialog, boolean gesture, Message result) {
            if (t != current
                || isFinishing()
                || isDestroyed()
                || popupDecision != null
                || result == null
                || !(result.obj instanceof WebView.WebViewTransport)) return false;
            if (tabs.size() >= 20) {
              toast("Close a tab, then tap the story again (20 tab limit)");
              return false;
            }
            WebView.WebViewTransport transport = (WebView.WebViewTransport) result.obj;
            PopupDecision decision =
                new PopupDecision(
                    allow -> {
                      WebView child = null;
                      if (allow && t == current && !isFinishing() && !isDestroyed()) {
                        // The native transport requires a never-loaded WebView, including
                        // window.open('about:blank') followed by script navigation.
                        Tab opened = newTab(null, true);
                        if (opened != null) child = opened.web;
                      }
                      transport.setWebView(child);
                      result.sendToTarget();
                    });
            if (gesture) decision.resolve(true);
            else {
              popupDecision = decision;
              String site = host(t.url);
              popupDialog =
                  new AlertDialog.Builder(MainActivity.this)
                      .setTitle("Open link?")
                      .setMessage(
                          (site.isEmpty() ? "This page" : site)
                              + " asked to open another tab. If you tapped a story, choose Open. "
                              + "The destination is supplied by the page after the tab opens.")
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
              popupDialog.show();
            }
            return true;
          }

          @Override
          public boolean onShowFileChooser(
              WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
            if (upload != null) upload.onReceiveValue(null);
            upload = cb;
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.setType("*/*");
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.putExtra(
                Intent.EXTRA_ALLOW_MULTIPLE, p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
            try {
              startActivityForResult(intent, 9);
              return true;
            } catch (Exception e) {
              upload = null;
              cb.onReceiveValue(null);
              return true;
            }
          }
        });
    w.setOnLongClickListener(
        view -> {
          WebView.HitTestResult hit = w.getHitTestResult();
          if (hit == null
              || (hit.getType() != WebView.HitTestResult.SRC_ANCHOR_TYPE
                  && hit.getType() != WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE)) return false;
          String link = hit.getExtra();
          if (link == null || !link.startsWith("https://") || !BrowserPolicy.allowed(link, false))
            return false;
          new AlertDialog.Builder(this)
              .setTitle("Open link")
              .setItems(
                  new String[] {"Open in current tab", "Open in new tab", "Open privately"},
                  (dialog, choice) -> {
                    if (choice == 0) {
                      switchTab(t);
                      go(link);
                    } else if (choice == 1) newTab(link);
                    else {
                      Intent intent = new Intent(this, AdvancedBrowserActivity.class);
                      intent.putExtra("private", true);
                      intent.putExtra("url", link);
                      startActivity(intent);
                    }
                  })
              .show();
          return true;
        });
    w.setDownloadListener(
        (url, ua, disposition, mime, size) ->
            new AlertDialog.Builder(this)
                .setTitle("Download file?")
                .setMessage("Download only files you trust.\n" + Uri.parse(url).getHost())
                .setNegativeButton("Cancel", null)
                .setPositiveButton(
                    "Download",
                    (d, i) -> {
                      try {
                        Uri uri = Uri.parse(url);
                        if (!"https".equals(uri.getScheme())) throw new Exception();
                        String file = URLUtil.guessFileName(url, disposition, mime);
                        android.app.DownloadManager.Request request =
                            new android.app.DownloadManager.Request(uri);
                        request.setTitle(file);
                        request.addRequestHeader("User-Agent", ua);
                        String cookie = CookieManager.getInstance().getCookie(url);
                        if (cookie != null) request.addRequestHeader("Cookie", cookie);
                        request.setNotificationVisibility(
                            android.app.DownloadManager.Request
                                .VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                        request.setDestinationInExternalPublicDir(
                            Environment.DIRECTORY_DOWNLOADS,
                            file.replace('/', '_').replace('\\', '_'));
                        ((android.app.DownloadManager) getSystemService(DOWNLOAD_SERVICE))
                            .enqueue(request);
                        toast("Download started");
                      } catch (Exception e) {
                        toast("Could not download this file");
                      }
                    })
                .show());
    tabs.add(t);
    switchTab(t);
    if (!popup) {
      if (initialUrl == null) {home(t);focusNewTab(t);}
      else go(initialUrl);
    }
    return t;
  }

  void focusNewTab(Tab tab) {
    tab.addressPending=true;
    address.setText("");restoreNewTabFocus(tab);
  }

  void restoreNewTabFocus(Tab tab) {
    if(current!=tab)return;
    // Reclaim focus after WebView load without replacing an already typed draft.
    address.requestFocus();
    address.postDelayed(()->{if(current==tab&&address.hasFocus()&&!isFinishing())
      ((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).showSoftInput(address,InputMethodManager.SHOW_IMPLICIT);},100);
  }

  void immersiveVideo() {
    if (videoView == null) return;
    if (Build.VERSION.SDK_INT >= 30) {
      WindowInsetsController controller = getWindow().getInsetsController();
      if (controller != null) {
        controller.hide(WindowInsets.Type.systemBars());
        controller.setSystemBarsBehavior(
            WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
      }
    } else {
      getWindow()
          .getDecorView()
          .setSystemUiVisibility(
              View.SYSTEM_UI_FLAG_FULLSCREEN
                  | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                  | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                  | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                  | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                  | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }
  }

  void hideVideo() {
    if (videoView == null) return;
    WebChromeClient.CustomViewCallback callback = videoCallback;
    videoView = null;
    videoCallback = null;
    if (videoContainer != null && videoContainer.getParent() instanceof ViewGroup)
      ((ViewGroup) videoContainer.getParent()).removeView(videoContainer);
    if (videoContainer != null) videoContainer.removeAllViews();
    videoContainer = null;
    root.setVisibility(View.VISIBLE);
    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
    if (!previousKeepScreenOn)
      getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    if (Build.VERSION.SDK_INT >= 30) {
      WindowInsetsController controller = getWindow().getInsetsController();
      if (controller != null) controller.show(WindowInsets.Type.systemBars());
    } else getWindow().getDecorView().setSystemUiVisibility(previousSystemUi);
    root.requestApplyInsets();
    if (palette != null) BrowserAppearance.window(this, palette);
    if (callback != null) callback.onCustomViewHidden();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) immersiveVideo();
  }

  void developerTools() {
    new AlertDialog.Builder(this)
        .setTitle("Developer inspection")
        .setMessage(
            "Inspect Android pages from Chrome on your computer. Connect your phone by USB, enable"
                + " Android USB debugging and authorize your computer, then open"
                + " chrome://inspect/#devices on the computer and choose Inspect for Sukoaa.\n\n"
                + "This gives the authorized computer access to open pages, including site data."
                + " Enable it only while debugging with your own computer. It is off by default and"
                + " resets when the app process restarts.\n\n"
                + "Current status: "
                + (developerInspection ? "ON" : "OFF"))
        .setNegativeButton("Close", null)
        .setPositiveButton(
            developerInspection ? "Disable inspection" : "Enable inspection",
            (d, which) -> {
              developerInspection = !developerInspection;
              WebView.setWebContentsDebuggingEnabled(developerInspection);
              toast(
                  developerInspection
                      ? "USB inspection enabled for this session"
                      : "USB inspection disabled");
            })
        .show();
  }

  void inject(Tab t) {
    if (paused(t)) return;
    String css =
        "[data-ad-slot],ins.adsbygoogle,.google-auto-placed,iframe[src*=doubleclick],.advertisement,[aria-label=Advertisement]{display:none!important}";
    if (focus)
      css +=
          "a[href^='/shorts/'],ytd-reel-shelf-renderer,ytm-reel-shelf-renderer,#related,ytm-watch-next-secondary-results-renderer{display:none!important}";
    String js =
        "(()=>{let"
            + " s=document.getElementById('aegis-css');if(!s){s=document.createElement('style');s.id='aegis-css';(document.head||document.documentElement).appendChild(s)}s.textContent="
            + JSONObject.quote(css)
            + "})()";
    t.web.evaluateJavascript(js, null);
  }

  void applyAppearance() {
    palette = BrowserAppearance.palette(this);
    appearanceKey = BrowserAppearance.key(palette);
    BG = palette.background;
    CARD = palette.surface;
    FG = palette.text;
    MINT = palette.accent;
    BrowserAppearance.window(this, palette);
    BrowserAppearance.apply(root, palette);
    for (Tab tab : tabs) {
      tab.web.setBackgroundColor(BG);
      applyHomeAppearance(tab);
    }
  }

  void applyHomeAppearance(Tab tab) {
    if (!"aegis.invalid".equals(host(tab.web.getUrl()))) return;
    tab.web.evaluateJavascript(
        "(()=>{let s=document.getElementById('aegis-appearance');"
            + "if(!s){s=document.createElement('style');s.id='aegis-appearance';document.head.appendChild(s)}"
            + "s.textContent="
            + JSONObject.quote(BrowserAppearance.homeCss(palette))
            + "})()",
        null);
  }

  @Override
  public void onConfigurationChanged(android.content.res.Configuration configuration) {
    super.onConfigurationChanged(configuration);
    applyAppearance();
  }

  void home(Tab t) {
    if (t == null) return;
    try (BufferedReader reader =
        new BufferedReader(
            new InputStreamReader(
                getAssets().open("home.html"), java.nio.charset.StandardCharsets.UTF_8))) {
      StringBuilder html = new StringBuilder();
      String line;
      while ((line = reader.readLine()) != null) html.append(line).append('\n');
      t.url = "";
      t.addressPending=true;
      t.web.loadDataWithBaseURL(
          "https://aegis.invalid/",
          html.toString().replace("</style>", BrowserAppearance.homeCss(palette) + "</style>"),
          "text/html",
          "UTF-8",
          null);
      address.setText("");
    } catch (IOException e) {
      toast("Could not load the new-tab page");
    }
  }

  void go(String input) {
    if (current == null) return;
    String s = input.trim();
    if (s.isEmpty()) return;
    String url;
    try {
      if (s.matches("(?i)^[a-z][a-z0-9+.-]*:.*") && !s.startsWith("https://")) {
        toast("Only HTTPS addresses are supported");
        return;
      }
      if (s.startsWith("https://")) {
        URI uri = new URI(s);
        if (uri.getHost() == null || uri.getUserInfo() != null) throw new Exception();
        url = s;
      } else if (!s.contains(" ") && s.matches("^[\\w.-]+\\.[a-zA-Z]{2,}([/:?#].*)?$"))
        url = "https://" + s;
      else
        url =
            (prefs.getBoolean("duck", false)
                    ? "https://duckduckgo.com/?q="
                    : "https://www.google.com/search?q=")
                + java.net.URLEncoder.encode(s, "UTF-8");
      current.addressPending=false;
      refreshPagePolicy(current);
      current.web.loadUrl(url);
      address.clearFocus();
      ((InputMethodManager) getSystemService(INPUT_METHOD_SERVICE))
          .hideSoftInputFromWindow(address.getWindowToken(), 0);
    } catch (Exception e) {
      toast("Invalid address");
    }
  }

  void protection() {
    if (current == null) return;
    String h = host(current.url);
    String[] options = {
      (paused(current) ? "Enable filtering" : "Fix this page: pause filtering"),
      "YouTube distraction hiding: " + (focus ? "ON" : "OFF"),
      "About protection"
    };
    new AlertDialog.Builder(this)
        .setTitle(
            "◈ " + (h == null ? "Protection" : h) + " • " + current.blocked.get() + " blocked")
        .setItems(
            options,
            (d, i) -> {
              if (i == 0 && h != null && !h.equals("aegis.invalid")) {
                Set<String> next = new HashSet<>(exceptions);
                if (!next.remove(h)) next.add(h);
                exceptions = next;
                prefs.edit().putStringSet("exceptions", next).apply();
                reloadTab(current);
              } else if (i == 1) {
                focus = !focus;
                prefs.edit().putBoolean("focus", focus).apply();
                reloadTab(current);
              } else if (i == 2)
                new AlertDialog.Builder(this)
                    .setTitle("Protection")
                    .setMessage(
                        "Local domain filtering + cosmetic hiding. Android uses a conservative"
                            + " domain subset of EasyList and EasyPrivacy. It does not include the"
                            + " desktop engine's full filter syntax or scriptlets. An early YouTube"
                            + " player-data filter runs when this WebView supports document-start scripts. YouTube video"
                            + " ads are not guaranteed to be blocked.\n\n"
                            + "Safe Browsing is enabled; certificate failures are blocked. Camera,"
                            + " microphone and location ask per site. Notifications remain denied. No VPN,"
                            + " remote proxy or browsing telemetry is used.\n\n"
                            + "Videos require a tap and pause when you switch tabs. Keep Android System WebView updated.\n"
                            + "Early filtering available: " + WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
                            + " · Background audio muting available: " + WebViewFeature.isFeatureSupported(WebViewFeature.MUTE_AUDIO) + "\n\nThis preview has not had an"
                            + " independent security audit.")
                    .setPositiveButton("OK", null)
                    .show();
            })
        .setNegativeButton("Close", null)
        .show();
  }

  BrowserPermissions.Scope permissionScope(Tab t) {
    if(t.permissionScope==null)t.permissionScope=new BrowserPermissions.Scope(false,()->t.web.getUrl()==null?"":t.web.getUrl(),()->current==t && tabs.contains(t) && !isFinishing() && !isDestroyed());
    return t.permissionScope;
  }
  @Override public void onRequestPermissionsResult(int code,String[] names,int[] results) {
    super.onRequestPermissionsResult(code,names,results);permissions.onResult(code);
  }
  void repairPage() {
    final Tab tab=current;if(tab==null)return;
    boolean temporary=tab.repairUntil>System.currentTimeMillis()&&tab.repairSite.equals(BrowserPermissions.origin(tab.url));
    String message=(tab.lastProblem.isEmpty()?"No page-load error reported.":tab.lastProblem)+"\n\n"+tab.blocked.get()+" requests blocked. Blocking alone does not prove it caused the problem.\n"+
      (temporary?"Temporary filter test is active.":"No temporary test is active.")+"\nLite mode: "+(tab.web.getSettings().getLoadsImagesAutomatically()?"off":"on")+".\n\nA filter test reloads only this tab and pauses filtering for five minutes. Ads and trackers may load. Changing sites or Undo restores filtering. Lite mode is separate. Save unfinished forms first.";
    new AlertDialog.Builder(this).setTitle("Fix this page").setMessage(message)
      .setPositiveButton(temporary?"Undo filter test":"Test filters · 5 min",(d,w)->{
        if(current!=tab||!tabs.contains(tab))return;
        if(temporary){tab.repairUntil=0;tab.repairSite="";if(tab.repairExpiry!=null)root.removeCallbacks(tab.repairExpiry);reloadTab(tab);}
        else {String site=BrowserPermissions.origin(tab.url);if(site.isEmpty()){toast("Open an HTTPS website first");return;}
          if(tab.repairExpiry!=null)root.removeCallbacks(tab.repairExpiry);
          tab.repairSite=site;tab.repairUntil=System.currentTimeMillis()+300000;
          tab.repairExpiry=()->{if(tabs.contains(tab)&&tab.repairUntil>0){tab.repairUntil=0;tab.repairSite="";reloadTab(tab);}};
          root.postDelayed(tab.repairExpiry,300000);reloadTab(tab);}
      })
      .setNeutralButton("More help",(d,w)->new AlertDialog.Builder(this).setTitle("Page help")
        .setItems(new String[]{"Camera / microphone / location settings","Clean private comparison","Copy or popup help"},(x,i)->{
          if(i==0)permissions.settings(permissionScope(tab),()->tab.web.reload());
          if(i==1)openCleanComparison(tab);
          if(i==2)new AlertDialog.Builder(this).setTitle("Copy and links").setMessage("Tap inside the website, then tap Copy. Select text and use Android Copy as a fallback. For a link-opening prompt, choose Open only for the link you intended. Automatic popups stay controlled.").setPositiveButton("OK",null).show();
        }).setNegativeButton("Close",null).show())
      .setNegativeButton("Close",null).show();
  }
  void openCleanComparison(Tab tab) {
    if(!tab.url.startsWith("https://")){toast("Open an HTTPS website first");return;}
    Intent intent=new Intent(this,AdvancedBrowserActivity.class);intent.putExtra("private",true);intent.putExtra("url",tab.url);startActivity(intent);
  }
  void comparePage() {
    final Tab tab=current;if(tab==null||tab.url.isEmpty()){toast("Open a website first");return;}
    new AlertDialog.Builder(this).setTitle("Compare this page")
      .setMessage(tab.title+"\n"+BrowserPermissions.origin(tab.url)+"\n\nCurrent layout: "+(desktop?"desktop":"mobile")+"\nRequests blocked: "+tab.blocked.get()+"\n\nOpen a clean private view to test saved-site-data or sign-in problems, then use Android Back to return here. The clean view uses a different engine, so differences can come from both stored data and rendering. Full three-column comparison is available on desktop.")
      .setPositiveButton("Open clean private view",(d,w)->openCleanComparison(tab))
      .setNeutralButton("Site permissions",(d,w)->permissions.settings(permissionScope(tab),()->tab.web.reload()))
      .setNegativeButton("Close",null).show();
  }
  void menu() {
    if (current == null) return;
    String[] items = {
      "New tab",
      "Reload",
      "Forward",
      "Bookmark page",
      "Bookmarks",
      "History",
      "Find on page",
      "Share page",
      "Desktop site: " + (desktop ? "ON" : "OFF"),
      "Search engine: " + (prefs.getBoolean("duck", false) ? "DuckDuckGo" : "Google"),
      "Clear browsing data",
      "About Sukoaa",
      "Update filter lists",
      "Developer inspection: " + (developerInspection ? "ON" : "OFF"),
      "New private tab · GeckoView",
      "Clean test this page · private",
      "Add-on browser · Firefox extensions",
      "Lite mode: " + (current.web.getSettings().getLoadsImagesAutomatically() ? "OFF" : "ON"),
      "HTTP cache: "
          + (current.web.getSettings().getCacheMode() == WebSettings.LOAD_NO_CACHE ? "OFF" : "ON"),
      "Appearance · theme, style & colours",
      "Privacy & open-source licenses",
      "Site permissions · camera, microphone, location",
      "Fix this page",
      "Compare this page"
    };
    new AlertDialog.Builder(this)
        .setTitle("Browser tools")
        .setNeutralButton(
            "Appearance", (dialog, which) -> BrowserAppearance.show(this, this::applyAppearance))
        .setItems(
            items,
            (d, i) -> {
              switch (i) {
                case 23:
                  comparePage();break;
                case 22:
                  repairPage();break;
                case 21:
                  permissions.settings(permissionScope(current),()->{for(Tab tab:tabs)reloadTab(tab);});
                  break;
                case 20:
                  BrowserLegal.show(this);
                  break;
                case 19:
                  BrowserAppearance.show(this, this::applyAppearance);
                  break;
                case 14:
                case 15:
                case 16:
                  Intent advanced = new Intent(this, AdvancedBrowserActivity.class);
                  advanced.putExtra("private", i != 16);
                  if (i == 15 || i == 16) advanced.putExtra("url", current.url);
                  startActivity(advanced);
                  break;
                case 18:
                  boolean noCache =
                      current.web.getSettings().getCacheMode() != WebSettings.LOAD_NO_CACHE;
                  current
                      .web
                      .getSettings()
                      .setCacheMode(noCache ? WebSettings.LOAD_NO_CACHE : WebSettings.LOAD_DEFAULT);
                  reloadTab(current);
                  toast(
                      noCache
                          ? "HTTP cache bypass on; site-managed storage remains"
                          : "HTTP cache enabled");
                  break;
                case 17:
                  boolean images = current.web.getSettings().getLoadsImagesAutomatically();
                  current.web.getSettings().setLoadsImagesAutomatically(!images);
                  reloadTab(current);
                  toast(images ? "Lite mode: downloaded images disabled" : "Lite mode off");
                  break;
                case 13:
                  developerTools();
                  break;
                case 12:
                  updateFilters();
                  break;
                case 0:
                  newTab(null);
                  break;
                case 1:
                  reloadTab(current);
                  break;
                case 2:
                  if (current.web.canGoForward()) current.web.goForward();
                  break;
                case 3:
                  bookmark();
                  break;
                case 4:
                  list("bookmarks");
                  break;
                case 5:
                  list("history");
                  break;
                case 6:
                  EditText q = new EditText(this);
                  new AlertDialog.Builder(this)
                      .setTitle("Find on page")
                      .setView(q)
                      .setPositiveButton(
                          "Find", (x, y) -> current.web.findAllAsync(q.getText().toString()))
                      .setNeutralButton("Next", (x, y) -> current.web.findNext(true))
                      .show();
                  break;
                case 7:
                  if (current.url.startsWith("https:")) {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("text/plain");
                    send.putExtra(Intent.EXTRA_TEXT, current.url);
                    startActivity(Intent.createChooser(send, "Share page"));
                  }
                  break;
                case 8:
                  desktop = !desktop;
                  current
                      .web
                      .getSettings()
                      .setUserAgentString(
                          desktop
                              ? WebSettings.getDefaultUserAgent(this)
                                  .replace("; wv", "")
                                  .replace("Android", "X11; Linux x86_64")
                                  .replace("Mobile ", "")
                              : null);
                  current.web.getSettings().setUseWideViewPort(desktop);
                  current.web.getSettings().setLoadWithOverviewMode(desktop);
                  reloadTab(current);
                  break;
                case 9:
                  prefs.edit().putBoolean("duck", !prefs.getBoolean("duck", false)).apply();
                  toast("Search engine changed");
                  break;
                case 10:
                  new AlertDialog.Builder(this)
                      .setTitle("Clear cookies, history and cache?")
                      .setMessage(
                          "Clears regular WebView pages and signs you out there. Keeps bookmarks."
                              + " Gecko tabs/add-ons have separate storage; clear it from their"
                              + " browser menu.")
                      .setNegativeButton("Cancel", null)
                      .setPositiveButton(
                          "Clear",
                          (x, y) -> {
                            CookieManager.getInstance().removeAllCookies(null);
                            WebStorage.getInstance().deleteAllData();
                            for (Tab t : tabs) {
                              t.web.clearCache(true);
                              t.web.clearHistory();
                              home(t);
                            }
                            prefs.edit().remove("history").apply();
                          })
                      .show();
                  break;
                case 11:
                  new AlertDialog.Builder(this)
                      .setTitle("Sukoaa")
                      .setMessage(
                          "Created for Subo.\n\n"
                              + "Native Android browser using Android System WebView. Not"
                              + " affiliated with Google, Chrome or Brave.\n\n"
                              + "Desktop version has a different rendering shell and stronger"
                              + " filter syntax support. iPhone is not included. No account or"
                              + " analytics. Private tabs now use the separate GeckoView browser;"
                              + " the regular WebView tabs still share cookies.\n\n"
                              + "EasyList/EasyPrivacy: GPL-3.0-or-later or CC-BY-SA-3.0. See source"
                              + " archive for notices.")
                      .setPositiveButton("OK", null)
                      .show();
                  break;
              }
            })
        .show();
  }

  void updateFilters() {
    toast("Updating filters…");
    worker.execute(
        () -> {
          try {
            Set<String> next = FilterUpdater.download();
            File temp = new File(getFilesDir(), "domains.tmp"),
                dest = new File(getFilesDir(), "domains.txt");
            try (BufferedWriter writer =
                new BufferedWriter(
                    new OutputStreamWriter(
                        new FileOutputStream(temp), java.nio.charset.StandardCharsets.UTF_8))) {
              for (String h : next) {
                writer.write(h);
                writer.newLine();
              }
            }
            if (!temp.renameTo(dest)) throw new IOException("Could not save filters");
            rules = new FilterRules(next);
            runOnUiThread(
                () -> {
                  update();
                  toast("Updated " + next.size() + " filter domains");
                });
          } catch (Exception e) {
            runOnUiThread(() -> toast("Update failed; existing filters are still active"));
          }
        });
  }

  void bookmark() {
    if (!current.url.startsWith("https:") || "aegis.invalid".equals(host(current.url))) return;
    try {
      JSONArray list = new JSONArray(prefs.getString("bookmarks", "[]"));
      for (int i = 0; i < list.length(); i++)
        if (list.getJSONObject(i).getString("url").equals(current.url)) {
          toast("Already bookmarked");
          return;
        }
      list.put(new JSONObject().put("url", current.url).put("title", current.title));
      prefs.edit().putString("bookmarks", list.toString()).apply();
      toast("Bookmark saved");
    } catch (Exception e) {
      toast("Could not save bookmark");
    }
  }

  void list(String key) {
    if ("history".equals(key)) {
      historyList();
      return;
    }
    try {
      JSONArray array = new JSONArray(prefs.getString(key, "[]"));
      String[] names = new String[array.length()];
      for (int i = 0; i < names.length; i++)
        names[i] =
            array.getJSONObject(i).optString("title", array.getJSONObject(i).getString("url"));
      new AlertDialog.Builder(this)
          .setTitle(key)
          .setItems(
              names,
              (d, i) -> {
                try {
                  go(array.getJSONObject(i).getString("url"));
                } catch (Exception ignored) {
                }
              })
          .setNegativeButton("Close", null)
          .show();
    } catch (Exception ignored) {
    }
  }

  void historyList() {
    List<BrowserListDialog.Row> rows = new ArrayList<>();
    for (VisitHistory.Entry entry : history.entries())
      rows.add(
          new BrowserListDialog.Row(
              entry.title(), entry.url(), () -> go(entry.url()), () -> history.remove(entry.id())));
    BrowserListDialog.show(
        this,
        "History",
        rows,
        "Delete visit",
        "Clear history",
        () -> {
          new AlertDialog.Builder(this)
              .setTitle("Delete all browsing history?")
              .setNegativeButton("Cancel", (d, w) -> historyList())
              .setPositiveButton(
                  "Delete",
                  (d, w) -> {
                    history.clear();
                    historyList();
                  })
              .show();
        },
        this::historyList);
  }

  void closeTab(Tab tab) {
    if (tab == null || !tabs.contains(tab)) return;
    if(tab.repairExpiry!=null)root.removeCallbacks(tab.repairExpiry);
    boolean selected = tab == current;
    int index = tabs.indexOf(tab);
    permissions.cancel();
    if(tab.permissionScope!=null){tab.permissionScope.revision++;tab.permissionScope.temporary.clear();}
    tab.historyScope.close();
    tabs.remove(tab);
    if (selected) {
      hideVideo();
      frame.removeAllViews();
      current = null;
    }
    tab.web.stopLoading();
    tab.web.setWebViewClient(new WebViewClient());
    tab.web.setWebChromeClient(null);
    tab.web.clearHistory();
    tab.web.destroy();
    if (tabs.isEmpty()) newTab(null);
    else if (selected) switchTab(tabs.get(Math.min(index, tabs.size() - 1)));
    else update();
  }

  void tabList() {
    List<BrowserListDialog.Row> rows = new ArrayList<>();
    for (Tab tab : new ArrayList<>(tabs))
      rows.add(
          new BrowserListDialog.Row(
              (tab == current ? "● " : "") + tab.title,
              "Regular · " + (tab.url.isEmpty()?"New tab":tab.url),
              () -> switchTab(tab),
              () -> closeTab(tab),tab.icon));
    BrowserListDialog.show(
        this,
        "Tabs · " + tabs.size(),
        rows,
        "Close tab",
        "New tab",
        () -> newTab(null),
        this::tabList);
  }

  void handleBack() {
    if (videoView != null) {
      hideVideo();
      return;
    }
    if (current != null && current.web.canGoBack()) current.web.goBack();
    else finish();
  }

  // Android 13+ uses the native callback registered in onCreate; this is for API 29–32.
  @android.annotation.SuppressLint("GestureBackNavigation")
  @Override
  public void onBackPressed() {
    handleBack();
  }

  @Override
  protected void onNewIntent(Intent i) {
    super.onNewIntent(i);
    if (i.getData() != null) go(i.getData().toString());
  }

  @Override
  protected void onActivityResult(int r, int c, Intent data) {
    super.onActivityResult(r, c, data);
    if (r == 9 && upload != null) {
      upload.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(c, data));
      upload = null;
    }
  }

  @Override
  protected void onPause() {
    hideVideo();
    super.onPause();
    CookieManager.getInstance().flush();
    for (Tab t : tabs) pauseTab(t);
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (root != null
        && !appearanceKey.equals(BrowserAppearance.key(BrowserAppearance.palette(this))))
      applyAppearance();
    for (Tab t : tabs) {if(t==current)t.web.onResume();else pauseTab(t);}
  }

  @Override
  protected void onDestroy() {
    if (popupDecision != null) popupDecision.resolve(false);
    if (popupDialog != null) popupDialog.dismiss();
    hideVideo();
    WebView.setWebContentsDebuggingEnabled(false);
    if (upload != null) upload.onReceiveValue(null);
    for (Tab t : tabs) {
      t.historyScope.close();
      t.web.stopLoading();
      t.web.destroy();
    }
    tabs.clear();
    current = null;
    worker.shutdownNow();
    if(permissions!=null)permissions.destroy();
    super.onDestroy();
  }
}
