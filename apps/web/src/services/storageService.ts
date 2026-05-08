import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import imageCompression from 'browser-image-compression';

export const storageService = {
    /**
     * Laddar upp en fil (File eller Blob) till Firebase Storage
     * @param path Katalog/Sökväg (t.ex. 'users/uid/profile')
     * @param file Filen som ska laddas upp
     * @returns Länk (URL) till bilden
     */
    async uploadFile(path: string, file: File | Blob): Promise<string> {
        let fileToUpload = file;

        // Komprimera endast om det är en bildfil
        if (file.type && file.type.startsWith('image/')) {
            try {
                const options = {
                    maxSizeMB: 0.8,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                };
                fileToUpload = await imageCompression(file as File, options);
            } catch (error) {
                console.warn("Bildkomprimering misslyckades, laddar upp originalet:", error);
            }
        }

        // Skapa en referens. Om path slutar med / genererar vi ett unikt ID.
        // Annars skriver vi över filen på sökvägen (bra för profilbilder).
        const fullPath = path.endsWith('/') ? `${path}${Date.now()}_${Math.random().toString(36).substring(7)}` : path;

        const storageRef = ref(storage, fullPath);

        // Ladda upp
        const snapshot = await uploadBytes(storageRef, fileToUpload);

        // Hämta URL
        const url = await getDownloadURL(snapshot.ref);
        return url;
    }
};
