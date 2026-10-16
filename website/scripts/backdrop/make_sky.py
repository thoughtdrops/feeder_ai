"""Sky dome for the modeled neighborhood: the photographed sky (sun and clouds) from the processed panorama,
eased into a soft haze toward the horizon where the 3D street, houses and trees stand. Run with
python3 -I scripts/backdrop/make_sky.py public/backdrop/neighborhood-lawn-8k.jpg public/neighborhood"""
import sys
import numpy as np
from PIL import Image
src,out=sys.argv[1],sys.argv[2]
im=np.asarray(Image.open(src).convert('RGB').resize((4096,2048),Image.LANCZOS)).astype(np.float32)
H,W,_=im.shape
el=(0.5-(np.arange(H)+.5)/H)*180
top=28.0                      # above this the photo is pure sky
row=int((0.5-top/180)*H)
ref=im[row-6:row+1].mean(0)   # sky colour per column just above the tree line
# soften the reference across columns so the haze band has no vertical streaks
k=np.ones(121)/121;ref=np.stack([np.convolve(np.pad(ref[:,c],60,mode='wrap'),k,mode='valid') for c in range(3)],-1)
ref=np.minimum(ref,np.median(ref,0)*1.08)
haze=np.array([206.,218.,228.])
t=np.clip(el/top,0,1)[:,None,None]
blend=haze*(1-t**.7)+ref[None,:,:]*(t**.7)
w=np.clip((top-el)/4,0,1)[:,None,None]   # feather into the photo over 4 degrees
outimg=im*(1-w)+blend*w
outimg[el<0]=haze
img=Image.fromarray(np.clip(outimg,0,255).astype(np.uint8))
img.save(out+'/sky-4k.jpg',quality=85,optimize=True,progressive=True)
img.resize((2048,1024),Image.LANCZOS).save(out+'/sky-2k.jpg',quality=85,optimize=True,progressive=True)
print('ok')
