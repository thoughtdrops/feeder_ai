import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// Draw-call batching: static, non-editable meshes that share a material are merged into one mesh per
// material. The originals stay in the scene graph (hidden) so names, picking and edit targets are
// unchanged; only the drawing gets cheaper.
function editable(o:T.Object3D,stop:T.Object3D){for(let n:T.Object3D|null=o;n&&n!==stop;n=n.parent)if(n.userData.editTarget)return true;return false;}
export function batchStatic(root:T.Object3D,minimum=3){
 root.updateMatrixWorld(true);
 const groups=new Map<string,{material:T.Material,meshes:T.Mesh[]}>(),inverse=new T.Matrix4().copy(root.matrixWorld).invert();
 root.traverse(o=>{
  const mesh=o as T.Mesh;
  if(!mesh.isMesh||(mesh as any).isInstancedMesh||(mesh as any).isSkinnedMesh||!mesh.visible||Array.isArray(mesh.material))return;
  const material=mesh.material as T.Material;if(material.transparent||material.opacity<1||mesh.morphTargetInfluences)return;
  // Cached scenery (the modeled street) outlives this scene, so it is never merged into this scene's batches.
  for(let n:T.Object3D|null=mesh.parent;n&&n!==root;n=n.parent)if(!n.visible||n.userData.persistentAsset)return;
  if(editable(mesh,root)||!mesh.geometry.getAttribute('position')||!mesh.geometry.getAttribute('normal'))return;
  const key=material.uuid+(mesh.geometry.getAttribute('uv')?':uv':'')+':'+mesh.layers.mask;let g=groups.get(key);if(!g){g={material,meshes:[]};groups.set(key,g);}g.meshes.push(mesh);
 });
 let merged=0;const local=new T.Matrix4();
 for(const {material,meshes} of groups.values()){
  if(meshes.length<minimum)continue;
  const parts:T.BufferGeometry[]=[];let cast=false,receive=false;
  for(const mesh of meshes){const g=(mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone());for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);g.clearGroups();g.applyMatrix4(local.multiplyMatrices(inverse,mesh.matrixWorld));parts.push(g);cast||=mesh.castShadow;receive||=mesh.receiveShadow;}
  const geometry=mergeGeometries(parts,false);for(const p of parts)p.dispose();if(!geometry)continue;
  const batch=new T.Mesh(geometry,material);batch.name='Batched · '+(meshes[0].name||material.type);batch.castShadow=cast;batch.receiveShadow=receive;batch.userData.batch=meshes.length;batch.layers.mask=meshes[0]!.layers.mask;root.add(batch);
  for(const mesh of meshes){mesh.visible=false;mesh.userData.batchedOriginal=true;}merged+=meshes.length;
 }
 return merged;
}
