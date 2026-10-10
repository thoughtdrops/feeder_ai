use crate::*;

pub struct Regions {pub rooms:Vec<Room>,cells:Option<Vec<usize>>,cols:usize,rows:usize}
impl Regions{
 pub fn room(&self,x:f64,z:f64)->Option<&Room>{
  if let Some(cells)=&self.cells{
   if x<0.||z<0.||x>=self.cols as f64*2.||z>=self.rows as f64*2.{return None}
   self.rooms.get(cells[(z/2.).floor()as usize*self.cols+(x/2.).floor()as usize])
  }else{self.rooms.iter().find(|r|x>=r.x&&x<r.x+r.w&&z>=r.z&&z<r.z+r.d)}
 }
}
pub fn build(c:&Config,rs:&[Room],ws:&[Wall])->Regions{
 if c.design_mode!="Blank slate"{return Regions{rooms:rs.to_vec(),cells:None,cols:0,rows:0}}
 let(cols,rows)=((c.width/2.)as usize,(c.depth/2.)as usize);let mut cells=vec![usize::MAX;cols*rows];let mut rooms=vec![];
 let blocked=|ax:usize,az:usize,bx:usize,bz:usize|{
  let(x,z)=(ax as f64*2.+1.,az as f64*2.+1.);let(nx,nz)=(bx as f64*2.+1.,bz as f64*2.+1.);
  ws.iter().any(|w|if w.axis=="x"{w.z>z.min(nz)&&w.z<z.max(nz)&&x>=w.x-0.001&&x<=w.x+w.length+0.001}else{w.x>x.min(nx)&&w.x<x.max(nx)&&z>=w.z-0.001&&z<=w.z+w.length+0.001})
 };
 for start in 0..cells.len(){if cells[start]!=usize::MAX{continue}let index=rooms.len();let mut stack=vec![start];cells[start]=index;let(mut minx,mut minz,mut maxx,mut maxz)=(cols,rows,0,0);
  while let Some(cell)=stack.pop(){let(x,z)=(cell%cols,cell/cols);minx=minx.min(x);minz=minz.min(z);maxx=maxx.max(x);maxz=maxz.max(z);
   for(dx,dz)in[(-1,0),(1,0),(0,-1),(0,1)]{let(nx,nz)=(x as isize+dx,z as isize+dz);if nx<0||nz<0||nx>=cols as isize||nz>=rows as isize{continue}let next=nz as usize*cols+nx as usize;if cells[next]==usize::MAX&&!blocked(x,z,nx as usize,nz as usize){cells[next]=index;stack.push(next);}}
  }
  rooms.push(Room{id:format!("zone{}-{}-{}",c.active_floor,minx*2,minz*2),name:format!("Room {} · from ({}, {}) ft",index+1,minx*2,minz*2),kind:"blank".into(),x:minx as f64*2.,z:minz as f64*2.,w:(maxx-minx+1)as f64*2.,d:(maxz-minz+1)as f64*2.});
 }
 Regions{rooms,cells:Some(cells),cols,rows}
}
