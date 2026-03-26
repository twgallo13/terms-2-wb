import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';

export async function POST(req: Request) {
  try {
    const { packageId, entityType, message } = await req.json();
    const cookieStore = await cookies();
    const token = cookieStore.get('vendor_access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate token and link
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const links = await adminDb.collection('accessLinks')
      .where('tokenHash', '==', tokenHash)
      .where('entityId', '==', packageId)
      .limit(1)
      .get();

    if (links.empty) {
      return NextResponse.json({ error: 'Invalid access' }, { status: 403 });
    }

    const linkDoc = links.docs[0];
    const linkData = linkDoc.data();

    if (linkData.status !== 'active') {
      return NextResponse.json({ error: 'Link is not active' }, { status: 403 });
    }

    // Create change request record
    const changeRequestRef = adminDb.collection('changeRequests').doc();
    const batch = adminDb.batch();

    batch.set(changeRequestRef, {
      packageId,
      entityType,
      message,
      status: 'pending',
      submittedByEmail: linkData.recipientEmail,
      accessLinkId: linkDoc.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Log activity
    const logRef = adminDb.collection('activityLogs').doc();
    batch.set(logRef, {
      action: 'package.change_request_submitted',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      email: linkData.recipientEmail,
      details: {
        packageId,
        entityType,
        changeRequestId: changeRequestRef.id,
        linkId: linkDoc.id
      }
    });

    await batch.commit();

    return NextResponse.json({ success: true, id: changeRequestRef.id });

  } catch (error: any) {
    console.error('Change request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
