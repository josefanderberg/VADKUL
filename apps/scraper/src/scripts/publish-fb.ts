import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config();

const FB_PAGE_ID = process.env.FB_PAGE_ID;
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;

async function publishTodayToFacebook() {
    console.log('📱 Startar Facebook-publicering...');

    if (!FB_PAGE_ID || !FB_PAGE_TOKEN) {
        console.error('❌ Fel: FB_PAGE_ID eller FB_PAGE_TOKEN saknas i .env filen.');
        console.log('Gå till developers.facebook.com för att hämta dessa.');
        process.exit(1);
    }

    try {
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);

        // 1. Hämta dagens events (från skrapade linkEvents)
        const snapshot = await db!.collection('linkEvents')
            .where('time', '>=', Timestamp.fromDate(startOfToday))
            .where('time', '<=', Timestamp.fromDate(endOfToday))
            .get();

        if (snapshot.empty) {
            console.log('ℹ️ Inga events hittades för idag. Inget att publicera.');
            return;
        }

        const events = snapshot.docs.map(doc => doc.data());
        console.log(`Hittade ${events.length} events för idag.`);

        // 2. Skapa postens text
        let postMessage = `🌟 VAD HÄNDER IDAG? 🌟\n\nHär är dagens utvalda tips i Växjö & Kronoberg:\n\n`;

        events.forEach((event, index) => {
            const timeStr = event.time.toDate().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
            postMessage += `${index + 1}. ${event.title}\n`;
            postMessage += `📍 ${event.locationName || 'Växjö'}\n`;
            postMessage += `⏰ Kl ${timeStr}\n`;
            if (event.url) postMessage += `🔗 Läs mer: ${event.url}\n`;
            postMessage += `\n`;
        });

        postMessage += `Hitta fler spontana events på vadkul.se! 🚀\n#vadkul #växjö #kronoberg #events`;

        // 3. Skicka till Facebook Graph API
        const fbUrl = `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`;

        const response = await fetch(fbUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: postMessage,
                access_token: FB_PAGE_TOKEN
            })
        });

        const result = await response.json() as any;

        if (result.error) {
            console.error('❌ Facebook API Fel:', result.error.message);
        } else {
            console.log('✅ Post publicerad! ID:', result.id);
        }

    } catch (error) {
        console.error('❌ Ett oväntat fel uppstod vid publicering:', error);
    }
}

publishTodayToFacebook();
