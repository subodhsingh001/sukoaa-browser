# SPDX-License-Identifier: GPL-3.0-or-later
# Download recorded source archives; verify hashes without executing their code.
import json,urllib.request,hashlib,concurrent.futures,tarfile,os
from pathlib import Path
root=Path(__file__).resolve().parents[1]
records=json.loads((root/'compliance/npm-source-records.json').read_text())
unique={r['archive']:r for r in records}
def get(entry):
 name,r=entry;repo=r['repository'].removeprefix('https://github.com/');url='https://codeload.github.com/'+repo+'/tar.gz/'+r['gitHead'];target=root/'compliance/sources'/name
 try:
  with urllib.request.urlopen(url,timeout=45) as response,open(str(target)+'.part','wb') as f:
   size=0
   while chunk:=response.read(1048576):
    size+=len(chunk)
    if size>50_000_000:raise ValueError('archive size limit')
    f.write(chunk)
  data=Path(str(target)+'.part').read_bytes();actual=hashlib.sha256(data).hexdigest()
  if actual!=r['sha256']:raise ValueError('SHA256 differs from recorded snapshot: '+actual)
  with tarfile.open(str(target)+'.part') as t:
   members=t.getmembers();assert members;assert all(not m.name.startswith('/') and '..' not in Path(m.name).parts for m in members)
  os.replace(str(target)+'.part',target)
  return {'archive':name,'url':url,'status':'verified','sha256':actual,'bytes':len(data)}
 except Exception as e:
  Path(str(target)+'.part').unlink(missing_ok=True)
  return {'archive':name,'url':url,'status':'failed','error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 results=list(pool.map(get,unique.items()))
(root/'compliance/upstream/source-retrieval.json').write_text(json.dumps({'results':results},indent=2)+'\n')
for row in results:print(json.dumps(row))

if any(row['status']!='verified' for row in results):raise SystemExit(1)
