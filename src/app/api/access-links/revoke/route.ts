import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export async function POST(req: Request) {
  try {
    const { linkId, revokedByUserId, revokedReason } = await req.json();

    if (!linkId) {
      return NextResponse.json({ error: 'linkId is required' }, { status: 400 });
    }

    const linkRef = adminDb.collection('accessLinks').doc(linkId);
    const linkDoc = await linkRef.get();

    if (!linkDoc.exists) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const linkData = linkDoc.data();

    const batch = adminDb.batch();
    batch.update(linkRef, {
      status: 'revoked',
      revokedReason: revokedReason || 'Manually revoked',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Find and update the corresponding assignment
    const assignmentsSnapshot = await adminDb.collection('accessAssignments')
      .where('entityId', '==', linkData.entityId)
      .where('entityType', '==', linkData.entityType)
      .where('recipientEmail', '==', linkData.recipientEmail)
      .where('status', '==', 'active')
      .get();

    assignmentsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'revoked',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // Write activity logs
    const linkLogRef = adminDb.collection('activityLogs').doc();
    batch.set(linkLogRef, {
      action: 'access.link_revoked',
      userId: revokedByUserId || 'system',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        linkId,
        entityId: linkData?.entityId,
        entityType: linkData?.entityType,
        revokedReason
      }
    });

    if (assignmentsSnapshot.size > 0) {
      const assignmentLogRef = adminDb.collection('activityLogs').doc();
      batch.set(assignmentLogRef, {
        action: 'access.assignment_removed',
        userId: revokedByUserId || 'system',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          entityId: linkData?.entityId,
          entityType: linkData?.entityType,
          recipientEmail: linkData?.recipientEmail,
          revokedReason
        }
      });
    }

    await batch.commit();

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error revoking access link:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
