'use client';

import React, { useState, useEffect } from 'react';
import PublicShell from '@/components/PublicShell';
import { Mail, Send, CheckCircle2, ShieldAlert, LogIn, AlertCircle } from 'lucide-react';
import { sendSignInLink, auth } from '@/lib/auth-service';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export default function InternalLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [email, setEmail] = useState('');
  const [isEmailLinkSent, setIsEmailLinkSent] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // If already logged in and verified, go to dashboard
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.emailVerified) {
        router.push('/dashboard');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const mapAuthError = (err: any) => {
    console.error('Auth Error:', err);
    if (err.code === 'auth/operation-not-allowed') {
      return {
        title: 'Provider Disabled',
        message: 'This sign-in method is currently disabled in the Firebase Console. Please contact the system owner to enable Google and Email Link providers.'
      };
    }
    if (err.code === 'auth/popup-blocked') {
      return {
        title: 'Popup Blocked',
        message: 'The sign-in popup was blocked by your browser. Please allow popups for this site and try again.'
      };
    }
    return {
      title: 'Sign-In Failed',
      message: err.message || 'An unexpected error occurred during sign-in.'
    };
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle the redirect
    } catch (err: any) {
      setError(mapAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError({ title: 'Email Required', message: 'Please enter your internal email address' });
      return;
    }
    
    // Basic domain check for internal emails
    if (!email.endsWith('@shiekhshoes.org') && !email.endsWith('@shiekh.com')) {
      setError({ 
        title: 'Invalid Domain', 
        message: 'Only @shiekhshoes.org or @shiekh.com email addresses are permitted for internal login.' 
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await sendSignInLink(email, `${window.location.origin}/internal-login/callback`);
      setIsEmailLinkSent(true);
      window.localStorage.setItem('internalEmailForSignIn', email);
    } catch (err: any) {
      setError(mapAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailLinkSent) {
    return (
      <PublicShell 
        title="Admin Access" 
        subtitle="Check your internal inbox for the secure link."
      >
        <div className="flex flex-col items-center justify-center py-12 space-y-6">
          <CheckCircle2 className="w-16 h-16 text-blue-500" />
          <div className="text-center space-y-4">
            <p className="text-sm font-bold text-slate-900">Link Sent to {email}</p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Please click the link in your email to complete your sign-in. 
              You can close this window now.
            </p>
            <button 
              onClick={() => setIsEmailLinkSent(false)}
              className="text-[10px] font-bold text-blue-600 hover:underline uppercase tracking-wider"
            >
              Didn't receive it? Try again
            </button>
          </div>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell 
      title="Internal Admin Login" 
      subtitle="Restricted access for Shiekh Shoes operations team."
    >
      <div className="space-y-6">
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 items-start">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-amber-900 uppercase tracking-tight">Internal Personnel Only</p>
            <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
              This portal is restricted to authorized internal administrators. 
              Vendors should use the standard login portal.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-1">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-4 h-4" />
              <p className="text-xs font-bold uppercase tracking-tight">{error.title}</p>
            </div>
            <p className="text-[10px] text-rose-500 font-medium leading-relaxed">
              {error.message}
            </p>
          </div>
        )}

        <div className="space-y-4">
          <button 
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-100"></span>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
              <span className="bg-white px-4 text-slate-400">Or use email link</span>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleEmailLinkSignIn}>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Internal Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@shiekhshoes.org" 
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-0 rounded-xl text-sm font-medium transition-all"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-slate-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? 'Sending Link...' : 'Send Admin Sign-In Link'}
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-center">
          <button 
            onClick={() => router.push('/login')}
            className="text-[10px] font-bold text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors"
          >
            Switch to Vendor Login
          </button>
        </div>
      </div>
    </PublicShell>
  );
}
