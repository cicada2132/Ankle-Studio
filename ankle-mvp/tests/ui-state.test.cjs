/* Headless state regression with a minimal DOM double; not a visual browser test. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../web/core.js');
function setup() {
  const elements=new Map(), ctx=new Proxy({}, {get:()=>()=>{},set:()=>true});
  class Element {
    constructor(){this.value='';this.checked=false;this.hidden=false;this.style={};this.clientWidth=1102;this.handlers={};this.children=[];this.textContent='';}
    addEventListener(k,v){this.handlers[k]=v;} replaceChildren(...x){this.children=x;} append(...x){this.children.push(...x);} setAttribute(){}
    getContext(){return ctx;} toDataURL(){return 'data:image/png;base64,stub';} getBoundingClientRect(){return {left:0,top:0,width:1100,height:850};}
  }
  const document={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement(){return new Element();}};
  class Image {constructor(){this.width=1100;this.height=850;this.naturalWidth=1100;this.naturalHeight=850;} set src(v){this.onload();}}
  const sandbox={window:{AnkleCore:C,addEventListener(){}},document,Image,crypto:{randomUUID:()=> 'test-case'},setTimeout:()=>1,clearTimeout(){},console,location:{protocol:'file:'},Blob,URL,AbortSignal};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../web/app.js'),'utf8'),sandbox);
  return id=>document.getElementById(id);
}
test('UI manual gate, angle, zoom invariance, ROM and stale geometry invalidation',async()=>{
  const $=setup(); await $('demo').onclick();
  for(const [x,y] of [[230,340],[870,340],[230,480],[870,480+640*Math.tan(Math.PI/18)]]) $('canvas').handlers.click({clientX:x,clientY:y});
  $('calculate').onclick(); assert.equal($('geometryValue').textContent,'—');
  $('override').checked=true; $('calculate').onclick(); assert.equal($('geometryValue').textContent,'10.00°');
  $('zoom').value='2'; $('zoom').oninput(); $('calculate').onclick(); assert.equal($('geometryValue').textContent,'10.00°');
  for(const [id,value] of Object.entries({dorsiflexion:10,plantar_flexion:20,eversion:10,inversion:15})){ $(id).value=String(value);$(id).oninput();}
  assert.equal($('candidate').textContent,'6급 2항 8121 후보');
  $('undo').onclick(); assert.equal($('geometryValue').textContent,'—'); assert.equal($('override').checked,false);
});
test('Lateral pixel-only then calibration, view clears prior points',async()=>{
  const $=setup(); await $('demo').onclick(); $('view').value='Lateral'; $('view').onchange();
  assert.equal($('points').children.length,2);
  for(const [x,y] of [[300,300],[303,304]]) $('canvas').handlers.click({clientX:x,clientY:y});
  $('override').checked=true; $('calculate').onclick(); assert.equal($('geometryValue').textContent,'5.00 px');
  assert.match($('geometryNote').textContent,/mm 미산출/);
  $('mmPerPixel').value='.2'; $('mmPerPixel').oninput(); $('scaleSource').value='marker'; $('calculate').onclick();
  assert.match($('geometryNote').textContent,/1.00 mm/);
  $('view').value='AP'; $('view').onchange(); assert.equal($('geometryValue').textContent,'—'); assert.equal($('points').children.length,4);
});
