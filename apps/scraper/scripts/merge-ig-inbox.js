#!/usr/bin/env node
// merge-ig-inbox.js — plockar in IG-tvillingar schemalagda från EN ANNAN maskin.
//
// schedule-city-posts.ts skriver IG-kön till en LOKAL, gitignorerad
// ig-queue.json — körs skriptet på MacBooken blir tvillingarna liggande där,
// eftersom launchd-jobbet se.vadkul.ig-queue bara finns på Mac minin. Bryggan:
// MacBooken checkar in posterna som apps/scraper/ig-inbox.json, och nattkedjan
// på minin kör det här skriptet efter git-pullen.
//
// Idempotent: endast id:n som SAKNAS i kön läggs till — befintliga poster
// (även redan publicerade) rörs aldrig, så en post kan inte återuppstå och
// skriptet tål att köras varje natt mot samma inbox. Inboxfilen lämnas orörd
// i trädet (minins whitelist-push får aldrig se lokala ändringar).
const fs = require('fs');
const path = require('path');

const scraperDir = path.resolve(__dirname, '..');
const inboxPath = path.join(scraperDir, 'ig-inbox.json');
const queuePath = process.env.IG_QUEUE_PATH
    ? path.resolve(process.env.IG_QUEUE_PATH)
    : path.join(scraperDir, 'ig-queue.json');

if (!fs.existsSync(inboxPath)) {
    console.log('Ingen ig-inbox.json — inget att göra.');
    process.exit(0);
}

const inbox = JSON.parse(fs.readFileSync(inboxPath, 'utf-8'));
if (!Array.isArray(inbox)) throw new Error('ig-inbox.json är ingen array.');

let queue = [];
if (fs.existsSync(queuePath)) {
    const parsed = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
    if (Array.isArray(parsed)) queue = parsed;
}

const have = new Set(queue.map(i => i.id));
const added = inbox.filter(i => i.id && !have.has(i.id));

if (added.length === 0) {
    console.log(`Inget nytt — ${inbox.length} poster i inboxen, alla redan i kön.`);
    process.exit(0);
}

const merged = [...queue, ...added].sort((a, b) => a.publishAt - b.publishAt);
fs.writeFileSync(queuePath, JSON.stringify(merged, null, 2) + '\n');
console.log(`${added.length} IG-poster inlagda i kön (${inbox.length} i inboxen, ${queue.length} fanns sedan innan).`);
