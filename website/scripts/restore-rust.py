import pathlib,urllib.request,tarfile,subprocess,concurrent.futures,zipfile,struct,json
base=pathlib.Path('../rust-portable').resolve();base.mkdir(exist_ok=True)
names=['rustc-1.90.0-x86_64-unknown-linux-gnu','cargo-1.90.0-x86_64-unknown-linux-gnu','rust-std-1.90.0-x86_64-unknown-linux-gnu','rust-std-1.90.0-wasm32-unknown-unknown']
def get(n):
 p=base/(n+'.tar.xz')
 if not p.exists():urllib.request.urlretrieve('https://static.rust-lang.org/dist/'+p.name,p)
 with tarfile.open(p) as t:t.extractall(base,filter='data')
 return n
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:list(ex.map(get,names))
for n in names:subprocess.run(['bash',str(base/n/'install.sh'),'--prefix='+str(base/'toolchain'),'--disable-ldconfig'],check=True,stdout=subprocess.DEVNULL)
# Validate the large LLVM file was copied completely.
with tarfile.open(base/(names[0]+'.tar.xz')) as t:
 for m in t.getmembers():
  if '/lib/libLLVM' in m.name and m.isfile():
   dest=base/'toolchain/lib'/pathlib.Path(m.name).name
   if dest.stat().st_size!=m.size:
    with t.extractfile(m) as src,dest.open('wb') as out:
     while chunk:=src.read(1048576):out.write(chunk)
p=base/'wasm-bindgen.tar.gz';urllib.request.urlretrieve('https://github.com/wasm-bindgen/wasm-bindgen/releases/download/0.2.104/wasm-bindgen-0.2.104-x86_64-unknown-linux-musl.tar.gz',p)
with tarfile.open(p) as t:t.extractall(base,filter='data')
cc=base/'cc-bfd';cc.write_text('#!/bin/bash\nargs=()\nfor arg in "$@"; do if [ "$arg" != "-fuse-ld=lld" ]; then args+=("$arg"); fi; done\nexec /usr/bin/cc "${args[@]}" -fuse-ld=bfd\n');cc.chmod(0o755)
print('Rust compiler ready',flush=True)
p=base/'climate';p.mkdir(exist_ok=True)
r=urllib.request.Request('https://basc.pnnl.gov/sites/default/files/ClimateZoneDataFiles.zip',headers={'User-Agent':'Mozilla/5.0'});(p/'data.zip').write_bytes(urllib.request.urlopen(r).read())
with zipfile.ZipFile(p/'data.zip') as z:z.extractall(p)
f=next(p.rglob('*.dbf')).read_bytes();num=struct.unpack_from('<I',f,4)[0];head,size=struct.unpack_from('<HH',f,8);fields=[]
for i in range(32,head-1,32):
 a=f[i:i+32];fields.append((a[:11].split(b'\0')[0].decode(),a[16]))
rows=[]
for i in range(num):
 b=f[head+i*size:head+(i+1)*size];at=1;row={}
 for k,n in fields:row[k]=b[at:at+n].decode('utf8',errors='replace').strip();at+=n
 rows.append(row)
f=next(p.rglob('*.shp')).read_bytes();at=100;out=[];i=0
while at<len(f):
 n=struct.unpack_from('>I',f,at+4)[0]*2;b=f[at+8:at+8+n];at+=8+n;row=rows[i];i+=1
 if '*' in row['IECC21'] or not row['IECC21'] or struct.unpack_from('<I',b)[0]!=5:continue
 bbox=list(struct.unpack_from('<4d',b,4));np,nv=struct.unpack_from('<2I',b,36);parts=list(struct.unpack_from('<'+str(np)+'I',b,44))+[nv];pts=[[round(a,4) for a in struct.unpack_from('<2d',b,44+4*np+16*j)] for j in range(nv)]
 out.append({'id':row['GEOID'],'name':row['Country'],'state':row['State'],'zone':str(int(float(row['IECC21'])))+row['Moisture21'],'oldZone':str(int(float(row['IECC15'])))+row['Moisture15'],'bbox':bbox,'rings':[pts[parts[j]:parts[j+1]] for j in range(np)]})
pathlib.Path('rust-app/data/counties.json').write_text(json.dumps(out,separators=(',',':')));print('Climate dataset ready',len(out),flush=True)
