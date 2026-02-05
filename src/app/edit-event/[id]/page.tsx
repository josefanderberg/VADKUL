'use client';

import CreateEvent from '../../../views/CreateEvent';


// Vi återanvänder samma vykomponent eftersom den har inbyggd logik för både "skapa" och "redigera"
// baserat på om ID finns i URL:en (params).
export default function EditEventPage() {
    return <CreateEvent />;
}
