"""Original repeatable wallpaper prints and photo-grain sheet-vinyl patterns.

Wallpaper artwork is authored here. Wood grain is the existing credited CC0
oak texture. Assets are baked into source; no remote image service is needed.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageOps
import numpy as np
import math, json

ROOT=Path(__file__).resolve().parents[1]
W=768
names=[
 ('Regency olive stripe','stripe','#ece1c8','#65724b','#b8a16b'),
 ('Rose trellis','trellis','#f0dfd8','#9c5365','#80916b'),
 ('Jacobean tapestry','jacobean','#1e4542','#cea872','#87a69a'),
 ('Gilded acanthus','acanthus','#323835','#d1b674','#87937b'),
 ('Pearl scallop','scallop','#e7e3d8','#869fa2','#b5a482'),
 ('Palais diamonds','diamonds','#d8e2d7','#496957','#c4a463'),
 ('Versailles medallion','medallion','#e5cfbb','#92575a','#bc965e'),
 ('Antique fern','fern','#e2e4cb','#50715b','#a89c68'),
 ('Emerald Deco fan','fan','#1d4540','#c8ad6a','#527a6b'),
 ('Rosette lattice','rosette','#e3e1dc','#566b82','#bfa469'),
 ('Wisteria garden','wisteria','#e0e5df','#79769c','#829a75'),
 ('Willow chinoiserie','willow','#e4e8dc','#566f68','#a79a64'),
 ('Sapphire paisley','paisley','#283a5c','#b6ccda','#cdb076'),
 ('Dahlia damask','dahlia','#decacb','#9e5967','#c4a074'),
 ('Champagne arch','arches','#e8ddc8','#b5a070','#a9b8a2'),
 ('Tudor fleur-de-lis','fleur','#5a586e','#dac594','#9691a0'),
 ('Amalfi citrus','citrus','#e8edcf','#dfa847','#52815a'),
 ('Fuchsia arabesque','arabesque','#eadbdc','#a5436d','#c39d65'),
 ('Delft bouquet','bouquet','#e3e6e0','#537193','#8ca0b8'),
 ('Black-gold sunburst','sunburst','#252c30','#c7a65f','#71765b'),
 ('Sage gingham','gingham','#e5e5cf','#849c7b','#b0b994'),
 ('Coral ogee','ogee','#ebddcf','#c47f72','#8da58c'),
 ('Moonstone chevron','chevron','#dde2e0','#789b9c','#c1ac83'),
 ('Lilac quatrefoil','quatrefoil','#e5dfe9','#9b83ae','#b6a578'),
 ('Peacock feather','feather','#1b5355','#76aeb0','#d3b369'),
 ('Terracotta blockprint','blockprint','#e7d8c3','#b47351','#718d73'),
 ('Magnolia garden','magnolia','#d9e5de','#eef0d7','#6c8d71'),
 ('Navy Greek key','greek','#e1dfd0','#3e5876','#b99e6b'),
 ('Golden bamboo','bamboo','#e5e1bf','#788e67','#c6a153'),
 ('Celadon blossoms','blossom','#d9e6de','#a17882','#6e9a82'),
]

def flower(draw,x,y,r,fill,center,petals=8,twist=0):
 for i in range(petals):
  a=i*2*math.pi/petals+twist
  points=[]
  for t in np.linspace(0,2*math.pi,35):
   xx=r*.53+r*.51*math.cos(t);yy=r*.25*math.sin(t)
   points.append((x+xx*math.cos(a)-yy*math.sin(a),y+xx*math.sin(a)+yy*math.cos(a)))
  draw.polygon(points,fill=fill)
 draw.ellipse((x-r*.17,y-r*.17,x+r*.17,y+r*.17),fill=center)

def leaf(draw,x,y,r,a,color):
 pts=[]
 for t in np.linspace(0,2*math.pi,24):
  u=r*math.cos(t);v=r*.34*math.sin(t)
  pts.append((x+u*math.cos(a)-v*math.sin(a),y+u*math.sin(a)+v*math.cos(a)))
 draw.polygon(pts,fill=color)

def line(draw,pts,color,width=3):draw.line(pts,fill=color,width=width,joint='curve')
def wallpaper(kind,bg,ink,accent):
 image=Image.new('RGB',(W,W),bg);d=ImageDraw.Draw(image);s=W/3
 for row in range(-1,5):
  for col in range(-1,5):
   x=col*s+(s/2 if row%2 else 0);y=row*s;r=s*.34
   if kind=='stripe':
    d.rectangle((col*s,0,col*s+s*.22,W),fill=ink)
    for yy in range(-60,W+70,64):flower(d,col*s+s*.6,yy,13,accent,ink,4)
   elif kind in ['trellis','diamonds']:
    line(d,[(x-r,y),(x,y-r),(x+r,y),(x,y+r),(x-r,y)],ink,3 if kind=='trellis' else 8)
    flower(d,x,y,r*.42,accent,ink,5 if kind=='trellis' else 4,math.pi/4)
   elif kind in ['jacobean','acanthus','arabesque']:
    pts=[(x+math.sin(t*2*math.pi)*r*.48,y-r+t*r*2)for t in np.linspace(0,1,65)];line(d,pts,accent,4)
    for i in range(5):
     yy=y-r+i*r*.47;xx=x+math.sin(i*.74)*r*.35
     leaf(d,xx-r*.36,yy,r*.45,-.8,ink);leaf(d,xx+r*.34,yy+r*.1,r*.43,.8,ink)
    flower(d,x,y-r,r*.4,accent,ink,6 if kind=='jacobean' else 9 if kind=='acanthus' else 4)
   elif kind=='scallop':
    for rr in [r,r*.79,r*.58]:d.arc((x-rr,y-rr,x+rr,y+rr),0,180,fill=ink,width=3)
    d.ellipse((x-4,y-4,x+4,y+4),fill=accent)
   elif kind=='medallion':
    for rr in [r,r*.90,r*.70]:d.ellipse((x-rr,y-rr*1.28,x+rr,y+rr*1.28),outline=accent,width=3)
    flower(d,x,y,r*.63,ink,accent,12)
   elif kind=='fern':
    line(d,[(x,y+r),(x,y-r)],accent,3)
    for i in range(8):
     yy=y-r+i*r*.25;rr=r*(.22+.65*math.sin(i/8*math.pi))
     leaf(d,x-rr*.6,yy,rr,.6,ink);leaf(d,x+rr*.6,yy,rr,-.6,ink)
   elif kind=='fan':
    for rr in [r,r*.84,r*.67]:d.arc((x-rr,y-rr,x+rr,y+rr),180,360,fill=accent,width=3)
    for a in np.linspace(math.pi,2*math.pi,11):line(d,[(x,y),(x+r*math.cos(a),y+r*math.sin(a))],ink,4)
   elif kind=='rosette':
    line(d,[(x-s/2,y),(x,y-s/2),(x+s/2,y)],ink,3);flower(d,x,y,r*.5,accent,ink,10)
   elif kind=='wisteria':
    line(d,[(x-r,y-r),(x,y-r*.55),(x+r,y-r)],accent,4)
    for j in range(4):
     xx=x-r*.55+j*r*.36
     for i in range(7-j%2):d.ellipse((xx-9+i*.7,y-r*.6+i*16,xx+9-i*.7,y-r*.6+i*16+22),fill=ink)
   elif kind=='willow':
    line(d,[(x-r,y+r),(x,y-r),(x+r,y+r)],accent,3)
    for a in np.linspace(-2.8,-.3,9):leaf(d,x+math.cos(a)*r,y+math.sin(a)*r,r*.27,a+.8,ink)
    for i in range(6):line(d,[(x-r*.7+i*r*.28,y-r*.4),(x-r*.85+i*r*.28,y+r*.7)],ink,2)
   elif kind=='paisley':
    pts=[(x+math.sin(a)*r*.57,y+math.cos(a)*r)for a in np.linspace(0,math.pi*1.9,65)]+[(x+r*.7,y-r*.75)]
    d.polygon(pts,fill=ink);flower(d,x,y+r*.14,r*.32,accent,bg,7)
    d.arc((x-r*.4,y-r*.5,x+r*.4,y+r*.75),40,320,fill=accent,width=3)
   elif kind=='dahlia':
    flower(d,x,y,r,ink,accent,16);flower(d,x,y,r*.66,accent,bg,12,.18);flower(d,x,y,r*.32,ink,bg,8)
   elif kind=='arches':
    for xx in [x-r*.68,x+r*.68]:line(d,[(xx,y+r),(xx,y-r*.15)],ink,4)
    d.arc((x-r*.68,y-r*.82,x+r*.68,y+r*.52),180,360,fill=ink,width=4);leaf(d,x,y+r*.1,r*.48,-math.pi/2,accent)
   elif kind=='fleur':
    leaf(d,x,y-r*.5,r*.52,-math.pi/2,accent);leaf(d,x-r*.4,y,r*.5,-.7,accent);leaf(d,x+r*.4,y,r*.5,.7,accent)
    line(d,[(x-r*.37,y+r*.25),(x+r*.37,y+r*.25)],ink,6);d.polygon([(x,y+r*.7),(x-r*.25,y+r*.3),(x+r*.25,y+r*.3)],fill=accent)
   elif kind=='citrus':
    line(d,[(x-r,y+r),(x+r,y-r)],ink,3)
    for dx,dy in [(-.5,-.2),(.6,.1)]:leaf(d,x+r*dx,y+r*dy,r*.4,-.6,ink)
    d.ellipse((x-r*.34,y-r*.4,x+r*.34,y+r*.4),fill=accent);d.ellipse((x-r*.16,y-r*.26,x,y-r*.08),fill='#f4c868')
   elif kind=='bouquet':
    for xx,yy in [(-.4,-.3),(.4,-.2),(0,-.6)]:line(d,[(x,y+r),(x+xx*r,y+yy*r)],accent,3);flower(d,x+xx*r,y+yy*r,r*.35,ink,bg,7)
    leaf(d,x-r*.35,y+r*.45,r*.38,-.7,accent);leaf(d,x+r*.3,y+r*.35,r*.4,.7,accent)
   elif kind=='sunburst':
    for a in np.linspace(0,2*math.pi,25):line(d,[(x+math.cos(a)*r*.3,y+math.sin(a)*r*.3),(x+math.cos(a)*r,y+math.sin(a)*r)],accent,3)
    d.ellipse((x-r*.2,y-r*.2,x+r*.2,y+r*.2),fill=ink)
   elif kind=='gingham':
    d.rectangle((col*s,row*s,col*s+s/2,row*s+s/2),fill=ink);d.rectangle((col*s+s/2,row*s+s/2,col*s+s,row*s+s),fill=accent)
   elif kind=='ogee':
    for side in [-1,1]:line(d,[(x+side*math.sin(t*math.pi)*r,y-r+t*r*2)for t in np.linspace(0,1,60)],ink,4)
    flower(d,x,y,r*.35,accent,ink,6)
   elif kind=='chevron':
    for i in range(4):line(d,[(x-s/2,y+i*25),(x,y-r*.6+i*25),(x+s/2,y+i*25)],ink if i%2 else accent,8)
   elif kind=='quatrefoil':
    for dx,dy in [(0,-.4),(.4,0),(0,.4),(-.4,0)]:d.ellipse((x+dx*r-r*.5,y+dy*r-r*.5,x+dx*r+r*.5,y+dy*r+r*.5),outline=ink,width=4)
    d.ellipse((x-6,y-6,x+6,y+6),fill=accent)
   elif kind=='feather':
    line(d,[(x,y+r),(x,y-r*.5)],accent,3)
    for i in range(10):
     yy=y-r*.7+i*r*.17;rr=r*math.sin((i+1)/12*math.pi)*.62
     line(d,[(x-rr,yy-r*.15),(x,yy+r*.1),(x+rr,yy-r*.15)],ink,3)
    for rr,cc in [(r*.28,accent),(r*.19,ink),(r*.1,bg)]:d.ellipse((x-rr,y-r*.55-rr,x+rr,y-r*.55+rr),fill=cc)
   elif kind=='blockprint':
    flower(d,x,y,r*.65,ink,accent,6);for_pts=[(x-s/2,y),(x,y-s/2),(x+s/2,y),(x,y+s/2)]
    for xx,yy in for_pts:leaf(d,xx,yy,r*.28,math.pi/4,accent)
   elif kind=='magnolia':
    line(d,[(x-r,y+r),(x+r,y-r)],accent,4);flower(d,x,y,r*.64,ink,'#d4b879',6,.3)
    for dx,dy in [(-.75,.4),(.7,-.45)]:leaf(d,x+dx*r,y+dy*r,r*.4,-.6,accent)
   elif kind=='greek':
    for off in [0,s/2]:line(d,[(x-r,y+off),(x+r,y+off),(x+r,y-r+off),(x-r*.2,y-r+off),(x-r*.2,y-r*.3+off),(x+r*.4,y-r*.3+off)],ink,7)
   elif kind=='bamboo':
    line(d,[(x,y-r*1.4),(x,y+r*1.4)],accent,9)
    for yy in [y-r*.7,y,y+r*.7]:line(d,[(x-7,yy),(x+7,yy)],ink,3);leaf(d,x+r*.4,yy-r*.3,r*.46,-.6,ink);leaf(d,x-r*.4,yy+r*.3,r*.46,-.6,ink)
   elif kind=='blossom':
    line(d,[(x-r,y+r*.7),(x+r,y-r*.6)],accent,3)
    for dx,dy in [(-.6,.3),(.1,0),(.65,-.4)]:flower(d,x+dx*r,y+dy*r,r*.29,ink,bg,5)
 rng=np.random.default_rng(162);a=np.array(image).astype(np.int16);noise=rng.normal(0,1.5,(W,W,1));a=np.clip(a+noise,0,255).astype('uint8');return Image.fromarray(a)

out=ROOT/'public/materials/wallpaper';out.mkdir(parents=True,exist_ok=True)
catalog=json.loads((ROOT/'rust-app/data/catalog.json').read_text())
catalog['wallpapers']=catalog['wallpapers'][:13]
for i,(name,kind,bg,ink,accent) in enumerate(names,14):
 file=f'{i:02d}-{kind}.webp';image=wallpaper(kind,bg,ink,accent);image.save(out/file,quality=92)
 mobile=ROOT/'public/mobile/materials/wallpaper'/file;mobile.parent.mkdir(parents=True,exist_ok=True);image.resize((512,512),Image.Resampling.LANCZOS).save(mobile,quality=88)
 catalog['wallpapers'].append(dict(name=name,file=file,price=3.2+(i%7)*.3,bright=True,family=kind))
catalog['options']['wallpaper']=['None']+[p['name']for p in catalog['wallpapers']]

grain=Image.open(ROOT/'public/materials/oak-diff.jpg').convert('RGB')
floor_specs=[
 ('Honey oak plank vinyl','plank','#bc925b'),('Pearl oak plank vinyl','plank','#c7bda9'),('Smoked walnut plank vinyl','plank','#655341'),('Silver ash plank vinyl','plank','#a5a5a0'),('Warm maple plank vinyl','plank','#bfa37b'),('Espresso plank vinyl','plank','#514738'),('Driftwood plank vinyl','plank','#948d78'),('Amber pine plank vinyl','plank','#c59b5e'),
 ('Natural oak herringbone vinyl','herringbone','#b79b74'),('Walnut herringbone vinyl','herringbone','#826d52'),('Pearl herringbone vinyl','herringbone','#c1bfb0'),('Golden herringbone vinyl','herringbone','#bca065'),('Gray herringbone vinyl','herringbone','#9b9d99'),('Sable herringbone vinyl','herringbone','#71634e'),
 ('Oak basketweave vinyl','parquet','#b99b6e'),('Walnut parquet vinyl','parquet','#8e7859'),('Bleached parquet vinyl','parquet','#c2baaa'),('Honey Versailles vinyl','versailles','#b39d76'),
 ('Cream terrazzo vinyl','terrazzo','#d3cfc0'),('Blush terrazzo vinyl','terrazzo','#d0bdb4'),('Charcoal terrazzo vinyl','terrazzo','#7c807b'),
 ('Carrara checker vinyl','checker','#d3d7d0'),('Warm limestone vinyl','stone','#c4b69a'),('Slate mosaic vinyl','stone','#87978d'),
]
floor_dir=ROOT/'public/materials/vinyl';floor_dir.mkdir(parents=True,exist_ok=True);floors=[]
for k,(name,kind,color)in enumerate(floor_specs):
 rng=np.random.default_rng(901+k);im=Image.new('RGB',(W,W),color);draw=ImageDraw.Draw(im)
 def plank(x,y,ww,hh,vertical=False):
  gx=int(rng.integers(0,max(1,grain.width-240)));gy=int(rng.integers(0,max(1,grain.height-400)));src=grain.crop((gx,gy,gx+240,gy+400));src=ImageOps.grayscale(src);src=ImageOps.colorize(src,'#343129',color);src=ImageEnhance.Brightness(src).enhance(float(rng.uniform(.87,1.14)));src=src.resize((ww,hh),Image.Resampling.LANCZOS);src=src.rotate(90,expand=True).resize((ww,hh))if vertical else src;im.paste(src,(x,y));ImageDraw.Draw(im).rectangle((x,y,x+ww-1,y+hh-1),outline='#84735e',width=1)
 if kind=='plank':
  for row in range(6):
   for col in range(-1,3):plank(col*384+(row%2)*192,row*128,384,128)
 elif kind=='herringbone':
  # Classify every pixel into a horizontal/vertical domino plank before
  # rotating its coordinates. This tiles the entire surface without holes
  # or empty triangle borders from rotating a finite cropped image.
  yy,xx=np.indices((W,W));uf=(xx+yy)*4/W;vf=(yy-xx)*4/W
  uu=np.floor(uf).astype(int);vv=np.floor(vf).astype(int);r=(uu+vv)%4;horizontal=r<2
  fx=uf-uu;fy=vf-vv;along=np.where(horizontal,(r+fx)/2,(r-2+fy)/2);across=np.where(horizontal,fy,fx)
  patch=ImageOps.colorize(ImageOps.grayscale(grain.crop((80,80,320,480))),'#343129',color).resize((512,256),Image.Resampling.LANCZOS)
  samples=np.asarray(patch)[np.minimum((across*256).astype(int),255),np.minimum((along*512).astype(int),511)].astype(float)
  bx=np.where(horizontal,uu-r,uu)%4;by=np.where(horizontal,vv,vv-(r-2))%4
  tone=1+(((bx*71+by*131+k)%9)-4)*.026;samples*=tone[:,:,None]
  seam=(horizontal&((fy<.008)|((r==0)&(fx<.008))))|(~horizontal&((fx<.008)|((r==2)&(fy<.008))))
  samples[seam]*=.72;im=Image.fromarray(np.uint8(np.clip(samples,0,255)))
 elif kind in ['parquet','versailles']:
  for row in range(4):
   for col in range(4):
    for b in range(3):
     if (row+col)%2:plank(col*192+b*64,row*192,64,192,True)
     else:plank(col*192,row*192+b*64,192,64)
  if kind=='versailles':
   draw=ImageDraw.Draw(im)
   for row in range(4):
    for col in range(4):draw.rectangle((col*192+8,row*192+8,col*192+184,row*192+184),outline='#726347',width=10)
 elif kind=='terrazzo':
  for j in range(4800):
   x=int(rng.integers(W));y=int(rng.integers(W));r=int(rng.integers(2,8));fill=['#ede7d9','#9d9685','#b5a084','#687870','#c7b3a0'][j%5];draw.polygon([(x,y),(x+r,y-2),(x+r+3,y+r),(x-2,y+r+2)],fill=fill)
 else:
  size=192 if kind=='checker' else 128 if k==23 else 384
  for row in range(W//size):
   for col in range(W//size):
    fill='#4f615d'if kind=='checker'and(row+col)%2 else color;draw.rectangle((col*size+2,row*size+2,(col+1)*size-2,(row+1)*size-2),fill=fill)
    for j in range(16):
     x=col*size+int(rng.integers(size));y=row*size+int(rng.integers(size));line(draw,[(x,y),(x+size*.18,y+size*.09),(x+size*.25,y+size*.24)],'#8f998e'if fill!=color else '#bdc1b5',1)
 file=f'{k+1:02d}-{kind}.webp';im.save(floor_dir/file,quality=92);mobile=ROOT/'public/mobile/materials/vinyl'/file;mobile.parent.mkdir(parents=True,exist_ok=True);im.resize((512,512),Image.Resampling.LANCZOS).save(mobile,quality=88)
 floors.append(dict(name=name,file=file,kind=kind,repeatFeet=8 if kind in ['plank','herringbone','parquet','versailles']else 4,price=2.7+(.7 if kind in ['herringbone','parquet','versailles']else 0)))
catalog['options']['floor']=[n for n in catalog['options']['floor']if not n.endswith(' vinyl')]+[f['name']for f in floors]
(ROOT/'rust-app/data/vinyl.json').write_text(json.dumps(floors,indent=2)+'\n')
(ROOT/'rust-app/data/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')))
sheet=Image.new('RGB',(1000,6*170),'#c6cbca');dr=ImageDraw.Draw(sheet)
for i,(name,kind,bg,ink,accent)in enumerate(names):
 x=i%5*200;y=i//5*170;sheet.paste(Image.open(out/f'{i+14:02d}-{kind}.webp').resize((180,140)),(x+10,y));dr.text((x+6,y+144),name,fill='#22392c')
sheet.save(ROOT/'work/new-wallpaper-contact.jpg')
print(f'Created {len(names)} original wallpapers and {len(floors)} vinyl patterns with mobile assets.')
