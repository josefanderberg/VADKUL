#!/usr/bin/env python3
"""Komponerar butiksskärmbilder ur en rå simulatordump (iPhone 16 Pro Max, 1320x2868).

Receptet är uppmätt ur de ursprungliga bilderna (12-13/10 2026), vars skript
gick förlorat: VADKUL-blå bakgrund, titel i Fredoka SemiBold med mörkblå hård
skugga, telefonen nedskalad med rundade hörn och en mjuk slagskugga.

Användning (kör med en Python som har Pillow):
    python3 komponera.py ra/skarmbild-02-eventbild.png "Allt du behöver veta" 02-eventbild

Skriver tre varianter:
    play/skarmbild-<namn>.png              1320x2640 (Google Play, exakt 2:1)
    skarmbild-<namn>.png                   1320x2868 (App Store, stor skärm)
    app-store-mellan/skarmbild-<namn>.png  1206x2622 (App Store, mellanstor skärm)

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
VARIANTER = {
    "play": dict(storlek=(1320, 2640), telefon=(163, 332, 993, 2158)),
    "stor": dict(storlek=(1320, 2868), telefon=(111, 332, 1098, 2386)),
}
TITEL_PX = 75
TITEL_TOPP = 171
TITEL_SKUGGA = (3, 5)
MELLAN = (1206, 2622)


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


def komponera(ra: Image.Image, titel: str, storlek, telefon) -> Image.Image:
    W, H = storlek
    x, y, w, h = telefon
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

    font = fredoka(TITEL_PX)
    rita = ImageDraw.Draw(bild)
    l, t, r, b = rita.textbbox((0, 0), titel, font=font)
    tx = W / 2 - (l + r) / 2
    ty = TITEL_TOPP - t
    rita.text((tx + TITEL_SKUGGA[0], ty + TITEL_SKUGGA[1]), titel, font=font, fill=SKUGGFARG)
    rita.text((tx, ty), titel, font=font, fill=(255, 255, 255))
    return bild


def main() -> None:
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    ra_sokvag, titel, namn = sys.argv[1:]
    ra = Image.open(ra_sokvag).convert("RGB")
    if ra.size != RA_STORLEK:
        sys.exit(f"Råbilden är {ra.size}, väntade {RA_STORLEK} (iPhone 16 Pro Max).")

    play = komponera(ra, titel, **VARIANTER["play"])
    play.save(os.path.join(HAR, "play", f"skarmbild-{namn}.png"), optimize=True)

    stor = komponera(ra, titel, **VARIANTER["stor"])
    stor.save(os.path.join(HAR, f"skarmbild-{namn}.png"), optimize=True)
    stor.resize(MELLAN, Image.LANCZOS).save(
        os.path.join(HAR, "app-store-mellan", f"skarmbild-{namn}.png"), optimize=True
    )
    print(f"skrev play/, ./ och app-store-mellan/skarmbild-{namn}.png")


if __name__ == "__main__":
    main()
