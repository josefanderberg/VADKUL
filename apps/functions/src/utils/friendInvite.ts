/**
 * Vän-inbjudan från profilen (Josef 13/10: "lägga till en vän direkt i
 * profilen så man delar en länk och bjuder in någon ... 1 var kan vi ta").
 * Länken vadkul.se/?van=<uid> landar i webben; när mottagaren tackar ja
 * blir de vänner direkt och - om villkoren håller - får båda en stjärna.
 *
 * ÄGARBESLUT 13/10:
 *  - 1 stjärna var (inbjudaren + vännen).
 *  - Bara NYA konton ger stjärnor (Auth-kontot högst 7 dagar), och varje
 *    konto kan bara värvas EN gång - annars kunde man skapa egna
 *    fejkkonton och samla stjärnor.
 *  - Inbjudaren får stjärnor för högst 5 värvade vänner; vännen får alltid
 *    sin stjärna när villkoren ovan håller.
 *
 * Ren logik utan Firestore så besluten kan testas - transaktionen i
 * friendInvites.ts läser läget och skriver det planen säger.
 */

/** Så gammalt får vännens konto vara för att inbjudan ska ge stjärnor. */
export const INVITE_MAX_ACCOUNT_AGE_DAYS = 7;
/** Så många värvade vänner ger inbjudaren en stjärna. */
export const INVITER_REWARD_CAP = 5;

/** Ett uid ur länken: Firebase-uid:n är 28 tecken a-z0-9, men tillåt det
 *  som Auth tillåter utan att släppa in '/' (dokumentsökvägar). */
export function isInviteUid(v: unknown): v is string {
    return typeof v === 'string' && /^[A-Za-z0-9_-]{6,128}$/.test(v);
}

/** Kontot skapades inom maxDays. Okänd skapandetid räknas som gammalt. */
export function isNewAccount(createdMs: number | null, nowMs: number, maxDays = INVITE_MAX_ACCOUNT_AGE_DAYS): boolean {
    if (createdMs === null || !Number.isFinite(createdMs)) return false;
    const age = nowMs - createdMs;
    return age >= 0 && age <= maxDays * 24 * 60 * 60 * 1000;
}

/** Namn + bild ur ett users-dokument, i vänradens form (samma regler som
 *  webbens utils/friendStatus personFields och firestore.rules
 *  validFriendDoc: namn högst 80 tecken, bild bara https och högst 500). */
export function friendRowFields(user: Record<string, unknown> | null | undefined): { name?: string; photoURL?: string } {
    const name = typeof user?.displayName === 'string' ? user.displayName.trim().slice(0, 80) : '';
    const photo = typeof user?.photoURL === 'string' && /^https:\/\//.test(user.photoURL)
        ? user.photoURL.slice(0, 500) : '';
    return { ...(name ? { name } : {}), ...(photo ? { photoURL: photo } : {}) };
}

/** Läget transaktionen läst. */
export interface InviteState {
    /** Någon av dem har blockerat den andra. */
    blocked: boolean;
    /** Vännens konto är högst INVITE_MAX_ACCOUNT_AGE_DAYS gammalt. */
    callerIsNew: boolean;
    /** friendInvites/{vän} finns - kontot är redan värvat en gång. */
    alreadyRecruited: boolean;
    /** friendInviters/{inbjudare}.rewarded - värvningar som gett stjärna. */
    inviterRewarded: number;
    /** Status på users/{vän}/friends/{inbjudare} resp. tvärtom (null = saknas). */
    callerRow: string | null;
    inviterRow: string | null;
}

export type InviteNoReward = 'old-account' | 'already-recruited' | null;

export interface InvitePlan {
    ok: boolean;
    /** Skriv båda vänraderna som 'accepted' (false = redan vänner). */
    befriend: boolean;
    rewardFriend: boolean;
    rewardInviter: boolean;
    /** Varför vännen inte fick någon stjärna (null = fick, eller blockerad). */
    noReward: InviteNoReward;
}

export function planFriendInvite(s: InviteState): InvitePlan {
    if (s.blocked) {
        return { ok: false, befriend: false, rewardFriend: false, rewardInviter: false, noReward: null };
    }
    const befriend = !(s.callerRow === 'accepted' && s.inviterRow === 'accepted');
    const noReward: InviteNoReward = s.alreadyRecruited ? 'already-recruited' : !s.callerIsNew ? 'old-account' : null;
    const rewardFriend = noReward === null;
    const rewardInviter = rewardFriend && Math.max(0, Math.floor(s.inviterRewarded)) < INVITER_REWARD_CAP;
    return { ok: true, befriend, rewardFriend, rewardInviter, noReward };
}

/** Beskedet till den som tackade ja (visas som toast i webben). */
export function inviteMessage(plan: InvitePlan, inviterName: string | null): string {
    const vem = inviterName ?? 'din vän';
    if (!plan.ok) return 'Inbjudan går inte att använda.';
    const vänner = plan.befriend ? `Du och ${vem} är vänner nu!` : `Du och ${vem} är redan vänner.`;
    if (plan.rewardFriend && plan.rewardInviter) {
        return `${vänner} Ni fick en stjärna var ⭐ Öppna ett event och tryck på ⭐ bredvid hjärtat.`;
    }
    if (plan.rewardFriend) {
        return `${vänner} Du fick en stjärna ⭐ Öppna ett event och tryck på ⭐ bredvid hjärtat.`;
    }
    if (plan.noReward === 'already-recruited') {
        return `${vänner} Stjärnan från en vän-inbjudan får man bara en gång.`;
    }
    if (plan.noReward === 'old-account') {
        return `${vänner} Stjärnorna gäller nya konton, men vänner blev ni ändå.`;
    }
    return vänner;
}
