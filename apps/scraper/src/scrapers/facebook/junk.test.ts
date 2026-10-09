import { describe, it, expect } from 'vitest';
import { isResellerJunk, isForeignHost, cleanFacebookTitle } from './junk';

describe('isResellerJunk', () => {
    it('känner igen återförsäljarvärdar', () => {
        expect(isResellerJunk('Ken Carson Tickets ', 'Ticket Deals', 'For fans of high-energy hip-hop…')).toBe(true);
        expect(isResellerJunk('TLC  Tickets', 'Laugh Seats', 'TLC brings iconic R&B energy')).toBe(true);
        expect(isResellerJunk('Malmö- Copenhagen Tickets ', 'Skånetrafiken biljett - Sell/rent card - (JoJo Card Skåne)', 'I have tickets for travel')).toBe(true);
    });
    it('"X Tickets" + säljtext utan känd värd', () => {
        expect(isResellerJunk('Hinder Tickets', 'Facebook', 'Get your tickets now for an unforgettable night')).toBe(true);
    });
    it('lämnar riktiga event — även Fever och titlar med Tickets utan säljtext', () => {
        expect(isResellerJunk('City Hall & Vasa Museum guided experience (Stockholm) Tickets', 'Fever', 'Guided tour in Stockholm. Get your tickets on Fever now!', 'Stockholm City Hall, Hantverkargatan 1, Stockholm, 111 52, Stockholm, SE')).toBe(false);
        expect(isResellerJunk('Hinder Tickets', 'Facebook', 'Get your tickets now', 'Truliant Amphitheater')).toBe(true);
        expect(isResellerJunk('Konsert med kören', 'Bettna församling', 'Fri entré')).toBe(false);
        expect(isResellerJunk('Tickets till festivalen', 'Facebook', 'Vi ses på festivalen!')).toBe(false);
    });
});

describe('cleanFacebookTitle', () => {
    it('tar bort "(Stad) Tickets"-svansen', () => {
        expect(cleanFacebookTitle('Stockholm Archipelago Sailing Day Tour (Stockholm) Tickets')).toBe('Stockholm Archipelago Sailing Day Tour');
        expect(cleanFacebookTitle('Ken Carson Tickets ')).toBe('Ken Carson');
    });
    it('rör inte vanliga titlar', () => {
        expect(cleanFacebookTitle('Afterwork på Kappa Bar (Malmö)')).toBe('Afterwork på Kappa Bar (Malmö)');
        expect(cleanFacebookTitle('Tickets')).toBe('Tickets');
    });
});

describe('isForeignHost', () => {
    it('spärrar de utländska arrangörerna oavsett skiftläge och mellanslag', () => {
        expect(isForeignHost('Diamonds Direct')).toBe(true);
        expect(isForeignHost('  kalamazoo  nature center ')).toBe(true);
        expect(isForeignHost('The Fox Fair Oak')).toBe(true);
        expect(isForeignHost('SO36')).toBe(true);
    });
    it('rör inte svenska eller nordiska arrangörer', () => {
        expect(isForeignHost('Visit Örebro')).toBe(false);
        expect(isForeignHost('Nieu Torshov')).toBe(false);     // Oslo - grannlandet visas medvetet
        expect(isForeignHost('Diamonds Direct Göteborg')).toBe(false); // bara exakta namn
        expect(isForeignHost('')).toBe(false);
        expect(isForeignHost(null)).toBe(false);
    });
});
