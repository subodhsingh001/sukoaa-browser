# SPDX-License-Identifier: GPL-3.0-or-later
# Retain published POM license declarations; these are not legal conclusions.
import json,urllib.request,urllib.error,hashlib,concurrent.futures,xml.etree.ElementTree as ET,zipfile,io
from pathlib import Path
r=Path(__file__).resolve().parents[1];out=r/'compliance/android-poms';out.mkdir(exist_ok=True)
rows=json.loads((r/'compliance/android-runtime.json').read_text())['artifacts'];unique={x['group']+':'+x['name']+':'+x['version']:x for x in rows}
def capture(pair):
 key,x=pair;group=x['group'];base='https://dl.google.com/dl/android/maven2/' if group.startswith(('androidx.','com.google.android.gms')) else 'https://maven.mozilla.org/maven2/' if group=='org.mozilla.geckoview' else 'https://repo.maven.apache.org/maven2/'
 url=base+group.replace('.','/')+'/'+x['name']+'/'+x['version']+'/'+x['name']+'-'+x['version']+'.pom';file=out/(group+'-'+x['name']+'-'+x['version']+'.pom')
 try:
  with urllib.request.urlopen(url,timeout=18) as response: data=response.read(1000001)
  if len(data)>1000000:raise ValueError('POM size limit')
  node=ET.fromstring(data);ns={'m':'http://maven.apache.org/POM/4.0.0'}
  licenses=[{'name':v.findtext('m:name',default='',namespaces=ns),'url':v.findtext('m:url',default='',namespaces=ns)}for v in node.findall('m:licenses/m:license',ns)]
  file.write_bytes(data)
  return {'coordinate':key,'url':url,'pom':str(file.relative_to(r)),'sha256':hashlib.sha256(data).hexdigest(),'declaredLicenses':licenses,'status':'metadata-captured','review':'required; metadata is not source or legal clearance'}
 except Exception as e:return {'coordinate':key,'url':url,'status':'unresolved','error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as p:results=list(p.map(capture,unique.items()))
report={'format':'sukoaa-android-pom-inventory-v1','releaseVersion':'0.9.0','runtimeArtifactCount':len(rows),'uniqueCoordinates':len(results),'results':results,'completeSourceBundle':False}
(r/'compliance/android-license-metadata.json').write_text(json.dumps(report,indent=2)+'\n')
print({'captured':sum(x['status']=='metadata-captured' for x in results),'unresolved':sum(x['status']=='unresolved' for x in results),'withoutDirectLicense':sum(x['status']=='metadata-captured' and not x['declaredLicenses']for x in results)})
for x in results:
 if x['coordinate'].startswith('com.google.android.gms') or x['status']=='unresolved':print(json.dumps(x))

if any(row['status']!='metadata-captured' for row in results):raise SystemExit(1)
