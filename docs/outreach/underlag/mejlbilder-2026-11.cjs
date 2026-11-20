const sharp = require('/Users/josefanderberg/source/VADKUL/node_modules/sharp');
const path = require('path');
const R = '/Users/josefanderberg/source/VADKUL';
const UT = R + '/apps/web/public/mejl/2026-11';
const TR = '/Users/josefanderberg/.claude/projects/-Users-josefanderberg-source-VADKUL/21596d7c-114d-47e3-8e08-e17c80d976b9/tool-results/';
(async () => {
  // 2. Skyltarna per zoomsteg
  const W = 1200, H = 520, SW = 104, SH = 117;
  const rader = [
    { rubrik: '1. Över staden', x: 40, y: 30, steg: 140, skyltar: [['bad','Badplats'],['naturreservat','Naturreservat'],['golf','Golfbana'],['museum','Museum'],['bibliotek','Bibliotek'],['bio','Bio'],['teater','Teater'],['arena','Arena']] },
    { rubrik: '2. Över kvarteret', x: 40, y: 280, steg: 150, skyltar: [['lekplats','Lekplats'],['bollplan','Idrottsplan'],['park','Park'],['idrott','Idrottsanläggning']] },
    { rubrik: '3. Nere på gatan', x: 760, y: 280, steg: 150, skyltar: [['restaurang','Restaurang'],['kafe','Kafé']] },
  ];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="28" fill="#ffffff"/>`;
  const lager = [];
  for (const r of rader) {
    svg += `<text x="${r.x}" y="${r.y + 34}" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="bold" fill="#006AA7">${r.rubrik}</text>`;
    r.skyltar.forEach(([fil, namn], i) => {
      const cx = r.x + 60 + i * r.steg;
      lager.push({ fil, left: Math.round(cx - SW / 2), top: r.y + 58 });
      svg += `<text x="${cx}" y="${r.y + 58 + SH + 30}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="21" fill="#1e293b">${namn}</text>`;
    });
  }
  svg += `<rect x="720" y="286" width="3" height="200" rx="1.5" fill="#e2e8f0"/></svg>`;
  const comps = [];
  for (const l of lager) {
    const buf = await sharp(R + '/vadkul-app/assets/skyltar/' + l.fil + '.png').resize(SW, SH, { kernel: 'lanczos3' }).toBuffer();
    comps.push({ input: buf, left: l.left, top: l.top });
  }
  await sharp(Buffer.from(svg)).composite(comps).png({ palette: true, quality: 90 }).toFile(UT + '/skyltar-tre-hojder.png');
  for (const f of ['skyltar-tre-hojder.png']) { const m = await sharp(UT + '/' + f).metadata(); console.log(f, m.width, m.height); }
})();
