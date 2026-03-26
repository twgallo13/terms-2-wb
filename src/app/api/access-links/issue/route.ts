import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { createHash, randomUUID } from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      entityId, 
      entityType, 
      entityVersionId,
      vendorId, 
      brandId, 
      contactId, 
      recipientEmail,
      purpose,
      scopeType,
      sentVersionHash,
      issuedByUserId,
      correlationId,
      maxUses
    } = body;

    if (!entityId || !entityType || !recipientEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate a secure random token
    const rawToken = randomUUID() + '-' + Math.random().toString(36).substring(2, 15);
    
    // Hash the token for storage
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    // Set expiration (default 30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const linkData = {
      tokenHash,
      purpose: purpose || 'vendor_review',
      entityType,
      entityId,
      entityVersionId: entityVersionId || null,
      vendorId: vendorId || null,
      brandId: brandId || null,
      contactId: contactId || null,
      recipientEmail,
      status: 'active',
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      maxUses: maxUses || 100,
      currentUseCount: 0,
      invalidatedByRevision: false,
      issuedAt: admin.firestore.FieldValue.serverTimestamp(),
      issuedByUserId: issuedByUserId || 'system',
      scopeType: scopeType || 'read_only',
      sentVersionHash: sentVersionHash || null,
      supersededByVersionId: null,
      revokedReason: null,
      correlationId: correlationId || randomUUID(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const batch = adminDb.batch();
    const linkRef = adminDb.collection('accessLinks').doc();
    batch.set(linkRef, linkData);

    // Create access assignment
    const assignmentRef = adminDb.collection('accessAssignments').doc();
    batch.set(assignmentRef, {
      entityType,
      entityId,
      vendorId: vendorId || null,
      brandId: brandId || null,
      contactId: contactId || null,
      recipientEmail,
      scopeType: scopeType || 'read_only',
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Write activity log
    const logRef = adminDb.collection('activityLogs').doc();
    batch.set(logRef, {
      action: 'access.link_issued',
      userId: issuedByUserId || 'system',
      email: recipientEmail,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        linkId: linkRef.id,
        assignmentId: assignmentRef.id,
        entityId,
        entityType,
        recipientEmail,
        correlationId: linkData.correlationId
      }
    });

    // Log assignment creation
    const assignmentLogRef = adminDb.collection('activityLogs').doc();
    batch.set(assignmentLogRef, {
      action: 'access.assignment_created',
      userId: issuedByUserId || 'system',
      email: recipientEmail,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        assignmentId: assignmentRef.id,
        entityId,
        entityType,
        recipientEmail,
        scopeType: scopeType || 'read_only'
      }
    });

    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      linkId: linkRef.id,
      rawToken // Return the raw token ONLY here
    });

  } catch (error: any) {
    console.error('Error issuing access link:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
