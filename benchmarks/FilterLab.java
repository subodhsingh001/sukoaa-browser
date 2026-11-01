import com.subo.aegis.FilterRules;
import java.net.URI;
import java.nio.file.*;
import java.util.*;

/** Same-process lookup microbenchmark and deliberately small curated coverage corpus. */
public class FilterLab {
  static volatile int sink;
  static final String[] ads={
    "https://pagead2.googlesyndication.com/pagead/ads", "https://googleads.g.doubleclick.net/pagead/ads",
    "https://securepubads.g.doubleclick.net/gampad/ads", "https://ib.adnxs.com/adj",
    "https://ads.pubmatic.com/AdServer/js/pubmatic.js", "https://bidder.criteo.com/cdb",
    "https://adservice.google.com/adsid/integrator.js", "https://c.amazon-adsystem.com/aax2/apstag.js",
    "https://ad.doubleclick.net/ddm/ad", "https://pixel.rubiconproject.com/tap.php",
    "https://pagead2.googlesyndication.com./pagead/ads", "https://GOOGLEADS.G.DOUBLECLICK.NET/pagead/ads"};
  static final String[] ordinary={
    "https://www.msn.com/en-in/news/world/example/ar-AA123", "https://img-s-msn-com.akamaized.net/tenant/amp/entityid/image.img",
    "https://en.wikipedia.org/wiki/Browser", "https://github.com/openai",
    "https://fonts.gstatic.com/s/roboto/font.woff2", "https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js",
    "https://images.unsplash.com/photo-123", "https://www.bbc.com/news/article",
    "https://cdn.jsdelivr.net/npm/example/index.js", "https://example.org/?redirect=doubleclick.net",
    "https://notdoubleclick.net/content.js", "https://support.google.com/chrome/answer/9275525"};
  static final String[] limits={"https://news.example.org/sponsored/native-card.js", "https://unlisted-sponsor-876.example/promo.js"};
  static String quote(String s){return "\""+s.replace("\\","\\\\").replace("\"","\\\"")+"\"";}
  static String cases(FilterRules r,String[] urls){List<String> rows=new ArrayList<>();for(String u:urls)rows.add("{\"url\":"+quote(u)+",\"blocked\":"+r.blocks(u)+"}");return "["+String.join(",",rows)+"]";}
  static double batch(FilterRules r,String[] urls,String[] hosts,String[] paths,boolean direct,int repeats){long start=System.nanoTime();int n=0;for(int i=0;i<repeats;i++)for(int j=0;j<urls.length;j++)if(direct?r.blocksRequest(hosts[j],paths[j]):r.blocks(urls[j]))n++;sink=n;return (System.nanoTime()-start)/(double)(repeats*urls.length);}
  static double median(List<Double> a){Collections.sort(a);return a.get(a.size()/2);}
  public static void main(String[] args)throws Exception{
    FilterRules rules=new FilterRules(Files.readAllLines(Path.of(args[0])));
    String[] urls=new String[ads.length+ordinary.length];System.arraycopy(ads,0,urls,0,ads.length);System.arraycopy(ordinary,0,urls,ads.length,ordinary.length);
    String[] hosts=new String[urls.length], paths=new String[urls.length];for(int i=0;i<urls.length;i++){URI u=new URI(urls[i]);hosts[i]=u.getHost();paths[i]=u.getPath();}
    for(int i=0;i<6;i++){batch(rules,urls,hosts,paths,false,3000);batch(rules,urls,hosts,paths,true,3000);}
    List<Double> parsing=new ArrayList<>(),direct=new ArrayList<>();
    for(int i=0;i<9;i++){if(i%2==0){parsing.add(batch(rules,urls,hosts,paths,false,10000));direct.add(batch(rules,urls,hosts,paths,true,10000));}else{direct.add(batch(rules,urls,hosts,paths,true,10000));parsing.add(batch(rules,urls,hosts,paths,false,10000));}}
    String out="{\"domains\":"+rules.size()+",\"knownAds\":"+cases(rules,ads)+",\"ordinaryControls\":"+cases(rules,ordinary)+",\"intentionalLimits\":"+cases(rules,limits)+",\"urlParseMedianNs\":"+median(parsing)+",\"alreadyParsedRequestMedianNs\":"+median(direct)+",\"batches\":9,\"lookupsPerBatch\":"+(urls.length*10000)+",\"runtime\":"+quote(System.getProperty("java.runtime.version"))+",\"limits\":\"JVM host lookup only, not Android page loading or a browser ranking. Curated URLs are not a representative internet-wide ad corpus.\"}";
    Files.writeString(Path.of(args[1]),out);System.out.println(out);
  }
}
