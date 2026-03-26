import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Hash the incoming token to compare with stored hash
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Query for the link
    const querySnapshot = await adminDb.collection('accessLinks')
      .where('tokenHash', '==', tokenHash)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    const linkDoc = querySnapshot.docs[0];
    const linkData = linkDoc.data();

    // Check status
    const allowedStatuses = ['active', 'superseded'];
    if (!allowedStatuses.includes(linkData.status)) {
      return NextResponse.json({ error: `Link is ${linkData.status}` }, { status: 403 });
    }

    // Check expiration
    const now = new Date();
    const expiresAt = linkData.expiresAt.toDate();
    if (now > expiresAt) {
      // Update status to expired if not already
      await linkDoc.ref.update({ status: 'expired' });
      
      await adminDb.collection('activityLogs').add({
        action: 'access.link_expired',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: { linkId: linkDoc.id }
      });
      return NextResponse.json({ error: 'Link has expired' }, { status: 403 });
    }

    // Check max uses
    if (linkData.maxUses && linkData.currentUseCount >= linkData.maxUses) {
      return NextResponse.json({ error: 'Link has reached maximum usage limit' }, { status: 403 });
    }

    // Update use stats
    const updates: any = {
      currentUseCount: admin.firestore.FieldValue.increment(1),
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (!linkData.firstViewedAt) {
      updates.firstViewedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await linkDoc.ref.update(updates);

    // Log use
    await adminDb.collection('activityLogs').add({
      action: 'access.link_used',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        linkId: linkDoc.id,
        entityId: linkData.entityId,
        entityType: linkData.entityType,
        recipientEmail: linkData.recipientEmail,
        status: linkData.status
      }
    });

    const response = NextResponse.json({
      success: true,
      entityId: linkData.entityId,
      entityType: linkData.entityType,
      vendorId: linkData.vendorId,
      brandId: linkData.brandId,
      scopeType: linkData.scopeType
    });

    // Set a secure cookie with the access token for the review page
    // This allows the review page to verify access without exposing the token in the URL
    response.cookies.set('vendor_access_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/'
    });

    return response;

  } catch (error: any) {
    console.error('Error validating access link:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
