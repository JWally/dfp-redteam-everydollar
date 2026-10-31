#!/usr/bin/env node
/** ed-app.mjs — everydollar.com/app/auth/login full capture: recaptcha
 *  sitekey, device/fp signals, cookies, auth0. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ headless:true });
const ctx = await b.newContext({ viewport:{width:1280,height:900}, userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36' });
const page = await ctx.newPage();
const log = { requests:[], bundles:{} };
page.on('request', req => {
  const u = req.url();
  if (/everydollar|recaptcha|auth0|pdscrb|verifi|ramsey|google\.com\/recaptcha/.test(u)) {
    log.requests.push({ method: req.method(), type: req.resourceType(), url: u.slice(0,180) });
  }
});
page.on('response', async r => {
  const u = r.url();
  if (/\.js($|\?)/.test(u) && /everydollar|recaptcha|auth0/.test(u)) { try { const b=await r.text(); if (b.length>30000) log.bundles[u]=b; } catch(_){} }
});
await page.goto('https://www.everydollar.com/app/auth/login', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(15000);
const state = await page.evaluate(() => ({
  url: location.href.slice(0,100),
  title: document.title.slice(0,50),
  recaptcha: typeof window.grecaptcha !== 'undefined',
  sitekeys: [...document.querySelectorAll('[data-sitekey], .g-recaptcha, [data-callback]')].map(e=>e.dataset.sitekey||e.className).slice(0,5),
  iframes: [...document.querySelectorAll('iframe')].map(f=>f.src.slice(0,80)).filter(s=>/recaptcha|google|auth0/i.test(s)),
  cookies: document.cookie.split(';').map(c=>c.trim().split('=')[0]).filter(c=>/ramsey|ed|auth|session|_abck|_ed|fp/i.test(c)),
})).catch(e=>({err:String(e).slice(0,120)}));
console.log('\nstate:', JSON.stringify(state,null,1).slice(0,1000));
const hosts={}; for (const r of log.requests){ try{ hosts[new URL(r.url).host]=(hosts[new URL(r.url).host]||0)+1; }catch(_){} }
console.log('\n=== hosts ===');
for (const [h,n] of Object.entries(hosts).sort((a,b)=>b[1]-a[1])) console.log(`  ${n}  ${h}`);
for (const [u,body] of Object.entries(log.bundles)) { const n=u.split('/').pop().split('?')[0]; writeFileSync('/tmp/opencode/ed/'+n, body); console.log('saved:', n, Math.round(body.length/1024)+'KB'); }
writeFileSync('/tmp/opencode/ed/app-flow.json', JSON.stringify({state, requests:log.requests.slice(0,60)},null,2));
await b.close();