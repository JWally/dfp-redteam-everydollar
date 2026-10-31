#!/usr/bin/env node
/** rc-trigger.mjs — submit a test email on the Auth0 identifier page to
 *  trigger the reCAPTCHA widget + capture the full challenge flow. */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const b = await chromium.connectOverCDP('http://127.0.0.1:9245');
const ctx = b.contexts()[0];
const page = ctx.pages().find(p=>p.url().includes('ramsey')) || ctx.pages()[0];
const log = { requests:[], bundles:{}, resp:[] };
page.on('request', req => {
  const u = req.url();
  if (/recaptcha|google\.com\/recaptcha|gstatic|recaptcha\.net/.test(u)) log.requests.push({ method: req.method(), type: req.resourceType(), url: u.slice(0,200) });
});
page.on('response', async r => {
  const u = r.url();
  if (/\.js($|\?)/.test(u) && /recaptcha|gstatic/.test(u)) { try { const b=await r.text(); if (b.length>20000) log.bundles[u]=b; } catch(_){} }
  if (/anchored|bframe|reload|userverify|fn|relay/.test(u)) { try { log.resp.push({url:u.slice(0,140), status:r.status(), ct:r.headers()['content-type']||'', body:(await r.text()).slice(0,800)}); } catch(_){} }
});
await page.goto('https://id.ramseysolutions.com/u/login/identifier?state=hKFo2SBtaW9XbGxqSGtaMGU2S2RVQ3dyWmp1U1VuTmNPbXNFSKFur3VuaXZlcnNhbC1sb2dpbqN0aWTZIFVqa1BXdk1jcF', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(8000);
// find email input + submit
const got = await page.evaluate(() => {
  const email = document.querySelector('input[type="email"], input[name="email"], input#username, input[autocomplete="username"]');
  const btn = [...document.querySelectorAll('button')].find(b=>/continue|next|log in/i.test(b.textContent||''));
  return { hasEmail: !!email, hasBtn: !!btn, inputs: document.querySelectorAll('input').length, btns: [...document.querySelectorAll('button')].map(b=>(b.textContent||'').trim().slice(0,20)).slice(0,4) };
}).catch(()=>({}));
console.log('form:', JSON.stringify(got));
await page.fill('input[type="email"], input[name="email"], input[name="username"], input#username, input[autocomplete="username"]', 'test@example.com').catch(e=>console.log('fill err:', String(e).slice(0,80)));
await page.click('button:has-text("Continue"), button:has-text("Next"), button[type="submit"]').catch(e=>console.log('click err:', String(e).slice(0,80)));
await page.waitForTimeout(10000);
const hasRC = await page.evaluate(()=>({grecaptcha: typeof window.grecaptcha!=='undefined', box: !!document.querySelector('.g-recaptcha,[data-sitekey]')})).catch(()=>({}));
console.log('\nafter submit: grecaptcha=', hasRC.grecaptcha, 'box=', hasRC.box);
console.log('recaptcha reqs:', log.requests.length);
for (const r of log.requests.slice(0,12)) console.log(' ', r.method, r.url.slice(0,150));
console.log('\nresponses:', log.resp.length);
for (const rr of log.resp.slice(0,6)) { console.log('\n ', rr.status, rr.url.slice(0,120)); console.log('  ', rr.body.slice(0,400)); }
mkdirSync('/tmp/opencode/ed/rc',{recursive:true});
for (const [u,body] of Object.entries(log.bundles)) { const n=(u.split('/').pop().split('?')[0]||'x')+'-'+body.length; writeFileSync('/tmp/opencode/ed/rc/'+n, body); console.log('saved:', n, Math.round(body.length/1024)+'KB'); }
writeFileSync('/tmp/opencode/ed/rc-trigger.json', JSON.stringify({requests:log.requests.slice(0,30), resp:log.resp.slice(0,8)},null,2));
await b.close();