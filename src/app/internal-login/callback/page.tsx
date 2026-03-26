'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithLink, bootstrapInternalUser, auth } from '@/lib/auth-service';
import PublicShell from '@/components/PublicShell';
import { Loader2, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

function InternalLoginCallbackContent() {
  const [status, setStatus] = useState<'loading' | 'verifying' | 'provisioning' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const email = window.localStorage.getItem('internalEmailForSignIn');
      const href = window.location.href;

      if (!email) {
        setStatus('error');
        setError('No email found in local storage. Please use the same browser you used to request the link.');
        return;
      }

      try {
        setStatus('verifying');
        const user = await signInWithLink(email, href);
        window.localStorage.removeItem('internalEmailForSignIn');
        
        if (!user.emailVerified) {
          setStatus('error');
          setError('Email verification failed. Please try again.');
          return;
        }

        setStatus('provisioning');
        // Call bootstrapUser only after verified login
        const bootstrapResult = await bootstrapInternalUser();
        console.log('Bootstrap result:', bootstrapResult);

        setStatus('success');
        
        // Redirect to dashboard
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } catch (err: any) {
        console.error('Sign-in error:', err);
        setStatus('error');
        
        let errorMessage = 'Failed to sign in with the provided link.';
        try {
          const parsedError = JSON.parse(err.message);
          errorMessage = parsedError.message || errorMessage;
        } catch (e) {
          errorMessage = err.message || errorMessage;
        }
        
        setError(errorMessage);
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      {(status === 'loading' || status === 'verifying') && (
        <>
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Verifying secure link...</p>
        </>
      )}

      {status === 'provisioning' && (
        <>
          <ShieldCheck className="w-12 h-12 text-blue-600 animate-pulse" />
          <div className="text-center space-y-2">
            <p className="text-sm font-bold text-slate-900">Provisioning Admin Access</p>
            <p className="text-xs text-slate-500">Setting up your internal profile...</p>
          </div>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          <div className="text-center space-y-2">
            <p className="text-sm font-bold text-slate-900">Admin Sign-in successful!</p>
            <p className="text-xs text-slate-500">Redirecting to dashboard...</p>
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
              onClick={() => router.push('/internal-login')}
              className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Back to Admin Login
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function InternalLoginCallbackPage() {
  return (
    <PublicShell 
      title="Completing Admin Sign-In" 
      subtitle="Please wait while we verify your internal access."
    >
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center py-12 space-y-6">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-600">Loading...</p>
        </div>
      }>
        <InternalLoginCallbackContent />
      </Suspense>
    </PublicShell>
  );
}
