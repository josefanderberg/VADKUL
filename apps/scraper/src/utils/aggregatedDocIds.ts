/**
 * aggregatedDocIds.ts - EN namnlistning av aggregatedEvents per aggregatkörning.
 *
 * BAKGRUND (14/10): varje städsteg i runAggregation (blobbarna per lager, app-
 * regionernas blobbar, JSON-shardsen per lager) gjorde en egen listDocuments()
 * över HELA kollektionen. ListDocuments debiteras ett read per returnerat
 * dokument, och kollektionen har ~240 dokument. Med ~19 app-regioner blev det
 * ~25 listningar = ~6 000 reads per körning, och audit-daemonen kör aggregatet
 * var ~22:a minut dygnet runt: ~430 000 reads/dygn, fler än alla webbläsare
 * och appen tillsammans. Mätt 13-14/10: document/read_count (QUERY) mot
 * api/request_count (ListDocuments) gav ~84 reads per ListDocuments-anrop.
 *
 * I STÄLLET listas kollektionen en gång (lat, vid första städsteget) och
 * namnen delas av alla städsteg i samma körning.
 *
 * Varför det är säkert: varje prefix städas en gång per körning, och shards
 * som körningen själv skrev har alltid index < keepBelow, så de kan aldrig
 * matcha. En shard som en SAMTIDIG körning (nattkedjan + daemonen) skapat
 * efter listningen missas bara den här gången - överblivna shards ovanför
 * indexets shardCount läses aldrig av routen, och nästa körning listar på
 * nytt och städar dem.
 */

export interface ListedDocRef {
    id: string;
    delete(): Promise<unknown>;
}

export interface ListableCollection {
    listDocuments(): Promise<ListedDocRef[]>;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class AggregatedDocIds {
    private refs: Promise<Map<string, ListedDocRef>> | null = null;

    constructor(private readonly col: ListableCollection) {}

    private load(): Promise<Map<string, ListedDocRef>> {
        if (!this.refs) {
            this.refs = this.col.listDocuments().then(
                (rs) => new Map(rs.map((r) => [r.id, r] as const)),
                // Ett misslyckat varv får inte fastna i cachen: nästa städsteg
                // i samma körning ska försöka lista igen.
                (e) => { this.refs = null; throw e; },
            );
        }
        return this.refs;
    }

    /**
     * Radera alla `<prefix><N>` med N >= keepBelow. Basdokumentet utan suffix
     * (t.ex. "cards" för prefixet "cards_") matchar aldrig.
     */
    async deleteNumbered(prefix: string, keepBelow = 0): Promise<void> {
        const refs = await this.load();
        const re = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);
        for (const [id, ref] of [...refs]) {
            const m = id.match(re);
            if (m && parseInt(m[1], 10) >= keepBelow) {
                await ref.delete();
                refs.delete(id);
            }
        }
    }
}
