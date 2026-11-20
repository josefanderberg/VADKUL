const sharp = require('/Users/josefanderberg/source/VADKUL/node_modules/sharp');
const TR = '/Users/josefanderberg/.claude/projects/-Users-josefanderberg-source-VADKUL/21596d7c-114d-47e3-8e08-e17c80d976b9/tool-results/';
const UT = '/Users/josefanderberg/source/VADKUL/apps/web/public/mejl/2026-11/skyltar-karta.jpg';
(async () => {
  const bas = await sharp(TR + 'mcp-claude-in-chrome-blob-1795178337051-jnejur.jpg').extract({ left: 58, top: 118, width: 1080, height: 612 }).png().toBuffer();
  const lapp = await sharp(bas).extract({ left: 416, top: 436, width: 21, height: 34 }).toBuffer();
  await sharp(bas).composite([{ input: lapp, left: 437, top: 436 }]).jpeg({ quality: 84, mozjpeg: true }).toFile(UT);
  await sharp(UT).extract({left:380,top:400,width:140,height:110}).resize(560,440,{kernel:'nearest'}).png().toFile(process.argv[2]);
})();
