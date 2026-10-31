#!/usr/bin/env node
/** rc-capture2.mjs — reload login with full capture (recaptcha frames fire on
 *  load of the g-recaptcha/Auth0 widget). */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const b = await chromium.connectOverCDP('http://127.0.0.1:9245');
const ctx = b.contexts()[0];
const page = ctx.pages().find(p=>p.url().includes('ramsey')) || ctx.pages()[0];
const log = { requests:[], bundles:{}, resp:[] };
page.on('request', req => {
  const u = req.url();
  if (/recaptcha|google|gstatic|captcha/.test(u)) log.requests.push({ method: req.method(), type: req.resourceType(), url: u.slice(0,190) });
});
page.on('response', async r => {
  const u = r.url();
  if (/\.js($|\?)/.test(u) && /recaptcha|gstatic/.test(u)) { try { const b=await r.text(); if (b.length>20000) log.bundles[u]=b; } catch(_){} }
  if (/anchored|bframe|reload|userverify|fn|relay/.test(u)) { try { log.resp.push({url:u.slice(0,130), status:r.status(), ct:r.headers()['content-type']||'', body:(await r.text()).slice(0,600)}); } catch(_){} }
});
await page.goto('https://id.ramseysolutions.com/u/login/identifier?state=hKFo2SBtaW9XbGxqSGtaMGU2S2RVQ3dyWmp1U1VuTmNPbXNFSKFur3VuaXZlcnNhbC1sb2dpbqN0aWTZIFVqa1BXdk1jcF', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(12000);
// is there a recaptcha on this page?
const hasRC = await page.evaluate(()=>({
  grecaptcha: typeof window.grecaptcha!=='undefined',
  widgets: window.grecaptcha? (window.___grecaptcha_cfg?.count||0) : 0,
  box: !!document.querySelector('.g-recaptcha,[data-sitekey]'),
  rcCfg: document.querySelector('script[src*="recaptcha"]')?.src||null,
})).catch(()=>({}));
console.log('hasRC:', JSON.stringify(hasRC));
console.log('recaptcha reqs:', log.requests.length);
for (const r of log.requests.slice(0,15)) console.log(' ', r.method, r.url.slice(0,140));
console.log('\nresponses:', log.resp.length);
for (const rr of log.resp.slice(0,6)) { console.log('\n ', rr.status, rr.url.slice(0,110)); if (rr.ct.includes('json')||rr.url.includes('reload')) console.log('  ', rr.body.slice(0,300)); }
mkdirSync('/tmp/opencode/ed/rc',{recursive:true});
for (const [u,body] of Object.entries(log.bundles)) { const n=(u.split('/').pop().split('?')[0]||'x')+'-'+body.length; writeFileSync('/tmp/opencode/ed/rc/'+n, body); console.log('saved:', n, Math.round(body.length/1024)+'KB'); }
writeFileSync('/tmp/opencode/ed/rc-flow2.json', JSON.stringify({requests:log.requests.slice(0,40), resp:log.resp.slice(0,8)},null,2));
await b.close();