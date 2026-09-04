const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DOMAINS=[
 'sbl.se','sbldam.se','basketligan.com','swebasket.se','basketettan.se',
 'hockeyettan.se','damettan.se','j20nationell.se',
 'volleyboll.se','volleyligan.se','elitserienvolleyboll.se',
 'bandy.se','elitserienbandy.se','bandyligan.com',
 'handbollsligan.se','handbollsligandam.se','she.se','allsvenskanhandboll.se',
 'ssl.se','sslDam.se','innebandyallsvenskan.se',
 'bauhausligan.se','speedwayligan.se','elitserienspeedway.com',
 'svenskfotboll.se','fotbollettan.se','ettan.se','damallsvenskan.se','allsvenskan.se','superettan.se',
 'rugby.se','futsalligan.se','sverigesradiosport.se',
];
async function probe(h){
  for(const host of ['www.'+h,h]){
    try{
      const r=await fetch(`https://${host}/api/gameday/gameheader`,{headers:{'User-Agent':UA,Accept:'application/json'},redirect:'follow',signal:AbortSignal.timeout(15000)});
      if(!r.ok) continue;
      const t=await r.text(); if(!t.startsWith('{')) continue;
      const j=JSON.parse(t);
      const dates=Object.keys(j).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k));
      if(!dates.length) continue;
      const n=dates.reduce((a,k)=>a+(j[k]||[]).length,0);
      const finalHost=new URL(r.url).origin;
      return {tried:h,base:finalHost,games:n,span:dates.sort()[0]+'→'+dates.sort().slice(-1)[0]};
    }catch{}
  }
  return null;
}
(async()=>{
  const hits=[];let i=0;
  await Promise.all(Array.from({length:8},async()=>{
    while(i<DOMAINS.length){const d=DOMAINS[i++];
      const r=await probe(d);
      if(r){hits.push(r);console.log('HIT',r.tried.padEnd(26),'→',r.base.padEnd(34),String(r.games).padStart(3),'matcher',r.span);}
    }}));
  console.log('\nträffar:',hits.length,'av',DOMAINS.length);
  require('fs').writeFileSync('sportality-hits2.json',JSON.stringify(hits,null,1));
})();
