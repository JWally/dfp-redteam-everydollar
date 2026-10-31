#!/usr/bin/env node
/** ed-probe.mjs — load everydollar app (via ramseysolutions), capture the
 *  security stack: auth flow, any fingerprinting/anti-bot, cookies, scripts. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ headless:true });
const ctx = await b.newContext({ viewport:{width:1280,height:900}, userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36' });
const page = await ctx.newPage();
const log = { requests:[], errors:[] };
page.on('request', req => {
  const u = req.url();
  if (/everydollar|ramseysolutions|forter|sift|lasso|signifyd|recaptcha|turnstile|captcha|fingerprint|auth|login|cognito|aws|amplify|okta|auth0|sentry|amplitude|segment/i.test(u)) {
    log.requests.push({ method: req.method(), type: req.resourceType(), url: u.slice(0,180) });
  }
});
page.on('pageerror', e => log.errors.push(String(e).slice(0,120)));
await page.goto('https://www.ramseysolutions.com/money/everydollar', { waitUntil:'load', timeout:60000 }).catch(()=>{});
await page.waitForTimeout(12000);
// try the app link
const applink = await page.evaluate(() => {
  const a = [...document.querySelectorAll('a')].find(x=>/app\.everydollar|everydollar\.com\/app|Sign In|Login/i.test(x.href+x.textContent));
  return a ? a.href : null;
}).catch(()=>null);
console.log('app link:', applink);
if (applink) { await page.goto(applink, { waitUntil:'load', timeout:60000 }).catch(()=>{}); await page.waitForTimeout(10000); }
const state = await page.evaluate(() => ({
  url: location.href.slice(0,90),
  title: document.title.slice(0,50),
  cookies: document.cookie.split(';').map(c=>c.trim().split('=')[0]).filter(c=>/AWSALB|aws|ed|ramsey|auth|forter|sift|session/i.test(c)),
  fpGlobals: Object.keys(window).filter(k=>/forter|sift|lasso|recaptcha|turnstile|aws|cognito|amplify|OKTA|auth0|fingerprint/i.test(k)).slice(0,20),
})).catch(e=>({err:String(e).slice(0,120)}));
console.log('\nstate:', JSON.stringify(state,null,1).slice(0,800));
const hosts={}; for (const r of log.requests){ try{ hosts[new URL(r.url).host]=(hosts[new URL(r.url).host]||0)+1; }catch(_){} }
console.log('\n=== hosts ===');
for (const [h,n] of Object.entries(hosts).sort((a,b)=>b[1]-a[1])) console.log(`  ${n}  ${h}`);
console.log('\nerrors:', log.errors.slice(0,3));
writeFileSync('/tmp/opencode/ed/probe1.json', JSON.stringify({state, requests:log.requests.slice(0,60)},null,2));
await b.close();