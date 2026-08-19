/**
 * Familj & barn som opt-in — profilregeln (Josef 19/8).
 *
 * Inloggade VUXNA (18+) UTAN barn i profilen får kategorin "Familj & barn"
 * gömd som default på kartan: 🧸-cirkeln flyttar då upp bland opt-in-raderna
 * (Svenska kyrkan/PRO) och kryssas i när man vill se familjeeventen.
 *
 * Medvetet försiktig åt alla andra håll — regeln får hellre visa för mycket
 * än gömma fel:
 *  - ingen profil (utloggad/anonym)  → false: besökare ser allt
 *  - hasChildren === true            → false: föräldrar ser familjeeventen
 *  - ålder saknas/ogiltig            → false: gamla konton utan age-fält
 *  - under 18                        → false: ungdomsevent klassas ofta
 *                                      som family av pipelinen
 *
 * Bara event vars kategori är exakt 'family' berörs. Breda event som passar
 * både barn och vuxna (festivaler o.dyl.) klassas som music/party av
 * pipelinens LLM och göms alltså aldrig av det här filtret.
 */
export function familyIsOptIn(
    profile: { hasChildren?: unknown; age?: unknown } | null | undefined,
): boolean {
    if (!profile) return false;
    if (profile.hasChildren === true) return false;
    return typeof profile.age === 'number' && Number.isFinite(profile.age) && profile.age >= 18;
}
