# SPDX-License-Identifier: GPL-3.0-or-later
"""Render the project's S shield geometry at multiple icon sizes (Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1]
scale = 4
image = Image.new('RGBA', (512*scale, 512*scale), (0,0,0,0))
draw = ImageDraw.Draw(image)
def box(values): return tuple(round(v*scale) for v in values)
draw.rounded_rectangle(box((0,0,511,511)), radius=110*scale, fill='#14212c')
draw.rounded_rectangle(box((20,20,492,492)), radius=94*scale, outline='#274234', width=2*scale)
def point(p): return (round((112+p[0]*12)*scale), round((110+p[1]*12)*scale))
def curve(a,b,c,d):
    return [tuple((1-t)**3*a[i]+3*(1-t)**2*t*b[i]+3*(1-t)*t*t*c[i]+t**3*d[i] for i in (0,1)) for t in [n/80 for n in range(81)]]
outline=[(12,2),(21,6),(21,12)]+curve((21,12),(21,17),(12,22),(12,22))+curve((12,22),(12,22),(3,17),(3,12))+[(3,6),(12,2)]
ink='#a1e8d1';width=round(1.35*12*scale)
draw.line([point(p) for p in outline], fill=ink, width=width, joint='curve')
draw.line([point((16,8)),point((10,8))],fill=ink,width=width)
def arc(bounds,start,end):
    a=point(bounds[:2]);b=point(bounds[2:]);draw.arc((*a,*b),start,end,fill=ink,width=width)
arc((8,8,12,12),90,270)
draw.line([point((10,12)),point((14,12))],fill=ink,width=width)
arc((12,12,16,16),270,450)
draw.line([point((14,16)),point((8,16))],fill=ink,width=width)
image=image.resize((512,512),Image.Resampling.LANCZOS)
image.save(root/'desktop/assets/aegis.png')
image.save(root/'desktop/assets/aegis.ico',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('Sukoaa S shield PNG/ICO rendered from project geometry')
