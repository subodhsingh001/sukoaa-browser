// SPDX-License-Identifier: GPL-3.0-or-later
package com.subo.aegis;
import java.net.URI;
import java.util.Locale;
/** Pure policy: web pages cannot pass file/content URLs or privileged Intent fields. */
public final class ExternalAppPolicy {
  private ExternalAppPolicy() {}
  public static boolean youtube(String value) {
    if(!web(value))return false;
    try {String h=new URI(value).getHost().toLowerCase(Locale.ROOT);return h.equals("youtu.be") || h.equals("youtube.com") || h.endsWith(".youtube.com");}catch(Exception ignored){return false;}
  }
  public static boolean web(String value) {
    try {URI u=new URI(value);return clean(value) && "https".equalsIgnoreCase(u.getScheme()) && u.getHost()!=null && u.getUserInfo()==null;}catch(Exception ignored){return false;}
  }
  public static boolean clean(String value) {return value!=null && value.length()<=16384 && value.chars().noneMatch(c->c<32 || c==127);}
  public static boolean appData(String value) {
    if(!clean(value))return false;
    try {String s=new URI(value).getScheme();if(s==null)return false;s=s.toLowerCase(Locale.ROOT);return web(value) || s.equals("vnd.youtube") || s.equals("youtube") || s.equals("mailto") || s.equals("tel") || s.equals("sms") || s.equals("geo") || s.equals("market");}catch(Exception ignored){return false;}
  }
}
