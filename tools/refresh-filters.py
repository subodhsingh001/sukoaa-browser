# SPDX-License-Identifier: GPL-3.0-or-later
from pathlib import Path
import urllib.request, re
root=Path(__file__).resolve().parents[1]
texts=[]
for name in ["easylist", "easyprivacy"]:
    with urllib.request.urlopen(f"https://easylist.to/easylist/{name}.txt", timeout=40) as response:
        text=response.read(12000001).decode("utf-8")
    if len(text)>12000000 or "[Adblock" not in text or len(text)<10000:
        raise ValueError("Invalid list")
    (root/"shared"/f"{name}.txt").write_text(text)
    texts.append(text)
text="\n".join(texts)
blocked=set(re.findall(r"^\|\|([a-z0-9.-]+)\^\s*$",text,re.M))
allowed=set(re.findall(r"^@@\|\|([a-z0-9.-]+)\^",text,re.M))
def excepted(host):
    while True:
        if host in allowed: return True
        if "." not in host: return False
        host=host.split(".",1)[1]
hosts=sorted(h for h in blocked if not excepted(h))
for path in [root/"shared/domains.txt", root/"android/app/src/main/assets/domains.txt"]:
    path.write_text("\n".join(hosts)+"\n")
print(f"Updated {len(hosts)} domain rules")
