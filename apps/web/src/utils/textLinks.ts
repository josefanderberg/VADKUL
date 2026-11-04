/**
 * SHIM: klickbara länkar i beskrivningar bor i @vadkul/kontrakt
 * (textLinks.ts) - appen delar texten på exakt samma ställen. Testerna bor
 * i paketet (packages/kontrakt/src/textLinks.test.ts). Renderingen till <a>
 * är components/ui/LinkedText.
 */
export { splitTextLinks, hasTextLinks, type TextSegment } from '@vadkul/kontrakt';
