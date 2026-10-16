import numpy as np,sys
from PIL import Image, ImageFilter
src=Image.open(sys.argv[1]).convert('RGB');out_dir=sys.argv[2];prev=sys.argv[3]
W,H=src.size;k=W//4096
up=src  # full-resolution original: no resampling
a=np.asarray(up).astype(np.float32)/255
r,g,b=a[...,0],a[...,1],a[...,2];mx=a.max(-1);mn=a.min(-1);d=mx-mn+1e-6
hue=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60;sat=d/(mx+1e-6)
dirtpx=(hue>10)&(hue<52)&(sat>.22)
horizon=H//2
start=np.zeros(W,np.float32)
# The lot is the dirt that runs from some row down to the nadir: find, per column, the first row
# below which the column stays dirt-coloured (ignores beige siding and stray brown patches).
lo,hi=horizon+20,H-40
for x in range(W):
    col=dirtpx[lo:hi,x].astype(float);run=np.convolve(np.pad(col,12*k,mode='edge'),np.ones(25*k)/(25*k),mode='valid')
    ok=run>0.55;tail=np.flip(np.cumprod(np.flip(ok)))  # rows from which everything below is dirt-ish
    idx=np.where(tail>0)[0];start[x]=lo+(idx.min() if len(idx) else hi-lo)
p=np.pad(start,30*k,mode='wrap');start=np.array([np.median(p[i:i+61*k]) for i in range(W)],np.float32)
kk=np.ones(31*k)/(31*k);start=np.convolve(np.pad(start,(31*k//2,31*k-1-31*k//2),mode='wrap'),kk,mode='valid')-4*k
# Behind and beside the lot (outside the street-facing span) there is no street: lawn runs from the lot up to
# the neighbours' houses, whose bases sit about 6 degrees below the horizon. Ramp in over a few degrees.
sa,sb=0.262,0.738;u=(np.arange(W)+.5)/W
dout=np.minimum(np.abs(((u-sa+.5)%1)-.5),np.abs(((u-sb+.5)%1)-.5))
inside=(u>sa)&(u<sb)
ramp=np.where(inside,0.,np.clip(dout/0.07,0,1))**1.5
far=horizon+6.4/180*H
start=start*(1-ramp)+np.minimum(start,far)*ramp
g=Image.open('public/materials/grass-diff.jpg').convert('RGB');gw=g.width
mips=[np.asarray(g).astype(np.float32)/255]
while mips[-1].shape[0]>8:
    t=Image.fromarray((mips[-1]*255).astype(np.uint8));mips.append(np.asarray(t.resize((t.width//2,t.height//2),Image.LANCZOS)).astype(np.float32)/255)
cam=5.5*3;tile=4.59
ys=np.arange(horizon+1,H);xs=np.arange(W);phi=(xs+.5)/W*2*np.pi
theta=((ys+.5)/H-.5)*np.pi;dist=cam/np.tan(theta)
dx=-np.cos(phi);dz=-np.sin(phi);grass=np.zeros((len(ys),W,3),np.float32)
for i,dd in enumerate(dist):
    foot=dd*(2*np.pi/W)*max(1,0.5/np.sin(theta[i]));lvl=int(np.clip(np.log2(max(foot/(tile/gw),1)),0,len(mips)-1));m=mips[lvl];mh,mw=m.shape[:2]
    grass[i]=m[(dz*dd/tile*mh).astype(int)%mh,(dx*dd/tile*mw).astype(int)%mw]
xx=dx[None,:]*dist[:,None];zz=dz[None,:]*dist[:,None]
n=.5+.25*np.sin(xx*.021+np.cos(zz*.017)*2)+.25*np.sin(zz*.029+xx*.011);shade=(.88+n*.16)
grass*=np.stack([shade,shade,shade],-1)
# Match the photo's sunlit lawns just above the boundary (mean colour), slightly desaturated.
rows=[];[rows.append(a[horizon+10:int(start[x])-3,x]) for x in range(0,W,3)]
band=np.concatenate(rows);lawn=band[(band[:,1]>band[:,0]*1.02)&(band[:,1]>band[:,2]*1.15)]
target=np.array([0.254,0.311,0.104])
cur=grass[:60].reshape(-1,3).mean(0);grass*=target/np.maximum(cur,1e-3)
lum=grass.mean(-1,keepdims=True);grass=lum+(grass-lum)*.88
haze=np.clip(1-(theta[:,None]/0.035),0,1)[:,:,None]*.18;grass=grass*(1-haze)+np.array([.78,.82,.86])*haze
alpha=np.clip((ys[:,None]-start[None,:])/(7.0*k),0,1)[:,:,None]
out=a.copy();out[horizon+1:]=a[horizon+1:]*(1-alpha)+grass*alpha
img=Image.fromarray((np.clip(out,0,1)*255).astype(np.uint8))
img.save(out_dir+'/neighborhood-lawn-8k.jpg',quality=86,optimize=True,progressive=True)
img.resize((4096,2048),Image.LANCZOS).save(out_dir+'/neighborhood-lawn-4k.jpg',quality=86,optimize=True,progressive=True)
img.crop((0,2000,8192,3000)).resize((2048,250),Image.LANCZOS).save(prev,quality=88)
print('target',target)
