/**
 * SIDOPANELSLÄGET (ägarbeslut 6/10 + 18/10): på bred skärm dockar eventkortet
 * som en panel längs VÄNSTERKANTEN i stället för bottenark i mitten.
 *
 * 18/10 (Josef: "gör så att det täcker hela vägen upp och inte att man kan
 * dra ner den. den får gärna vara bredare så att knapparna intresserad,
 * kommer.. de 4 knapparna är på 1 rad"): panelen går från topp till botten,
 * kant i kant med skärmen, och är så bred att svarsraden (avatarer +
 * Intresserad · Kommer · Bjud med · ANMÄL/BOKA) ryms på EN rad. Uppmätt med
 * systemfonten: ~535 px med tre avatarer + "+N" och tvåsiffriga räknare,
 * 560 ger luft för tresiffriga. Krymp den inte utan att mäta om raden.
 *
 * Delas av EventCard (panelen + navkolumnen) och sidan, som flyttar kartans
 * krom (profilen, stadsplattan, dagväljaren) in i den fria kartytan till
 * höger om panelen så inget hamnar under den.
 */
export const SIDE_PANEL_QUERY = '(min-width: 1280px)';
export const SIDE_PANEL_W = 560;
