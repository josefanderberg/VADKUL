// Utzoomad kartbild till novembermejlet: krom bortklippt, platspricken (Josefs position) bortlappad.
const sharp = require('/Users/josefanderberg/source/VADKUL/node_modules/sharp');
const [src, ut, zoom] = process.argv.slice(2);
(async () => {
  const bas = await sharp(src).extract({ left: 60, top: 108, width: 1040, height: 516 }).png().toBuffer();
  // pricken ligger vid (589,515) i originalet = (529,407) i utsnittet
  const lapp = await sharp(bas).extract({ left: 494, top: 394, width: 24, height: 19 }).toBuffer();
  await sharp(bas).composite([{ input: lapp, left: 517, top: 394 }]).jpeg({ quality: 84, mozjpeg: true }).toFile(ut);
  if (zoom) await sharp(ut).extract({ left: 460, top: 340, width: 160, height: 120 }).resize(640, 480, { kernel: 'nearest' }).png().toFile(zoom);
})();
