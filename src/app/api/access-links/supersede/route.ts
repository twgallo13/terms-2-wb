import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export async function POST(req: Request) {
  try {
    const { entityId, entityType, newVersionId, supersededByUserId } = await req.json();

    if (!entityId || !entityType) {
      return NextResponse.json({ error: 'entityId and entityType are required' }, { status: 400 });
    }

    const batch = adminDb.batch();

    // 1. Find all active accessLinks for this entity
    const linksSnapshot = await adminDb.collection('accessLinks')
      .where('entityId', '==', entityId)
      .where('entityType', '==', entityType)
      .where('status', '==', 'active')
      .get();

    linksSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'superseded',
        invalidatedByRevision: true,
        supersededByVersionId: newVersionId || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // 2. Find all active accessAssignments for this entity
    const assignmentsSnapshot = await adminDb.collection('accessAssignments')
      .where('entityId', '==', entityId)
      .where('entityType', '==', entityType)
      .where('status', '==', 'active')
      .get();

    assignmentsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'superseded',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // 3. Write activity log
    const logRef = adminDb.collection('activityLogs').doc();
    batch.set(logRef, {
      action: 'access.link_superseded',
      userId: supersededByUserId || 'system',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        entityId,
        entityType,
        newVersionId,
        count: linksSnapshot.size
      }
    });

    // 4. Log assignment updates
    if (assignmentsSnapshot.size > 0) {
      const assignmentLogRef = adminDb.collection('activityLogs').doc();
      batch.set(assignmentLogRef, {
        action: 'access.assignment_updated',
        userId: supersededByUserId || 'system',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          entityId,
          entityType,
          newStatus: 'superseded',
          count: assignmentsSnapshot.size
        }
      });
    }

    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      linksSuperseded: linksSnapshot.size,
      assignmentsSuperseded: assignmentsSnapshot.size
    });

  } catch (error: any) {
    console.error('Error superseding access links:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
