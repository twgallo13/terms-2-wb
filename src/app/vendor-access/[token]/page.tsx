'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { accessService } from '@/lib/access-service';
import { Loader2, AlertCircle } from 'lucide-react';

export default function VendorAccessPage() {
  const { token } = useParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const validate = async () => {
      if (!token || typeof token !== 'string') return;

      try {
        const result = await accessService.validateLink(token);
        const { entityId } = result;

        // Redirect to the read-only review page
        // The token is now stored in a secure cookie set by the validate API
        router.push(`/vendor/review/${entityId}`);
      } catch (err: any) {
        console.error('Validation error:', err);
        setError(err.message || 'Invalid or expired access link.');
        setIsValidating(false);
      }
    };

    validate();
  }, [token, router]);

  if (isValidating) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-stone-400 mx-auto" />
          <h1 className="text-2xl font-serif italic text-stone-800">Validating Secure Access...</h1>
          <p className="text-stone-500 max-w-md">
            Please wait while we verify your secure access token for the Terms Workbench Gateway.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-sm border border-stone-200 text-center space-y-6">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-serif italic text-stone-800">Access Denied</h1>
          <p className="text-stone-600">
            {error || 'This access link is invalid, expired, or has been revoked.'}
          </p>
        </div>
        <div className="pt-4 border-t border-stone-100">
          <p className="text-sm text-stone-400">
            If you believe this is an error, please contact your brand representative to issue a new access link.
          </p>
        </div>
      </div>
    </div>
  );
}
