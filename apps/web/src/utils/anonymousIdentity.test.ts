import { describe, it, expect, vi } from 'vitest';
import { sharedAnonymousIdentity } from './anonymousIdentity';

/** En falsk auth: signInAnonymously löses först när testet säger till. */
function fakeAuth(initialUid: string | null = null) {
    let uid: string | null = initialUid;
    let next = 0;
    const resolvers: Array<() => void> = [];
    const signInAnonymously = vi.fn(() => new Promise<string>(resolve => {
        resolvers.push(() => { uid = `anon-${++next}`; resolve(uid); });
    }));
    return {
        currentUid: () => uid,
        signInAnonymously,
        finishSignIn: () => resolvers.shift()?.(),
        setUid: (u: string | null) => { uid = u; },
    };
}

describe('sharedAnonymousIdentity (#164)', () => {
    it('samtidiga anrop delar EN anonym inloggning och får samma uid', async () => {
        const a = fakeAuth();
        const ensure = sharedAnonymousIdentity(a);
        const calls = [ensure(), ensure(), ensure()];
        await Promise.resolve();
        a.finishSignIn();
        const uids = await Promise.all(calls);
        expect(a.signInAnonymously).toHaveBeenCalledTimes(1);
        expect(new Set(uids)).toEqual(new Set(['anon-1']));
    });

    it('finns en session redan loggas ingen in', async () => {
        const a = fakeAuth('konto-1');
        const ensure = sharedAnonymousIdentity(a);
        expect(await ensure()).toBe('konto-1');
        expect(a.signInAnonymously).not.toHaveBeenCalled();
    });

    it('efter en klar inloggning återanvänds sessionen', async () => {
        const a = fakeAuth();
        const ensure = sharedAnonymousIdentity(a);
        const first = ensure();
        await Promise.resolve();
        a.finishSignIn();
        expect(await first).toBe('anon-1');
        expect(await ensure()).toBe('anon-1');
        expect(a.signInAnonymously).toHaveBeenCalledTimes(1);
    });

    it('väntar på den sparade sessionen innan en ny skapas', async () => {
        const a = fakeAuth();
        let restore!: () => void;
        const ready = () => new Promise<void>(resolve => { restore = () => { a.setUid('sparad-1'); resolve(); }; });
        const ensure = sharedAnonymousIdentity({ ...a, ready });
        const call = ensure();
        await Promise.resolve();
        restore();
        expect(await call).toBe('sparad-1');
        expect(a.signInAnonymously).not.toHaveBeenCalled();
    });

    it('ett misslyckat försök släpper låset så att nästa tryck försöker igen', async () => {
        let uid: string | null = null;
        const signInAnonymously = vi.fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockImplementationOnce(async () => { uid = 'anon-2'; return uid; });
        const ensure = sharedAnonymousIdentity({ currentUid: () => uid, signInAnonymously });
        await expect(ensure()).rejects.toThrow('offline');
        expect(await ensure()).toBe('anon-2');
        expect(signInAnonymously).toHaveBeenCalledTimes(2);
    });

    it('ett fel i ready ger ett avvisat anrop, inget kast utanför promisen', async () => {
        const a = fakeAuth();
        const ensure = sharedAnonymousIdentity({ ...a, ready: async () => { throw new Error('auth'); } });
        await expect(ensure()).rejects.toThrow('auth');
        expect(a.signInAnonymously).not.toHaveBeenCalled();
    });
});
