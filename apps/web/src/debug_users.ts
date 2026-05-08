import { collection, getDocs } from 'firebase/firestore';
import { db } from './lib/firebase';

const checkUsers = async () => {
    console.log("Checking users...");
    const snap = await getDocs(collection(db, 'users'));
    snap.docs.forEach(d => {
        const u = d.data();
        console.log(`User: ${u.displayName} (${d.id})`);
        console.log(`  - verificationStatus: ${u.verificationStatus}`);
        console.log(`  - isVerified: ${u.isVerified}`);
        console.log(`  - photoURL: ${u.photoURL ? 'YES' : 'NO'}`);
        console.log(`  - verificationImage: ${u.verificationImage ? 'YES' : 'NO'}`);
    });
};
checkUsers();
