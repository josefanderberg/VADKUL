/** Testa varje kvarvarande kommun som Cruncho-destination (billig GET). */
const fs=require('fs');
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const slug=s=>s.toLowerCase().replace(/å|ä/g,'a').replace(/ö/g,'o').replace(/[^a-z0-9]/g,'');
const H={'User-Agent':UA,'Content-Type':'application/json','Accept':'application/json'};
async function jget(u){try{const r=await fetch(u,{headers:H,signal:AbortSignal.timeout(15000)});if(!r.ok)return null;return await r.json();}catch{return null}}
(async()=>{
 const kom=JSON.parse(fs.readFileSync('remaining.json','utf8'));
 const cands=new Set();
 for(const k of kom){cands.add(slug(k.n)); cands.add(slug(k.n)+'kommun');}
 // kända flerkommunsdestinationer
 for(const x of ['lomma','vellinge','ljusdal']) cands.add(x);
 const start=new Date().toISOString(), end=new Date(Date.now()+30*864e5).toISOString();
 const hits=[]; const list=[...cands]; let i=0;
 await Promise.all(Array.from({length:10},async()=>{
  while(i<list.length){const d=list[i++];
   const c=await jget(`https://api-ts.cruncho.co/categories/with-events/${d}?destination=${d}&l1=events`);
   if(!c||(!c.l2?.length&&!c.l3?.length)) continue;
   // räkna faktiska event
   let n=0;
   try{
    const r=await fetch(`https://api-ts.cruncho.co/landing-page/recommendations?destination=${d}&size=200&offset=0&sponsored=false`,
     {method:'POST',headers:H,signal:AbortSignal.timeout(25000),
      body:JSON.stringify({pageContext:{destinationSlug:d,l1:'events',previousL1:'',clientTime:'12:00',ip:'',area:''},startDate:start,endDate:end,l2:c.l2||[],l3:c.l3||[],timezone:'Europe/Stockholm',handpicked:false,bookable:false,free:false})});
    if(r.ok){const a=await r.json(); if(Array.isArray(a)) n=a.length;}
   }catch{}
   hits.push({dest:d,n});
   console.log((n?'HIT ':'tom ')+d.padEnd(22)+String(n).padStart(4)+' event');
  }}));
 fs.writeFileSync('cruncho-dests.json',JSON.stringify(hits,null,1));
 console.log('\ndestinationer:',hits.length);
})();
