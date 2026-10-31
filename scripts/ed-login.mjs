#!/usr/bin/env node
/** ed-login.mjs — capture the EveryDollar/Auth0 login flow: recaptcha,
 *  pdscrb/verifi, device signals, cookies. Read-only navigation. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ headless:true });
const ctx = await b.newContext({ viewport:{width:1280,height:900}, userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36' });
const page = await ctx.newPage();
const log = { requests:[], posts:[], bundles:{} };
page.on('request', req => {
  const u = req.url();
  const h = req.headers();
  if (/recaptcha|auth0|pdscrb|verifi|ramseysolutions|everydollar|api\.segment/.test(u)) {
    log.requests.push({ method: req.method(), type: req.resourceType(), url: u.slice(0,170) });
    if (req.method()==='POST') log.posts.push({ url: u.slice(0,140), postData: (req.postData()||'').slice(0,2500) });
  }
});
page.on('response', async r => {
  const u = r.url();
  if (/\.js($|\?)/.test(u) && /recaptcha|auth0|pdscrb/.test(u)) { try { const b=await r.text(); if (b.length>20000) log.bundles[u]=b; } catch(_){} }
});
await page.goto('https://id.ramseysolutions.com/authorize?client_id=everydollar&response_type=code&redirect_uri=https://app.everydollar.com/auth&scope=openid%20profile%20email', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(15000);
const state = await page.evaluate(() => ({
  url: location.href.slice(0,100),
  title: document.title.slice(0,60),
  cookies: document.cookie.split(';').map(c=>c.trim().split('=')[0]).filter(c=>/auth|ramsey|ed|session|_abck|sensor/i.test(c)),
  grecaptcha: typeof window.grecaptcha !== 'undefined',
  auth0: typeof window.auth0 !== 'undefined',
  inputs: [...document.querySelectorAll('input')].map(i=>({name:i.name, type:i.type, placeholder:i.placeholder})).slice(0,8),
})).catch(e=>({err:String(e).slice(0,120)}));
console.log('\nstate:', JSON.stringify(state,null,1).slice(0,1200));
const hosts={}; for (const r of log.requests){ try{ hosts[new URL(r.url).host]=(hosts[new URL(r.url).host]||0)+1; }catch(_){} }
console.log('\n=== hosts ===');
for (const [h,n] of Object.entries(hosts).sort((a,b)=>b[1]-a[1])) console.log(`  ${n}  ${h}`);
console.log('\n=== POSTs ===');
for (const p of log.posts.slice(0,5)) { console.log('\n ', p.url); console.log('  ', p.postData.slice(0,400)); }
for (const [u,body] of Object.entries(log.bundles)) { const n=u.split('/').pop().split('?')[0]; writeFileSync('/tmp/opencode/ed/'+n, body); console.log('saved:', n, Math.round(body.length/1024)+'KB'); }
writeFileSync('/tmp/opencode/ed/login-flow.json', JSON.stringify({state, requests:log.requests.slice(0,50), posts:log.posts.slice(0,6)},null,2));
await b.close();