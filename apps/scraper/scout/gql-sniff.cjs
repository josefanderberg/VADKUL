const puppeteer=require('/Users/ai/Repos/VADKUL/node_modules/puppeteer');
(async()=>{
 const target=process.argv[2];
 const b=await puppeteer.launch({headless:true,args:['--no-sandbox']});
 const pg=await b.newPage();
 await pg.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
 const bodies=[];
 pg.on('request',r=>{ if(r.method()==='POST'&&/graphql/i.test(r.url())){const b=r.postData(); if(b) bodies.push({url:r.url(),body:b});}});
 try{await pg.goto(target,{waitUntil:'networkidle2',timeout:60000});}catch{}
 await new Promise(r=>setTimeout(r,6000));
 for(const rx of [/godkänn|acceptera|tillåt|ok\b/i,/spelschema|matcher|omgång|visa/i]){
  await pg.evaluate((src)=>{const re=new RegExp(src.slice(1,src.lastIndexOf('/')),'i');
   for(const e of [...document.querySelectorAll('button,a,[role="tab"]')].slice(0,80)){const t=(e.textContent||'').trim();
    if(t&&t.length<30&&re.test(t)){try{e.click()}catch{}}}},rx.toString()).catch(()=>{});
  await new Promise(r=>setTimeout(r,3500));
 }
 await b.close();
 const seen=new Set();
 for(const x of bodies){
  let op='?';try{const j=JSON.parse(x.body);op=(j.operationName)||((j.query||'').match(/query\s+(\w+)/)||[])[1]||'?';}catch{}
  if(seen.has(op))continue; seen.add(op);
  console.log('=== operation:',op);
  console.log(x.body.slice(0,900).replace(/\\n/g,'\n'));
  console.log();
 }
 console.log('unika operationer:',[...seen].join(', '));
})();
