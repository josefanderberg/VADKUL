/** Sampla svenskalag-kalendrar: hur ser aktiviteterna ut, hur många är matcher? */
const fs=require('fs');
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
async function get(u){try{const r=await fetch(u,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(15000)});return r.ok?await r.text():'';}catch{return''}}
function parse(ics){
  const out=[];
  for(const chunk of ics.split('BEGIN:VEVENT').slice(1)){
    const b=chunk.split('END:VEVENT')[0];
    const un=(s)=>s.replace(/\r?\n[ \t]/g,'').trim();
    const f=(k)=>{const m=un(b).match(new RegExp('^'+k+'[^:]*:(.*)$','m'));return m?m[1].trim():'';};
    out.push({start:f('DTSTART'),summary:f('SUMMARY'),loc:f('LOCATION'),desc:f('DESCRIPTION'),uid:f('UID')});
  }
  return out;
}
(async()=>{
 const ids=[];
 // sprid över id-rymden
 for(let i=0;i<120;i++) ids.push(1000+i*1373);
 const rows=[];let i=0;
 await Promise.all(Array.from({length:10},async()=>{
  while(i<ids.length){const id=ids[i++];
   const t=await get('https://cal.svenskalag.se/'+id);
   if(!t.includes('BEGIN:VEVENT')) continue;
   const name=(t.match(/X-WR-CALNAME[^:]*:(.*)/)||[])[1]||'';
   const evs=parse(t);
   rows.push({id,name:name.trim(),n:evs.length,evs});
  }}));
 console.log('kalendrar med poster:',rows.length,'av',ids.length);
 const allSum=rows.flatMap(r=>r.evs.map(e=>e.summary));
 console.log('totalt poster:',allSum.length);
 const first=allSum.map(s=>s.split('//')[0].trim()).filter(Boolean);
 const tally={};for(const s of first){const k=s.slice(0,42);tally[k]=(tally[k]||0)+1;}
 console.log('\nvanligaste aktivitetsnamn (före //):');
 for(const [k,v] of Object.entries(tally).sort((a,b)=>b[1]-a[1]).slice(0,25)) console.log('  '+String(v).padStart(4),k);
 fs.writeFileSync('svenskalag-sample.json',JSON.stringify(rows,null,1));
})();
