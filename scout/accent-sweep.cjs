/** Leta Accent-feed-id i alla otäckta kommuners kalendersidor. */
const fs=require('fs');
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
async function get(u,t=15000){try{const r=await fetch(u,{headers:{'User-Agent':UA},redirect:'follow',signal:AbortSignal.timeout(t)});return r.ok?await r.text():'';}catch{return''}}
(async()=>{
 const fp=JSON.parse(fs.readFileSync('fingerprint.json','utf8'));
 const pages=[];
 for(const k of fp){
  const origin=(k.finalUrl||'https://'+k.domain).match(/^https?:\/\/[^/]+/)[0];
  const set=new Set([...(k.calendars||[]).map(c=>c.url).slice(0,2), origin+'/evenemang', origin+'/kalender', origin+'/evenemangskalender']);
  for(const u of set) pages.push({name:k.name,url:u});
 }
 const hits=new Map(); let i=0;
 await Promise.all(Array.from({length:12},async()=>{
  while(i<pages.length){const p=pages[i++];
   const h=await get(p.url); if(!h) continue;
   for(const m of h.matchAll(/accentapi\.com\/feed\/(\d+)|accent[^"']{0,40}?feed[^"']{0,10}?(\d{5,})|data-feed-?id=["'](\d{5,})/gi)){
     const id=m[1]||m[2]||m[3]; if(!id) continue;
     if(!hits.has(p.name)){hits.set(p.name,id);console.log('ACCENT',p.name.padEnd(18),id,p.url.slice(0,60));}
   }
  }}));
 fs.writeFileSync('accent-hits.json',JSON.stringify([...hits],null,1));
 console.log('\nträffar:',hits.size);
})();
