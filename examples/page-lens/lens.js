(() => {
  if (document.getElementById("aegis-page-lens")) return;
  const host = document.createElement("div");
  host.id = "aegis-page-lens";
  host.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:2147483647";
  const shadow = host.attachShadow({mode:"open"});
  const style = document.createElement("style");
  style.textContent = "*{box-sizing:border-box}button{cursor:pointer;background:#142c26;color:#d4ffed;border:1px solid #83c7b0;border-radius:12px;padding:11px;font:13px system-ui}section{background:#142c26;color:#d4ffed;border:1px solid #83c7b0;padding:16px;border-radius:12px;margin-bottom:8px;width:240px;font:14px/1.6 system-ui}section[hidden]{display:none}";
  const panel = document.createElement("section"); panel.hidden=true;
  const toggle = document.createElement("button"); toggle.textContent="Page Lens";
  toggle.setAttribute("aria-expanded","false");
  toggle.onclick=()=>{
    panel.hidden=!panel.hidden;
    toggle.setAttribute("aria-expanded",String(!panel.hidden));
    const text=(document.body?.innerText || "").trim();
    const words=text ? text.split(/\s+/).length : 0;
    panel.textContent=`${words.toLocaleString()} words · about ${Math.max(1,Math.ceil(words/200))} min reading. Viewport: ${innerWidth} × ${innerHeight}. ${document.links.length} links.`;
  };
  shadow.append(style,panel,toggle);document.documentElement.append(host);
})();
