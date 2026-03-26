import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

/**
 * Cleanup API Route
 * This route simulates a scheduled job to expire stale access links.
 * It can be triggered by a CRON job or manually.
 */
export async function POST(req: Request) {
  try {
    const now = new Date();
    
    // Find all active links that have passed their expiration date
    const staleLinksSnapshot = await adminDb.collection('accessLinks')
      .where('status', '==', 'active')
      .where('expiresAt', '<', admin.firestore.Timestamp.fromDate(now))
      .get();

    if (staleLinksSnapshot.empty) {
      return NextResponse.json({ success: true, message: 'No stale links found' });
    }

    const batch = adminDb.batch();
    const expiredCount = staleLinksSnapshot.size;

    staleLinksSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: 'expired',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: 'system_cron'
      });

      // Log expiration
      const logRef = adminDb.collection('activityLogs').doc();
      batch.set(logRef, {
        action: 'link_expired_auto',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          linkId: doc.id,
          packageId: doc.data().packageId,
          packageType: doc.data().packageType
        }
      });
    });

    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      message: `Successfully expired ${expiredCount} stale links`,
      count: expiredCount
    });

  } catch (error: any) {
    console.error('Error in access link cleanup:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
