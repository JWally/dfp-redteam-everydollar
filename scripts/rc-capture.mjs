#!/usr/bin/env node
/** rc-capture.mjs — capture the FULL reCAPTCHA v2 flow on the Auth0 login:
 *  iframes, requests, tokens, cookies. Clean Chrome attach. */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const b = await chromium.connectOverCDP('http://127.0.0.1:9245');
const ctx = b.contexts()[0];
const page = ctx.pages().find(p=>p.url().includes('ramseysolutions')) || ctx.pages()[0];
const log = { requests:[], bundles:{}, resp:[] };
page.on('request', req => {
  const u = req.url();
  if (/recaptcha|google|gstatic|ramseysolutions/.test(u)) {
    log.requests.push({ method: req.method(), type: req.resourceType(), url: u.slice(0,190) });
  }
});
page.on('response', async r => {
  const u = r.url();
  if (/\.js($|\?)/.test(u) && /recaptcha|gstatic|google.com\/recaptcha/.test(u)) {
    try { const b=await r.text(); if (b.length>20000) log.bundles[u]=b; } catch(_){}
  }
  if (/anchored|bframe|relay|userverify|reload|fn/.test(u)) {
    try { const t=await r.text(); log.resp.push({url:u.slice(0,140), status:r.status(), ct:r.headers()['content-type']||'', body:t.slice(0,400)}); } catch(_){}
  }
});
await page.waitForTimeout(10000);
// enumerate frames
const frames = page.frames().map(f=>({url:f.url().slice(0,110)}));
console.log('frames:', frames.length);
for (const f of frames) if (/recaptcha|google|captcha/.test(f.url)) console.log('  rc-frame:', f.url);
// click the checkbox in the recaptcha iframe if present
for (const f of page.frames()) {
  if (/recaptcha\/api2\/anchor/.test(f.url())) {
    try {
      const box = f.locator('.recaptcha-checkbox-border, #recaptcha-anchor').first();
      await box.click({ timeout:5000 }).catch(()=>{});
      console.log('clicked recaptcha checkbox');
    } catch(_){}
  }
}
await page.waitForTimeout(10000);
console.log('\nrequests:', log.requests.length, '| resp:', log.resp.length);
const hosts={}; for (const r of log.requests){ try{ hosts[new URL(r.url).host]=(hosts[new URL(r.url).host]||0)+1; }catch(_){} }
for (const [h,n] of Object.entries(hosts).sort((a,b)=>b[1]-a[1])) console.log(`  ${n}  ${h}`);
console.log('\n=== challenge responses (anchored/bframe/reload/userverify) ===');
for (const rr of log.resp.slice(0,8)) { console.log('\n ', rr.status, rr.url); if (rr.ct.includes('json')) console.log('  body:', rr.body.slice(0,300)); }
mkdirSync('/tmp/opencode/ed/rc',{recursive:true});
for (const [u,body] of Object.entries(log.bundles)) { const n=(u.split('/').pop().split('?')[0]||'x')+'-'+body.length; writeFileSync('/tmp/opencode/ed/rc/'+n, body); }
console.log('\nbundles:', Object.keys(log.bundles).length);
writeFileSync('/tmp/opencode/ed/rc-flow.json', JSON.stringify({requests:log.requests.slice(0,60), resp:log.resp.slice(0,10)},null,2));
await b.close();