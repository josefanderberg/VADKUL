// src/services/reportService.ts
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
// OBS: Vi antar att 'db' är importerat från '../lib/firebase'

interface ReportData {
  reportedUserId: string;
  reporterUserId: string;
  reason: string;
  type: 'spam' | 'misconduct' | 'inappropriate_content' | 'other';
  comment?: string;
}

export const reportService = {
  
  /**
   * Skapar ett nytt rapportdokument i 'reports' collection.
   * Rapporter är anonyma ur den rapporterade användarens perspektiv.
   */
  async submitReport(data: ReportData) {
    const reportsRef = collection(db, 'reports');

    const report = {
      ...data,
      reportedAt: Timestamp.now(),
      status: 'pending' as const, // pending | reviewed | closed
      isAnonymous: true, // För att säkerställa integritet
    };

    try {
      await addDoc(reportsRef, report);
      console.log(`Rapport skickad för användare: ${data.reportedUserId}`);
      return { success: true };

    } catch (error) {
      console.error("Fel vid inskickning av rapport:", error);
      throw new Error("Kunde inte skicka rapport. Försök igen.");
    }
  },
  
  // Du kan lägga till andra funktioner här (t.ex. getMyReports, blockUser etc.)
};