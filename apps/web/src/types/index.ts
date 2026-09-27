/**
 * SHIM (fas 0 i plattformsplanen): typerna bor numera i @vadkul/kontrakt —
 * det delade paketet som web, functions och appen läser samma kontrakt ur.
 * Befintliga importer från '../types' fortsätter fungera via den här
 * re-exporten; ny kod får gärna importera från '@vadkul/kontrakt' direkt.
 * Se docs/app-plattform-plan.md §2.
 */
export * from '@vadkul/kontrakt';
