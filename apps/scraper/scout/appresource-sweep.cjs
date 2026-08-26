/**
 * Extrahera SiteVision pageId/portletId ur kalendersidornas HTML och testa de
 * fyra kända appresource-rutterna (/page, /events, /filter, /items).
 */
const fs=require('fs');
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const H={'User-Agent':UA,'X-Requested-With':'XMLHttpRequest','Accept':'application/json'};
async function get(u,h=H,t=18000){try{const r=await fetch(u,{headers:h,redirect:'follow',signal:AbortSignal.timeout(t)});return {ok:r.ok,status:r.status,body:r.ok?await r.text():'',url:r.url};}catch{return{ok:false,body:''}}}
const now=Date.now();
function count(j){
  const a=Array.isArray(j)?j:(j.items||j.hits||j.articles||j.data||j.events||j.searchHits||null);
  if(!Array.isArray(a))return null;
  let fut=0;
  for(const it of a){
    const c=[it.startDate,it.start,it.date,it.fullStartDate,it.eventDate,it?.info?.start];
    for(const v of c){ if(v==null)continue;
      const t=typeof v==='number'?v:Date.parse(String(v).replace(' ','T'));
      if(!isNaN(t)&&t>now-864e5){fut++;break;} }
  }
  return {tot:a.length,fut};
}
(async()=>{
 const rem=JSON.parse(fs.readFileSync('remaining.json','utf8'));
 const done=new Set(['Vallentuna','Kinda','Boxholm','Vansbro','Kalix','Skinnskatteberg','Söderköping','Vellinge','Burlöv','Lomma','Värnamo','Kungsbacka','Strängnäs','Ljusdal','Simrishamn']);
 const fp=JSON.parse(fs.readFileSync('fingerprint.json','utf8'));
 const tasks=rem.filter(k=>!done.has(k.n));
 const hits=[];let i=0;
 const from=new Date().toISOString(), to=new Date(Date.now()+30*864e5).toISOString();
 await Promise.all(Array.from({length:8},async()=>{
  while(i<tasks.length){const k=tasks[i++];
   const f=fp.find(x=>x.name===k.n)||{};
   const origin=(f.finalUrl||'https://'+k.d).match(/^https?:\/\/[^/]+/)[0];
   const pages=[...new Set([...(f.calendars||[]).map(c=>c.url).filter(u=>/evenemang|kalend|pa-gang/i.test(u)).slice(0,2), origin+'/evenemang', origin+'/kalender'])];
   let found=null;
   for(const pu of pages){
     const r=await get(pu,{'User-Agent':UA});
     if(!r.ok) continue;
     const pageIds=[...new Set([...r.body.matchAll(/\b(4\.[0-9a-f]{12,})/g)].map(m=>m[1]))].slice(0,6);
     const portletIds=[...new Set([...r.body.matchAll(/svid(12_[0-9a-f]{12,})|\b(12\.[0-9a-f]{12,})/g)].map(m=>(m[1]||m[2]).replace('12_','12.')))].slice(0,8);
     if(!pageIds.length||!portletIds.length) continue;
     outer:
     for(const pid of pageIds) for(const po of portletIds){
       for(const [route,qs] of [['page','p=1&f=&t=&c=&svAjaxReqParam=ajax'],
                                ['events',`fromDate=${encodeURIComponent(from)}&toDate=${encodeURIComponent(to)}&categories=&limit=300`],
                                ['filter','fromDate=&toDate=&freeTextSearch=&svAjaxReqParam=ajax'],
                                ['items','start=0&num=100']]){
         const u=`${origin}/appresource/${pid}/${po}/${route}?${qs}`;
         const rr=await get(u);
         if(!rr.ok||rr.body.length<80) continue;
         let j; try{j=JSON.parse(rr.body);}catch{continue}
         const c=count(j); if(!c||c.tot===0) continue;
         found={kommun:k.n,url:u,route,pageId:pid,portletId:po,...c};
         break outer;
       }
     }
     if(found) break;
   }
   if(found){hits.push(found);console.log('HIT',found.kommun.padEnd(16),found.route.padEnd(7),String(found.fut).padStart(3)+'/'+String(found.tot).padEnd(4),found.pageId,found.portletId);}
  }}));
 fs.writeFileSync('appresource-hits.json',JSON.stringify(hits,null,1));
 console.log('\nträffar:',hits.length,'av',tasks.length);
})();
