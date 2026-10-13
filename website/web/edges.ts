import * as T from 'three';
import {Pass,FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';

// Architectural line work for the drawing styles: a normal/depth pre-pass finds silhouettes, creases and
// depth steps, then lines are drawn over the colour pass (SketchUp-style shaded + edges, hidden-line
// drawings and blueprints). Works for every mesh, instanced ones included, at the cost of one extra pass.
/** Fine repeated detail (siding courses, battens) sits on this layer: drawn and lit, but not outlined. */
export const FINE_DETAIL_LAYER=2;
export type EdgeOptions={line:string;strength?:number;width?:number;background?:string|null;grid?:string|null};

const shader={
 uniforms:{tDiffuse:{value:null},tNormal:{value:null},tDepth:{value:null},resolution:{value:new T.Vector2(1,1)},cameraNear:{value:.1},cameraFar:{value:1000},
  lineColor:{value:new T.Color('#1c1c1c')},strength:{value:1},width:{value:1},background:{value:new T.Color('#ffffff')},useBackground:{value:0},grid:{value:new T.Color('#ffffff')},useGrid:{value:0}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`#include <packing>
uniform sampler2D tDiffuse;uniform sampler2D tNormal;uniform sampler2D tDepth;uniform vec2 resolution;uniform float cameraNear;uniform float cameraFar;
uniform vec3 lineColor;uniform float strength;uniform float width;uniform vec3 background;uniform float useBackground;uniform vec3 grid;uniform float useGrid;varying vec2 vUv;
float viewZ(vec2 uv){return -perspectiveDepthToViewZ(texture2D(tDepth,uv).x,cameraNear,cameraFar);}
vec3 nrm(vec2 uv){return texture2D(tNormal,uv).xyz*2.-1.;}
void main(){
 vec2 px=width/resolution;float raw=texture2D(tDepth,vUv).x;vec4 base=texture2D(tDiffuse,vUv);
 float z=viewZ(vUv);float iz=1./max(z,1e-4);vec3 n=nrm(vUv);
 float de=0.,ne=0.;
 for(int axis=0;axis<2;axis++){
  vec2 o=axis==0?vec2(px.x,0.):vec2(0.,px.y);
  float r1=texture2D(tDepth,vUv+o).x,r2=texture2D(tDepth,vUv-o).x;
  // Silhouette against the background, or a step in inverse depth (planes are linear in 1/z, so
  // receding floors and walls stay clean).
  if((raw<1.)!=(r1<1.)||(raw<1.)!=(r2<1.))de=1.;
  else if(raw<1.){float i1=1./max(viewZ(vUv+o),1e-4),i2=1./max(viewZ(vUv-o),1e-4);de=max(de,abs(i1+i2-2.*iz)/iz);}
  if(raw<1.){ne=max(ne,1.-dot(n,nrm(vUv+o)));ne=max(ne,1.-dot(n,nrm(vUv-o)));}
 }
 float edge=max(smoothstep(.02,.06,de),smoothstep(.08,.22,ne))*strength;
 // Distant terrain (hills, the far lawn) stays unlined; the house and its lot are drawn.
 if(raw<1.)edge*=1.-smoothstep(260.,420.,z);
 vec3 color=base.rgb;
 if(raw>=1.&&useBackground>.5){color=background;
  if(useGrid>.5){vec2 g=abs(fract(gl_FragCoord.xy/vec2(36.))-.5);float line=step(.47,max(g.x,g.y));vec2 G=abs(fract(gl_FragCoord.xy/vec2(180.))-.5);float major=step(.488,max(G.x,G.y));color=mix(color,grid,max(line*.35,major*.7));}}
 gl_FragColor=vec4(mix(color,lineColor,clamp(edge,0.,1.)),1.);
}`,
};

export class EdgePass extends Pass{
 private target:T.WebGLRenderTarget;private normalMaterial=new T.MeshNormalMaterial({side:T.DoubleSide});private quad:FullScreenQuad;private material:T.ShaderMaterial;
 constructor(private scene:T.Scene,private camera:T.PerspectiveCamera,options:EdgeOptions,width:number,height:number){
  super();
  const depth=new T.DepthTexture(width,height);depth.type=T.FloatType;
  this.target=new T.WebGLRenderTarget(width,height,{depthTexture:depth,type:T.HalfFloatType});
  this.material=new T.ShaderMaterial({uniforms:T.UniformsUtils.clone(shader.uniforms),vertexShader:shader.vertexShader,fragmentShader:shader.fragmentShader});
  this.quad=new FullScreenQuad(this.material);this.setOptions(options);
 }
 setOptions(o:EdgeOptions){const u=this.material.uniforms;u.lineColor!.value.set(o.line);u.strength!.value=o.strength??1;u.width!.value=o.width??1;
  u.useBackground!.value=o.background?1:0;if(o.background)u.background!.value.set(o.background);u.useGrid!.value=o.grid?1:0;if(o.grid)u.grid!.value.set(o.grid);}
 setSize(width:number,height:number){this.target.setSize(width,height);this.material.uniforms.resolution!.value.set(width,height);}
 render(renderer:T.WebGLRenderer,writeBuffer:T.WebGLRenderTarget,readBuffer:T.WebGLRenderTarget){
  const scene=this.scene,override=scene.overrideMaterial,background=scene.background,fog=scene.fog,clear=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha();
  scene.overrideMaterial=this.normalMaterial;scene.background=null;scene.fog=null;renderer.setClearColor(0x000000,0);
  // A deeper near plane for this pass only: thin coplanar layers (wall finishes) stop flickering into false lines.
  const near=this.camera.near;this.camera.near=Math.max(near,.35);this.camera.updateProjectionMatrix();this.camera.layers.disable(FINE_DETAIL_LAYER);
  renderer.setRenderTarget(this.target);renderer.clear();renderer.render(scene,this.camera);
  this.camera.near=near;this.camera.updateProjectionMatrix();this.camera.layers.enable(FINE_DETAIL_LAYER);
  scene.overrideMaterial=override;scene.background=background;scene.fog=fog;renderer.setClearColor(clear,alpha);
  const u=this.material.uniforms;u.tDiffuse!.value=readBuffer.texture;u.tNormal!.value=this.target.texture;u.tDepth!.value=this.target.depthTexture;u.cameraNear!.value=Math.max(this.camera.near,.35);u.cameraFar!.value=this.camera.far;
  renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);this.quad.render(renderer);
 }
 dispose(){this.target.depthTexture?.dispose();this.target.dispose();this.normalMaterial.dispose();this.material.dispose();this.quad.dispose();}
}
