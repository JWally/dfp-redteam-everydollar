#!/usr/bin/env node
/** rc-harness.mjs — standalone reCAPTCHA v2 harness: same sitekey, load the
 *  widget on a local page, capture the FULL challenge flow (anchor/bframe/
 *  reload/userverify), tokens, and what the script collects. */
import { chromium } from 'playwright';
import http from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
const SITEKEY = '6LdxSscbAAAAAFBBnuQrtgdKy7vw8FTT8YJZQzZh';
const srv = http.createServer((req,res)=>{
  res.setHeader('Content-Type','text/html');
  res.end(`<!doctype html><html><head><script src="https://www.google.com/recaptcha/api.js?render=explicit" async defer></script></head>
  <body><div id="rc"></div>
  <script>
    window.onload = function(){
      if (window.grecaptcha) {
        window.__rcId = grecaptcha.render('rc', { sitekey: '${SITEKEY}', callback: (t)=>{ window.__rcToken=t; } });
      }
    };
  </script></body></html>`);
});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const port = srv.address().port;
const b = await chromium.launch({ headless:true });
const ctx = await b.newContext({ viewport:{width:1280,height:900} });
const page = await ctx.newPage();
const log = { requests:[], bundles:{}, resp:[] };
page.on('request', req => {
  const u = req.url();
  if (/recaptcha|gstatic|google\.com/.test(u)) log.requests.push({ method: req.method(), type: req.resourceType(), url: u.slice(0,200) });
});
page.on('response', async r => {
  const u = r.url();
  if (/\.js($|\?)/.test(u) && /recaptcha|gstatic/.test(u)) { try { const b=await r.text(); if (b.length>20000) log.bundles[u]=b; } catch(_){} }
  if (/anchored|bframe|reload|userverify|fn|relay/.test(u)) { try { log.resp.push({url:u.slice(0,140), status:r.status(), ct:r.headers()['content-type']||'', body:(await r.text()).slice(0,1200)}); } catch(_){} }
});
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForTimeout(10000);
// find + click the checkbox in the anchor iframe
for (const f of page.frames()) {
  if (/recaptcha\/api2\/anchor/.test(f.url())) {
    console.log('anchor frame:', f.url().slice(0,100));
    try { await f.locator('.recaptcha-checkbox-border, #recaptcha-anchor').first().click({timeout:5000}); console.log('clicked checkbox'); } catch(e){ console.log('click fail:', String(e).slice(0,60)); }
  }
}
await page.waitForTimeout(10000);
const token = await page.evaluate(()=>window.__rcToken||null).catch(()=>null);
console.log('\n== token after click:', token ? token.slice(0,40)+'... ('+token.length+')' : 'none (needs solve or risk challenge)');
console.log('requests:', log.requests.length);
const hosts={}; for (const r of log.requests){ try{ hosts[new URL(r.url).host]=(hosts[new URL(r.url).host]||0)+1; }catch(_){} }
for (const [h,n] of Object.entries(hosts)) console.log(`  ${n}  ${h}`);
console.log('\n=== challenge endpoints ===');
for (const rr of log.resp.slice(0,10)) {
  console.log('\n ', rr.status, rr.url.slice(0,120));
  if (rr.ct.includes('json')||/reload|userverify|fn/.test(rr.url)) console.log('  body:', rr.body.slice(0,500));
}
mkdirSync('/tmp/opencode/ed/rc',{recursive:true});
for (const [u,body] of Object.entries(log.bundles)) { const n=(u.split('/').pop().split('?')[0]||'x')+'-'+body.length; writeFileSync('/tmp/opencode/ed/rc/'+n, body); console.log('saved:', n, Math.round(body.length/1024)+'KB'); }
writeFileSync('/tmp/opencode/ed/rc-harness.json', JSON.stringify({requests:log.requests.slice(0,50), resp:log.resp.slice(0,10)},null,2));
srv.close(); await b.close();