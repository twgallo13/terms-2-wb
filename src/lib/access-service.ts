/**
 * Access Service
 * Client-side interface for secure vendor access link management.
 * These functions call Next.js API routes which perform backend-controlled operations.
 */

export interface AccessLinkRequest {
  entityId: string;
  entityType: 'quote' | 'agreement';
  entityVersionId?: string;
  vendorId?: string;
  brandId?: string;
  contactId?: string;
  recipientEmail: string;
  purpose?: string;
  scopeType?: string;
  sentVersionHash?: string;
  issuedByUserId?: string;
  correlationId?: string;
  maxUses?: number;
}

export const accessService = {
  /**
   * Issue a new secure vendor review link.
   * Generates a token, hashes it, and stores the hash on the backend.
   * Returns the raw token (only once).
   */
  async issueLink(request: AccessLinkRequest) {
    const response = await fetch('/api/access-links/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to issue access link');
    }

    return response.json();
  },

  /**
   * Validate a secure access token.
   * Hashes the incoming token and compares it with stored hashes on the backend.
   * Enforces expiration, revocation, and status.
   */
  async validateLink(token: string) {
    const response = await fetch('/api/access-links/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Invalid or expired link');
    }

    return response.json();
  },

  /**
   * Revoke an existing access link.
   */
  async revokeLink(linkId: string, revokedByUserId: string, revokedReason?: string) {
    const response = await fetch('/api/access-links/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkId, revokedByUserId, revokedReason }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to revoke access link');
    }

    return response.json();
  },

  /**
   * Supersede existing access links for an entity (e.g., when a new version is created).
   */
  async supersedeLinks(entityId: string, entityType: string, newVersionId?: string, supersededByUserId?: string) {
    const response = await fetch('/api/access-links/supersede', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId, entityType, newVersionId, supersededByUserId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to supersede access links');
    }

    return response.json();
  }
};
