'use client';

import React, { useState } from 'react';
import PublicShell from '@/components/PublicShell';
import { Mail, Lock, ArrowRight, Send, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { loginWithEmail, sendSignInLink } from '@/lib/auth-service';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [isEmailLinkSent, setIsEmailLinkSent] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'link' | 'token'>('link');
  const router = useRouter();

  const handleEmailLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await sendSignInLink(email);
      setIsEmailLinkSent(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to send sign-in link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Please enter your secure access token');
      return;
    }
    router.push(`/vendor-access/${token}`);
  };

  if (isEmailLinkSent) {
    return (
      <PublicShell 
        title="Check Your Email" 
        subtitle="We've sent a secure sign-in link to your inbox."
      >
        <div className="flex flex-col items-center justify-center py-12 space-y-6">
          <CheckCircle2 className="w-16 h-16 text-emerald-500" />
          <div className="text-center space-y-4">
            <p className="text-sm font-bold text-slate-900">Link Sent to {email}</p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Please click the link in the email to complete your sign-in. 
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
      title="Vendor Access" 
      subtitle="Secure access for Terms Workbench Gateway."
    >
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-medium text-rose-600">
            {error}
          </div>
        )}

        {loginMethod === 'link' ? (
          <form className="space-y-6" onSubmit={handleEmailLinkSignIn}>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@shiekhshoes.org" 
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-0 rounded-xl text-sm font-medium transition-all"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? 'Sending Link...' : 'Send Sign-In Link'}
              <Send className="w-4 h-4" />
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                <span className="bg-white px-4 text-slate-400">Or use access token</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLoginMethod('token')}
              className="w-full py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Enter Secure Access Token
            </button>
          </form>
        ) : (
          <form className="space-y-6" onSubmit={handleTokenSignIn}>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Access Token</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter your 16-character token" 
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-0 rounded-xl text-sm font-medium transition-all"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                Tokens are provided in your invitation email or by your brand representative.
              </p>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-slate-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              Verify Token
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                <span className="bg-white px-4 text-slate-400">Or use email link</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLoginMethod('link')}
              className="w-full py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Sign in with Email Link
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-slate-100">
          <p className="text-xs text-center text-slate-500 font-medium">
            Need help? Contact <Link href="#" className="text-blue-600 hover:underline">IT Support</Link>
          </p>
        </div>
      </div>
    </PublicShell>
  );
}
