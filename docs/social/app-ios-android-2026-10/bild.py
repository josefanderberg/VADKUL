#!/usr/bin/env python3
"""Bilden till Facebook-inlägget "VADKUL i App Store + Android-testare" (31/10 2026).

Stilreglerna i docs/social/inlagg-plan.md: mörkblå natt (#04395E -> #006AA7),
EN gul sak (Android-pillen), loggan uppe till vänster, vit vadkul.se-pill nere
till vänster med "Gratis · Inget konto behövs" under. Telefonerna visar appens
riktiga skärmbilder (docs/butik-assets/ra/, iPhone 16 Pro Max 1320x2868).

Kör med en Python som har Pillow:
    python3 bild.py        # skriver bild-1080x1350.png bredvid skriptet

Fredoka läses ur webbens byggutdata, som i docs/butik-assets/komponera.py.
"""
import glob
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HAR = os.path.dirname(os.path.abspath(__file__))
ROT = os.path.abspath(os.path.join(HAR, "..", "..", ".."))
W, H = 1080, 1350

MÖRK = (4, 57, 94)
BLÅ = (0, 106, 167)
GUL = (254, 204, 2)
VIT = (255, 255, 255)
LJUSBLÅ = (143, 199, 232)


def fredoka(px: int, vikt: str = "Bold") -> ImageFont.FreeTypeFont:
    for f in [os.environ.get("FREDOKA", "")] + sorted(glob.glob(os.path.join(ROT, "apps/web/.next/static/media/*.p.woff2"))):
        if not f or not os.path.exists(f):
            continue
        try:
            font = ImageFont.truetype(f, px)
            if "Fredoka" in font.getname()[0]:
                font.set_variation_by_name(vikt)
                return font
        except Exception:
            continue
    sys.exit("Hittar ingen Fredoka-fil: bygg apps/web eller sätt FREDOKA=<sökväg>.")


def bakgrund() -> Image.Image:
    """Diagonal gradient, mörkast uppe till vänster."""
    liten = Image.new("RGB", (64, 80))
    px = liten.load()
    for y in range(80):
        for x in range(64):
            t = min(1.0, (x / 63 * 0.45 + y / 79 * 0.55))
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(MÖRK, BLÅ))
    return liten.resize((W, H), Image.BICUBIC)


def telefon(sökväg: str, höjd: int) -> Image.Image:
    """Skärmbilden i en mörk telefonram med rundade hörn (RGBA)."""
    skärm = Image.open(sökväg).convert("RGBA")
    ram = round(höjd * 0.018)
    sh = höjd - 2 * ram
    sb = round(sh * skärm.width / skärm.height)
    skärm = skärm.resize((sb, sh), Image.LANCZOS)
    r_skärm = round(sb * 0.12)
    mask = Image.new("L", (sb, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sb - 1, sh - 1), r_skärm, fill=255)
    tel = Image.new("RGBA", (sb + 2 * ram, höjd), (0, 0, 0, 0))
    ImageDraw.Draw(tel).rounded_rectangle((0, 0, tel.width - 1, höjd - 1), r_skärm + ram, fill=(11, 18, 32, 255))
    tel.paste(skärm, (ram, ram), mask)
    return tel


def med_skugga(bild: Image.Image, telefonbild: Image.Image, x: int, y: int, vinkel: float) -> None:
    roterad = telefonbild.rotate(vinkel, resample=Image.BICUBIC, expand=True)
    skugga = Image.new("L", bild.size, 0)
    alfa = roterad.split()[3].point(lambda a: int(a * 0.55))
    skugga.paste(alfa, (x + 14, y + 30), alfa)
    skugga = skugga.filter(ImageFilter.GaussianBlur(36))
    bild.paste((0, 0, 0), (0, 0), skugga)
    bild.paste(roterad, (x, y), roterad)


def pill(rita: ImageDraw.ImageDraw, x: int, y: int, text: str, font, fyll, textfärg, luft=(30, 16), pil=False) -> tuple[int, int]:
    """Rundad pill med text. `pil` ritar en högerpil efter texten - Fredoka
    saknar tecknet →, så den ritas med linjer i stället."""
    l, t, r, b = rita.textbbox((0, 0), text, font=font)
    th = b - t
    pilbredd = round(th * 0.9) if pil else 0
    mellan = round(th * 0.45) if pil else 0
    w, h = r - l + 2 * luft[0] + mellan + pilbredd, th + 2 * luft[1]
    rita.rounded_rectangle((x, y, x + w, y + h), h // 2, fill=fyll)
    rita.text((x + luft[0] - l, y + luft[1] - t), text, font=font, fill=textfärg)
    if pil:
        px = x + luft[0] + (r - l) + mellan
        my = y + h // 2
        tj = max(3, round(th * 0.13))
        spets = round(th * 0.32)
        rita.line((px, my, px + pilbredd, my), fill=textfärg, width=tj)
        rita.line((px + pilbredd - spets, my - spets, px + pilbredd, my), fill=textfärg, width=tj, joint="curve")
        rita.line((px + pilbredd - spets, my + spets, px + pilbredd, my), fill=textfärg, width=tj, joint="curve")
    return w, h


def main() -> None:
    bild = bakgrund().convert("RGBA")
    rita = ImageDraw.Draw(bild)

    # Loggan: molnet + ordmärket.
    moln = Image.open(os.path.join(ROT, "vadkul-app/assets/images/splash-icon.png")).convert("RGBA")
    moln = moln.resize((104, round(104 * moln.height / moln.width)), Image.LANCZOS)
    bild.paste(moln, (60, 56), moln)
    ordmärke = fredoka(46, "Bold")
    rita.text((178, 66), "VADKUL", font=ordmärke, fill=VIT)

    # Rubrik (max 6 ord) + underrad.
    rubrik = fredoka(104, "Bold")
    rita.text((60, 170), "Nu i App Store", font=rubrik, fill=VIT)
    under = fredoka(42, "Medium")
    rita.text((62, 300), "Hela kartan i din iPhone - gratis", font=under, fill=LJUSBLÅ)

    # Den enda gula saken: Android-testarna.
    pill(rita, 60, 372, "Android? Bli testare", fredoka(38, "SemiBold"), GUL, MÖRK, luft=(30, 15), pil=True)

    # Telefonerna: kartan bakom, eventkortet framför.
    höjd = 700
    bak = telefon(os.path.join(ROT, "docs/butik-assets/ra/skarmbild-01-karta.png"), höjd)
    fram = telefon(os.path.join(ROT, "docs/butik-assets/ra/skarmbild-02-eventbild.png"), höjd)
    med_skugga(bild, bak, 220, 470, 7)
    med_skugga(bild, fram, 530, 500, -5)

    # Fasta element nere till vänster.
    rita = ImageDraw.Draw(bild)
    _, ph = pill(rita, 60, 1196, "vadkul.se", fredoka(36, "SemiBold"), VIT, BLÅ, luft=(28, 14))
    rita.text((64, 1196 + ph + 14), "Gratis · Inget konto behövs", font=fredoka(26, "Medium"), fill=LJUSBLÅ)

    ut = os.path.join(HAR, "bild-1080x1350.png")
    bild.convert("RGB").save(ut, optimize=True)
    print("skrev", ut)


if __name__ == "__main__":
    main()
