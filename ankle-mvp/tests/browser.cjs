/* Optional real-browser regression. Requires Playwright + installed Chromium.
   npm install --no-save playwright; npx playwright install chromium
   Start python server.py in another terminal, then node tests/browser.cjs.
*/
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '', 'playwright'))); }
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({ viewport: {width:1440,height:1100}, acceptDownloads:true });
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8765');
    await page.locator('#demo').click();
    await page.locator('#canvas').waitFor({state:'visible'});
    // The canvas is taller than the scrollable #viewport; scroll each target into view before clicking.
    const clickAt=async(x,y)=>{
      await page.evaluate(y=>{const v=document.getElementById('viewport'),c=document.getElementById('canvas');v.scrollTop=Math.max(0,y/850*c.getBoundingClientRect().height-v.clientHeight/2);},y);
      const box=await page.locator('#canvas').boundingBox();
      await page.mouse.click(box.x+x/1100*box.width,box.y+y/850*box.height);
    };
    for(const [x,y] of [[230,340],[870,340],[230,480],[870,480+640*Math.tan(Math.PI/18)]]) await clickAt(x,y);
    await page.locator('#override').check();
    await page.locator('#calculate').click();
    assert.equal(await page.locator('#geometryValue').textContent(),'10.00°');
    for(const [id,val] of Object.entries({dorsiflexion:10,plantar_flexion:20,eversion:10,inversion:15})) await page.locator('#'+id).fill(String(val));
    assert.match(await page.locator('#candidate').textContent(), /8121/);
    await page.locator('#zoom').fill('2');
    await page.locator('#calculate').click();
    assert.equal(await page.locator('#geometryValue').textContent(),'10.00°');
    const downloadPromise=page.waitForEvent('download'); await page.locator('#export').click();
    const dl=await downloadPromise, json=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
    assert.equal(json.rom.total,55); assert.equal(json.ai_review.performed,false);
    // Mouse clicks snap to device pixels, so match the displayed 2-decimal precision.
    assert.ok(Math.abs(json.radiographic_measurement.talar_tilt_deg-10)<0.01);
    await page.locator('#undo').click(); assert.equal(await page.locator('#geometryValue').textContent(),'—');
    await page.locator('#view').selectOption('Lateral');
    assert.equal(await page.locator('.point-row').count(),2);
    await page.locator('#zoom').fill('1');
    for(const [x,y] of [[300,300],[400,400]]) await clickAt(x,y);
    await page.locator('#override').check(); await page.locator('#calculate').click();
    assert.match(await page.locator('#geometryNote').textContent(),/mm 미산출/);
    await page.locator('#lawSearch').click(); await page.waitForFunction(()=>document.getElementById('lawResults').textContent.includes('미설정'));
    const out=path.resolve(__dirname,'../reports');fs.mkdirSync(out,{recursive:true});
    await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]); console.log('Browser regression passed.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
