/** Fingeravtryck av kandidat-scener: WP-REST, event-sitemap, JSON-LD, Cruncho, CBIS. */
const fs=require('fs');
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
async function get(u,t=18000){try{const r=await fetch(u,{headers:{'User-Agent':UA},redirect:'follow',signal:AbortSignal.timeout(t)});return{ok:r.ok,status:r.status,body:r.ok?await r.text():'',url:r.url};}catch{return{ok:false,body:''}}}
async function probe(host){
  const home=await get('https://'+host);
  if(!home.ok||home.body.length<400) return null;
  let origin; try{origin=new URL(home.url).origin;}catch{return null}
  const sig=[];
  for(const ep of ['/wp-json/tribe/events/v1/events?per_page=5','/wp-json/wp/v2/event?per_page=3','/wp-json/wp/v2/evenemang?per_page=3','/wp-json/wp/v2/forestallning?per_page=3','/wp-json/wp/v2/arrangemang?per_page=3']){
    const r=await get(origin+ep);
    if(r.ok&&/^\s*[\[{]/.test(r.body)&&r.body.length>400){sig.push({kind:'WP',url:origin+ep,len:r.body.length});break;}
  }
  if(/"@type"\s*:\s*"?Event/i.test(home.body)) sig.push({kind:'JSONLD-home'});
  if(/cruncho/i.test(home.body)) sig.push({kind:'CRUNCHO'});
  if(/cbis/i.test(home.body)) sig.push({kind:'CBIS'});
  if(/api\.axiell\.com/.test(home.body)) sig.push({kind:'AXIELL'});
  const rob=await get(origin+'/robots.txt');
  const sms=[...(rob.body||'').matchAll(/Sitemap:\s*(\S+)/gi)].map(m=>m[1]);
  if(!sms.length) sms.push(origin+'/sitemap.xml');
  for(const sm of sms.slice(0,2)){
    const r=await get(sm,20000); if(!r.ok) continue;
    const locs=[...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
    const ev=locs.filter(u=>/\/(evenemang|event|kalender|kalendarium|arrangemang|forestallning|program|shows?|pa-gang)\//i.test(u));
    const sub=locs.filter(u=>/(event|evenemang|kalend|arrangemang|forestallning|program)[^/]*\.xml/i.test(u));
    if(ev.length>=3||sub.length){sig.push({kind:'SITEMAP',url:sm,events:ev.length,subs:sub.slice(0,3)});break;}
  }
  return sig.length?{host,origin,sig}:null;
}
(async()=>{
  const hosts=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const hits=[];let i=0;
  await Promise.all(Array.from({length:8},async()=>{
    while(i<hosts.length){const h=hosts[i++];
      const r=await probe(h).catch(()=>null);
      if(r){hits.push(r);console.log('HIT',h.padEnd(30),r.sig.map(s=>s.kind+(s.events?':'+s.events:s.len?':'+s.len:'')).join(' '));}
      else console.log('   ',h);
    }}));
  fs.writeFileSync(process.argv[3],JSON.stringify(hits,null,1));
  console.log('\nträffar:',hits.length,'av',hosts.length);
})();
