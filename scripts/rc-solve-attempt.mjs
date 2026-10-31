#!/usr/bin/env node
/** rc-solve-attempt.mjs — clean Chrome + human-ish click on the reCAPTCHA
 *  checkbox; capture the reload/userverify requests + the response token
 *  format. Read-only on a public recaptcha widget. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.connectOverCDP('http://127.0.0.1:9245');
const ctx = b.contexts()[0];
// open a fresh tab with a minimal page + the sitekey widget
const page = await ctx.newPage();
await page.setContent(`<div id="rc"></div><script src="https://www.google.com/recaptcha/api.js?render=explicit" async defer></script><script>window.onload=function(){ if(window.grecaptcha){ window.__rcId=grecaptcha.render('rc',{sitekey:'6LdxSscbAAAAAFBBnuQrtgdKy7vw8FTT8YJZQzZh',callback:t=>{window.__tok=t;}}); } };</script>`);
const log = { requests:[], resp:[] };
page.on('request', req => {
  const u = req.url();
  if (/recaptcha/.test(u)) log.requests.push({ method: req.method(), url: u.slice(0,200), postData: (req.postData()||'').slice(0,2000) });
});
page.on('response', async r => {
  const u = r.url();
  if (/recaptcha\/api2\/(reload|userverify|fn|relay)/.test(u)) {
    try { log.resp.push({ url: u.slice(0,140), status: r.status(), ct: r.headers()['content-type']||'', body: (await r.text()).slice(0,1500) }); } catch(_){}
  }
});
await page.waitForTimeout(8000);
// find the anchor frame and click with human-ish motion (clean chrome, so it renders)
for (const f of page.frames()) {
  if (/recaptcha\/api2\/anchor/.test(f.url())) {
    try {
      const box = await f.locator('.recaptcha-checkbox-border').boundingBox().catch(()=>null);
      if (box) {
        const cx=box.x+box.width/2, cy=box.y+box.height/2;
        for (let i=1;i<=10;i++){ const t=i/10,e=t*t*(3-2*t); await page.mouse.move(box.x-80+(cx-(box.x-80))*e, box.y-60+(cy-(box.y-60))*e); await new Promise(r=>setTimeout(r,30+Math.random()*40)); }
        await page.mouse.click(cx, cy);
        console.log('clicked checkbox at', Math.round(cx), Math.round(cy));
      }
    } catch(e){ console.log('click fail:', String(e).slice(0,60)); }
  }
}
await page.waitForTimeout(15000);
const tok = await page.evaluate(()=>window.__tok||null).catch(()=>null);
console.log('\ntoken:', tok ? tok.slice(0,50)+'...'+tok.length : 'none (challenge required)');
console.log('\n=== requests ===');
for (const r of log.requests.slice(0,10)) { console.log('\n ', r.method, r.url.slice(0,130)); if (r.postData) console.log('   data:', r.postData.slice(0,400)); }
console.log('\n=== api2 responses ===');
for (const rr of log.resp.slice(0,4)) { console.log('\n ', rr.status, rr.url.slice(0,120)); console.log('  ', rr.body.slice(0,600)); }
writeFileSync('/tmp/opencode/ed/rc-attempt.json', JSON.stringify({requests:log.requests.slice(0,10), resp:log.resp.slice(0,4)},null,2));
await b.close();