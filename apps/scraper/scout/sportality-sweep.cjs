/** Testa om fler ligasajter kör Sportality-plattformen (/api/gameday/gameheader). */
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DOMAINS=[
 // hockey
 'hockeyettan.se','shl.se','hockeyallsvenskan.se','sdhl.se','nationellungdomsserie.se',
 // fotboll
 'allsvenskan.se','superettan.se','damallsvenskan.se','elitettan.se','ettan.se','svenskfotboll.se','fogis.se',
 // basket
 'basketligan.se','svenskbasket.se','basket.se','basketligandam.se',
 // handboll
 'handbollsligan.se','svenskhandboll.se','sverigeserien.se',
 // innebandy
 'innebandy.se','ssl.se','svenskinnebandy.se',
 // bandy / övrigt
 'bandyligan.se','svenskbandy.se','elitserien.se','volleyboll.se','svenskvolleyboll.se',
 'speedwayligan.se','svemo.se','elitserienspeedway.se',
];
async function probe(h){
  for(const host of ['www.'+h, h]){
    try{
      const r=await fetch(`https://${host}/api/gameday/gameheader`,{headers:{'User-Agent':UA,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
      if(!r.ok) continue;
      const t=await r.text();
      if(!t.startsWith('{')) continue;
      const j=JSON.parse(t);
      const dates=Object.keys(j).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k));
      if(!dates.length) continue;
      const n=dates.reduce((a,k)=>a+(j[k]||[]).length,0);
      return {host,dates:dates.length,games:n,span:dates.sort()[0]+'→'+dates.sort()[dates.length-1]};
    }catch{}
  }
  return null;
}
(async()=>{
  const hits=[];let i=0;
  await Promise.all(Array.from({length:8},async()=>{
    while(i<DOMAINS.length){const d=DOMAINS[i++];
      const r=await probe(d);
      if(r){hits.push(r);console.log('SPORTALITY',r.host.padEnd(30),String(r.games).padStart(3),'matcher',r.span);}
    }}));
  console.log('\nträffar:',hits.length,'av',DOMAINS.length);
  require('fs').writeFileSync('sportality-hits.json',JSON.stringify(hits,null,1));
})();
