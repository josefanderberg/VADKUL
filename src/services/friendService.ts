import { db } from '../lib/firebase';
import { doc, getDoc, writeBatch, Timestamp } from 'firebase/firestore';

export type FriendStatus = 'pending' | 'accepted' | 'incoming' | 'none';

export const friendService = {
  // Check status between current user and target user
  async checkFriendStatus(currentUid: string, targetUid: string): Promise<FriendStatus> {
    if (!currentUid || !targetUid) return 'none';

    // Check friend document in current user's subcollection
    const docRef = doc(db, 'users', currentUid, 'friends', targetUid);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      return snap.data().status as FriendStatus;
    }
    return 'none';
  },

  // Check if users are friends (helper for booleans)
  async isFriend(currentUid: string, targetUid: string): Promise<boolean> {
    const status = await this.checkFriendStatus(currentUid, targetUid);
    return status === 'accepted';
  },

  // Send friend request
  async sendFriendRequest(currentUid: string, targetUid: string) {
    const batch = writeBatch(db);

    // 1. My side: 'pending' (I am waiting for answer)
    const myRef = doc(db, 'users', currentUid, 'friends', targetUid);
    batch.set(myRef, {
      uid: targetUid,
      status: 'pending',
      createdAt: Timestamp.now()
    });

    // 2. Their side: 'incoming' (They have a request)
    const theirRef = doc(db, 'users', targetUid, 'friends', currentUid);
    batch.set(theirRef, {
      uid: currentUid,
      status: 'incoming',
      createdAt: Timestamp.now()
    });

    await batch.commit();
  },

  // Accept friend request
  async acceptFriendRequest(currentUid: string, targetUid: string) {
    const batch = writeBatch(db);

    // Both become 'accepted'
    const myRef = doc(db, 'users', currentUid, 'friends', targetUid);
    batch.update(myRef, {
      status: 'accepted',
      updatedAt: Timestamp.now()
    });

    const theirRef = doc(db, 'users', targetUid, 'friends', currentUid);
    batch.update(theirRef, {
      status: 'accepted',
      updatedAt: Timestamp.now()
    });

    await batch.commit();
  },

  // Remove friend or cancel request
  async removeFriend(currentUid: string, targetUid: string) {
    const batch = writeBatch(db);

    const myRef = doc(db, 'users', currentUid, 'friends', targetUid);
    batch.delete(myRef);

    const theirRef = doc(db, 'users', targetUid, 'friends', currentUid);
    batch.delete(theirRef);

    await batch.commit();
  }
};