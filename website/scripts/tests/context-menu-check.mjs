import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
const file='work/scene-editor-check/context-menu.mjs';fs.mkdirSync('work/scene-editor-check',{recursive:true});fs.writeFileSync(file,ts.transpileModule(fs.readFileSync('web/context-menu.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const dom=new JSDOM('<div id="context"><section class="context-menu"><div class="context-heading" data-menu-drag>Drag to move</div><div class="context-body"></div></section></div>');
for(const key of ['window','document','HTMLElement'])globalThis[key]=dom.window[key];let resize;
globalThis.ResizeObserver=class{constructor(fn){resize=fn;}observe(){}disconnect(){}};
const {fitMenu,layoutEditor}=await import('../../'+file);
const root=document.getElementById('context'),menu=document.querySelector('.context-menu'),header=document.querySelector('[data-menu-drag]');let width=800,height=600;
root.getBoundingClientRect=()=>({left:40,top:100,width,height});menu.getBoundingClientRect=()=>({left:40+parseFloat(menu.style.left||'0'),top:100+parseFloat(menu.style.top||'0'),width:parseFloat(menu.style.width||'310'),height:Math.min(650,parseFloat(menu.style.maxHeight||'650'))});
function contained(){const m=menu.getBoundingClientRect(),r=root.getBoundingClientRect();assert.ok(m.left>=r.left+10&&m.top>=r.top+10);assert.ok(m.left+m.width<=r.left+r.width-10+.01);assert.ok(m.top+m.height<=r.top+r.height-10+.01);}
layoutEditor(JSON.stringify({kind:'wall',wallId:'E1',screenX:80,screenY:220}));contained();assert.equal(parseFloat(menu.style.left),480,'Dock on the opposite side of the selected point');
layoutEditor(JSON.stringify({kind:'wall',wallId:'E2',screenX:780,screenY:300}));assert.equal(parseFloat(menu.style.left),10);contained();
function event(type,x,y){const e=new dom.window.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true});Object.defineProperty(e,'pointerId',{value:1});return e;}
const before=menu.getBoundingClientRect();header.dispatchEvent(event('pointerdown',before.left+30,before.top+20));document.dispatchEvent(event('pointermove',900,200));assert.equal(parseFloat(menu.style.left),480);contained();document.dispatchEvent(event('pointerup',900,200));
// A menu redraw on the same selected member retains its dragged position.
layoutEditor(JSON.stringify({kind:'wall',wallId:'E2',screenX:780,screenY:300}));assert.equal(parseFloat(menu.style.left),480);
width=320;height=240;resize();contained();assert.equal(menu.style.maxHeight,'220px');assert.equal(menu.style.width,'300px');
for(const [w,h] of [[320,240],[560,400],[1400,800]])for(const anchor of [{x:0,y:0},{x:w,y:h},{x:w/2,y:h/2}]){const mw=Math.min(310,w-20),mh=Math.min(650,h-20),p=fitMenu(w,h,mw,mh,anchor,{x:9999,y:-9999});assert.ok(p.x>=10&&p.y>=10&&p.x+mw<=w-10+.01&&p.y+mh<=h-10+.01);}
console.log('PASS: menu docking avoids the selected point, header dragging works, position survives a redraw, and all bounds fit desktop/mobile viewports.');
