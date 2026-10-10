import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
fs.mkdirSync('work/walk-check',{recursive:true});fs.writeFileSync('work/walk-check/controls.mjs',ts.transpileModule(fs.readFileSync('web/walk-controls.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const {bindWalkControls}=await import('../../work/walk-check/controls.mjs');
for(const pointerMode of [true,false]){
 const dom=new JSDOM('<div id="stage"><button data-walk="forward"><span>↑</span></button><button data-walk="right">→</button><canvas></canvas></div>',{pretendToBeVisual:true});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.Element=dom.window.Element;
 if(pointerMode)dom.window.PointerEvent=class extends dom.window.MouseEvent{constructor(type,init){super(type,init);Object.defineProperty(this,'pointerId',{value:init.pointerId});}};
 if(!pointerMode)dom.window.PointerEvent=undefined;
 let active=new Set();const root=document.querySelector('#stage'),cleanup=bindWalkControls(root,s=>{active=s;});
 const event=(type,target,id)=>{let e;if(pointerMode){e=new dom.window.PointerEvent(type,{bubbles:true,cancelable:true,button:0,pointerId:id});}else{e=new dom.window.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'changedTouches',{value:[{identifier:id}]});}target.dispatchEvent(e);return e;};
 const down=pointerMode?'pointerdown':'touchstart',up=pointerMode?'pointerup':'touchend',cancel=pointerMode?'pointercancel':'touchcancel';
 assert.equal(event(down,root.querySelector('span'),1).defaultPrevented,true);assert.deepEqual([...active],['forward']);assert.ok(root.querySelector('[data-walk=forward]').classList.contains('held'));
 event(down,root.querySelector('[data-walk=right]'),2);assert.deepEqual(new Set(active),new Set(['forward','right']));event(up,root.querySelector('canvas'),99);assert.equal(active.size,2,'Looking finger release cannot stop held walking arrows');
 event(cancel,root,1);assert.deepEqual([...active],['right']);event(up,root,2);assert.equal(active.size,0);
 const right=root.querySelector('[data-walk=right]');right.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true}));assert.ok(active.has('right'));window.dispatchEvent(new dom.window.KeyboardEvent('keyup',{key:' ',bubbles:true,cancelable:true}));assert.equal(active.size,0);
 event(down,right,3);window.dispatchEvent(new dom.window.Event('blur'));assert.equal(active.size,0);event(down,right,4);cleanup();assert.equal(active.size,0);event(down,right,5);assert.equal(active.size,0,'Disposed controls cannot keep moving a previous view');dom.window.close();
}
console.log('PASS: walkthrough multi-finger holds, separate look finger, pointer and legacy touch paths, cancellation, keyboard, blur and cleanup.');
