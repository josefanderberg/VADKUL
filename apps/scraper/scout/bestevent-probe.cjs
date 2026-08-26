const fs=require('fs');
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const slug=s=>s.toLowerCase().replace(/å|ä/g,'a').replace(/ö/g,'o').replace(/[^a-z0-9]/g,'');
async function j(u){try{const r=await fetch(u,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(12000)});if(!r.ok)return null;return await r.json();}catch{return null}}
(async()=>{
 const fp=JSON.parse(fs.readFileSync('fingerprint.json','utf8'));
 const hosts=new Set();
 for(const k of fp){const s=slug(k.name),root=k.domain.replace(/^www\./,'');
   hosts.add('kalender.'+root); hosts.add('evenemang.'+root); hosts.add('kalender'+s+'.se'); hosts.add('evenemang'+s+'.se');}
 const hits=[];let i=0;const list=[...hosts];
 await Promise.all(Array.from({length:14},async()=>{
  while(i<list.length){const h=list[i++];
   const d=await j('https://'+h+'/api/events?');
   if(d&&Array.isArray(d.events)){hits.push({host:h,total:d.total});console.log('BESTEVENT',h.padEnd(30),'total',d.total);continue;}
   // Bromöllas widget-variant
   const w=await j('https://'+h+'/sv/se-och-gora/filters');
   if(w){hits.push({host:h,kind:'widget'});console.log('WIDGET   ',h);}
  }}));
 fs.writeFileSync('bestevent-hits.json',JSON.stringify(hits,null,1));
 console.log('\nträffar:',hits.length,'av',list.length);
})();
