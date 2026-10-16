import numpy as np,sys
from PIL import Image
src,out=sys.argv[1],sys.argv[2]
a,b=0.262,0.738
im=np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
H,W,_=im.shape
xs=(np.arange(W)+.5)/W
# Columns outside the street-facing span take the span mirrored, so both seams line up.
span=b-a;back=1-span
t=((xs-b)%1)/back
srcu=np.where((xs>=a)&(xs<=b),xs,b-t*span)
col=np.clip((srcu*W-.5),0,W-1)
c0=np.floor(col).astype(int);c1=np.minimum(c0+1,W-1);f=(col-c0)[None,:,None]
out_img=im[:,c0]*(1-f)+im[:,c1]*f
# The mirror also copies the sun. Replace that copy with sky from 0.16 turn further round (sun-free),
# brightened to match the glow ring around it, feathered so no edge shows.
el=(0.5-(np.arange(H)+.5)/H)*180
sun_u,sun_el=0.684,32.6
mu=b+(b-sun_u)/span*back
du=((xs-mu+.5)%1-.5)*360*np.cos(np.radians(sun_el))
dist=np.sqrt(du[None,:]**2+(el[:,None]-sun_el)**2)
shift=int(.16*W);fill=np.roll(out_img,-shift,axis=1)
ring=(dist>13)&(dist<16)
gain=out_img[ring].mean(0)/np.maximum(fill[ring].mean(0),1)
fill=fill*gain
w=np.clip((14-dist)/7,0,1)[:,:,None]
out_img=out_img*(1-w)+fill*w
Image.fromarray(np.clip(out_img,0,255).astype(np.uint8)).save(out)
print('mirrored sun at u',mu)
