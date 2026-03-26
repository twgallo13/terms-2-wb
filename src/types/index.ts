export type UserRole = 'system_owner' | 'internal_admin' | 'vendor_primary' | 'vendor_signer' | 'vendor_viewer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  isInternal: boolean;
  vendorId?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Vendor {
  id: string;
  legalName: string;
  displayName: string;
  status: 'pending' | 'active' | 'review' | 'archived';
  ownerId: string;
  createdAt: any;
  updatedAt: any;
}

export interface Brand {
  id: string;
  vendorId: string;
  name: string;
  status: 'pending' | 'active' | 'review' | 'archived';
  approvedSiteIds: string[];
  currentQuoteId?: string;
  currentAgreementId?: string;
  currentWBHandoffId?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  vendorId: string;
  brandId: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  version: number;
  createdAt: any;
  updatedAt: any;
}

export interface Agreement {
  id: string;
  agreementNumber: string;
  vendorId: string;
  brandId: string;
  status: 'draft' | 'sent' | 'signed' | 'expired';
  version: number;
  signedAt?: any;
  createdAt: any;
  updatedAt: any;
}
