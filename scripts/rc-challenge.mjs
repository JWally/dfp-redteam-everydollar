#!/usr/bin/env node
/** rc-challenge.mjs — proper page load with the recaptcha widget; force the
 *  challenge (reload request) by checking the box with a tracked click, and
 *  capture the reload JSON (challenge format). */
import { chromium } from 'playwright';
import http from 'node:http';
import { writeFileSync } from 'node:fs';
const SITEKEY='6LdxSscbAAAAAFBBnuQrtgdKy7vw8FTT8YJZQzZh';
const srv=http.createServer((req,res)=>{res.setHeader("Content-Type","text/html");res.end(`<!doctype html><html><head><script src="https://www.google.com/recaptcha/api.js?render=explicit" async defer></script></head><body style="margin:0"><div id="rc"></div><script>window.onload=function(){ if(window.grecaptcha){ window.__rcId=grecaptcha.render('rc',{sitekey:'${SITEKEY}',callback:t=>{window.__tok=t;},'error-callback':()=>{window.__rcErr=1;}}); } };</script></body></html>`);});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const port=srv.address().port;
const b=await chromium.launch({headless:false});
const ctx=await b.newContext({viewport:{width:1280,height:900}});
const page=await ctx.newPage();
const log={req:[],resp:[],b64:[]};
page.on('request',req=>{const u=req.url();if(/recaptcha/.test(u)){log.req.push({method:req.method(),url:u.slice(0,170),post:(req.postData()||'').slice(0,1200)});}});
page.on('response',async r=>{const u=r.url();if(/api2\/(reload|userverify|fn|anchor|bframe)/.test(u)){try{const body=await r.text();log.resp.push({url:u.slice(0,130),status:r.status(),ct:r.headers()['content-type']||'',body:body.slice(0,1500)});}catch(_){}}});
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForTimeout(9000);
console.log('frames:',page.frames().map(f=>f.url().slice(0,80)));
for(const f of page.frames()){
  if(/recaptcha\/api2\/anchor/.test(f.url())){
    try{
      const box=await f.locator('.recaptcha-checkbox-border').boundingBox().catch(()=>null);
      if(box){
        const cx=box.x+box.width/2, cy=box.y+box.height/2;
        // natural approach from off-screen
        for(let i=1;i<=14;i++){const t=i/14,e=1-Math.pow(1-t,3);await page.mouse.move(box.x-120+(cx-(box.x-120))*e, box.y-90+(cy-(box.y-90))*e, {steps:2});await new Promise(r=>setTimeout(r,28+Math.random()*35));}
        await page.mouse.move(cx,cy);await new Promise(r=>setTimeout(r,300));
        await page.mouse.down();await new Promise(r=>setTimeout(r,120));await page.mouse.up();
        console.log('checkbox clicked (headed)');
      }
    }catch(e){console.log('click fail:',String(e).slice(0,50));}
  }
}
await page.waitForTimeout(18000);
const tok=await page.evaluate(()=>window.__tok||null).catch(()=>null);
console.log('\ntoken:',tok?tok.slice(0,40)+'... len '+tok.length:'none — challenge/image step required');
console.log('\n=== api2 responses ===');
for(const rr of log.resp.slice(0,5)){console.log('\n ',rr.status,rr.url);console.log('  ct:',rr.ct);if(rr.ct.includes('json'))console.log('  body:',rr.body.slice(0,600));}
console.log('\n=== requests with postData ===');
for(const r of log.req.filter(x=>x.post).slice(0,5)){console.log('\n ',r.method,r.url.slice(0,120));console.log('  post:',r.post.slice(0,500));}
writeFileSync('/tmp/opencode/ed/rc-challenge.json',JSON.stringify({req:log.req.slice(0,15),resp:log.resp.slice(0,6),token:tok},null,2));
srv.close();await b.close();