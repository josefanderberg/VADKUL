#!/usr/bin/env python3
"""Komponerar butiksskärmbilder ur en rå simulatordump (iPhone 16 Pro Max, 1320x2868).

Receptet är uppmätt ur de ursprungliga bilderna (12-13/10 2026), vars skript
gick förlorat: VADKUL-blå bakgrund, titel i Fredoka SemiBold med mörkblå hård
skugga, telefonen nedskalad med rundade hörn och en mjuk slagskugga.

Användning (kör med en Python som har Pillow):
    python3 komponera.py --alla      # alla fem bilderna i BILDER, alla mått
    python3 komponera.py ra/skarmbild-02-eventbild.png "Allt du behöver veta" 02-eventbild

Skriver en variant per mått i VARIANTER (31/10, Josef: "lika bra att ha alla
typer av screenshots tillgängliga"):
    play/                  1320x2640 (Google Play, exakt 2:1)
    ./                     1320x2868 (App Store 6,9" - den som krävs)
    app-store-6-5/         1284x2778 (App Store 6,5")
    app-store-mellan/      1206x2622 (App Store 6,3")
    app-store-6-1/         1170x2532 (App Store 6,1")
    app-store-5-5/         1242x2208 (App Store 5,5", hemknapps-iPhone)
    app-store-4-7/         750x1334  (App Store 4,7", iPhone SE)
Appen är bara för iPhone (supportsTablet saknas i app.json), så Connect har
inga iPad-platser.

Typsnittet läses ur webbens byggutdata (next/font självhostar Fredoka som
variabel woff2). Finns inte apps/web/.next, bygg webben först eller peka
FREDOKA på en annan Fredoka-fil.
"""
import glob
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HAR = os.path.dirname(os.path.abspath(__file__))
ROT = os.path.abspath(os.path.join(HAR, "..", ".."))
BG = (0, 106, 167)
SKUGGFARG = (2, 30, 55)
RA_STORLEK = (1320, 2868)

# Uppmätt ur den ursprungliga play/skarmbild-02-eventkort.png (borttagen 28/10, finns i
# commit 84514826; 1320x2640): telefonen 993x2158 vid
# (163,332), hörnradie 60, slagskugga förskjuten (10,24), gaussisk oskärpa 50,
# 60 % svart. Titelns vita glyfer börjar på y=171, centrerade på x=660.
# Vid 1320 bredd: telefonen börjar på y=332 och slutar 150 px ovanför
# botten, centrerad i sidled. Det ger exakt både play- och 6,9"-måtten och
# skalas med bredden för alla andra (se layout).
TELEFON_TOPP = 332
TELEFON_BOTTEN = 150
TITEL_PX = 75
TITEL_TOPP = 171
TITEL_SKUGGA = (3, 5)

# mapp (relativt HAR, "" = roten) -> canvasmått
VARIANTER = {
    "play": (1320, 2640),
    "": (1320, 2868),
    "app-store-6-5": (1284, 2778),
    "app-store-mellan": (1206, 2622),
    "app-store-6-1": (1170, 2532),
    "app-store-5-5": (1242, 2208),
    "app-store-4-7": (750, 1334),
}

# Råbild i ra/, rubrik (29/10), namn - ordningen i butikerna.
BILDER = [
    ("01-karta", "Allt som händer nära dig"),
    ("02-eventbild", "Allt du behöver veta"),
    ("03-bildflode", "Dag för dag, hela månaden"),
    ("04-sok", "Filtrera på det du gillar"),
    ("05-stadssida", "Hela Sverige, stad för stad"),
]


def layout(storlek):
    """Telefonens ruta (x, y, b, h) och skalan s för ett canvasmått."""
    W, H = storlek
    s = W / 1320
    h = round(H - (TELEFON_TOPP + TELEFON_BOTTEN) * s)
    b = round(h * RA_STORLEK[0] / RA_STORLEK[1])
    return ((W - b) // 2, round(TELEFON_TOPP * s), b, h), s


def fredoka(px: int) -> ImageFont.FreeTypeFont:
    kandidater = [os.environ.get("FREDOKA", "")] + sorted(
        glob.glob(os.path.join(ROT, "apps/web/.next/static/media/*.p.woff2"))
    )
    for f in kandidater:
        if not f or not os.path.exists(f):
            continue
        try:
            font = ImageFont.truetype(f, px)
            if "Fredoka" in font.getname()[0]:
                font.set_variation_by_name("SemiBold")
                return font
        except Exception:
            continue
    sys.exit("Hittar ingen Fredoka-fil: bygg apps/web eller sätt FREDOKA=<sökväg>.")


def komponera(ra: Image.Image, titel: str, storlek) -> Image.Image:
    W, H = storlek
    (x, y, w, h), s = layout(storlek)
    skala = w / RA_STORLEK[0]
    radie = round(60 * skala / (993 / 1320))
    dx, dy, oskarpa = (round(v * skala / (993 / 1320)) for v in (10, 24, 50))

    bild = Image.new("RGB", (W, H), BG)

    skugga = Image.new("L", (W, H), 0)
    ImageDraw.Draw(skugga).rounded_rectangle(
        (x + dx, y + dy, x + dx + w - 1, y + dy + h - 1), radie, fill=int(255 * 0.6)
    )
    skugga = skugga.filter(ImageFilter.GaussianBlur(oskarpa))
    bild.paste((0, 0, 0), (0, 0), skugga)

    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radie, fill=255)
    bild.paste(ra.resize((w, h), Image.LANCZOS), (x, y), mask)

    font = fredoka(round(TITEL_PX * s))
    rita = ImageDraw.Draw(bild)
    l, t, r, b = rita.textbbox((0, 0), titel, font=font)
    tx = W / 2 - (l + r) / 2
    ty = round(TITEL_TOPP * s) - t
    sx, sy = (max(1, round(v * s)) for v in TITEL_SKUGGA)
    rita.text((tx + sx, ty + sy), titel, font=font, fill=SKUGGFARG)
    rita.text((tx, ty), titel, font=font, fill=(255, 255, 255))
    return bild


def skriv(ra_sokvag: str, titel: str, namn: str) -> None:
    ra = Image.open(ra_sokvag).convert("RGB")
    if ra.size != RA_STORLEK:
        sys.exit(f"Råbilden är {ra.size}, väntade {RA_STORLEK} (iPhone 16 Pro Max).")
    for mapp, storlek in VARIANTER.items():
        os.makedirs(os.path.join(HAR, mapp), exist_ok=True)
        komponera(ra, titel, storlek).save(
            os.path.join(HAR, mapp, f"skarmbild-{namn}.png"), optimize=True
        )
    print(f"skrev skarmbild-{namn}.png i {len(VARIANTER)} mått")


def main() -> None:
    if sys.argv[1:] == ["--alla"]:
        for namn, titel in BILDER:
            skriv(os.path.join(HAR, "ra", f"skarmbild-{namn}.png"), titel, namn)
        return
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    skriv(*sys.argv[1:])


if __name__ == "__main__":
    main()
