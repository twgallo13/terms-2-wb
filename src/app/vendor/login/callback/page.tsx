'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithLink } from '@/lib/auth-service';
import PublicShell from '@/components/PublicShell';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

function LoginCallbackContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const email = window.localStorage.getItem('emailForSignIn');
      const href = window.location.href;

      if (!email) {
        setStatus('error');
        setError('No email found in local storage. Please use the same browser you used to request the link.');
        return;
      }

      try {
        await signInWithLink(email, href);
        window.localStorage.removeItem('emailForSignIn');
        setStatus('success');
        
        // Redirect to dashboard or appropriate page
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } catch (err: any) {
        console.error('Sign-in error:', err);
        setStatus('error');
        setError(err.message || 'Failed to sign in with the provided link.');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      {status === 'loading' && (
        <>
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Verifying link...</p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          <div className="text-center space-y-2">
            <p className="text-sm font-bold text-slate-900">Sign-in successful!</p>
            <p className="text-xs text-slate-500">Redirecting you to the gateway...</p>
          </div>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle className="w-12 h-12 text-rose-500" />
          <div className="text-center space-y-4">
            <p className="text-sm font-bold text-slate-900">Sign-in failed</p>
            <p className="text-xs text-rose-600 max-w-xs">{error}</p>
            <button 
              onClick={() => router.push('/login')}
              className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Back to Login
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function LoginCallbackPage() {
  return (
    <PublicShell 
      title="Completing Sign-In" 
      subtitle="Please wait while we verify your secure link."
    >
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center py-12 space-y-6">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Loading...</p>
        </div>
      }>
        <LoginCallbackContent />
      </Suspense>
    </PublicShell>
  );
}
