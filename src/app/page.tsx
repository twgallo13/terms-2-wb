'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, LayoutDashboard, Users, Zap, Database } from 'lucide-react';
import { motion } from 'motion/react';
import { seedAllowlists } from '@/lib/seed-data';
import { auth } from '@/lib/auth-service';

export default function RootPage() {
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [seedStatus, setSeedStatus] = React.useState<string | null>(null);

  const handleSeed = async () => {
    if (!auth.currentUser) {
      setSeedStatus('Error: Must be logged in to seed.');
      return;
    }
    setIsSeeding(true);
    setSeedStatus('Seeding...');
    try {
      await seedAllowlists();
      setSeedStatus('Seed Successful!');
    } catch (err: any) {
      console.error(err);
      setSeedStatus(`Seed Failed: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  React.useEffect(() => {
    console.log('RootPage mounted - Terms Workbench Gateway starting...');
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 blur-[120px] rounded-full -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/20 blur-[120px] rounded-full translate-y-1/2"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-3xl space-y-8 relative z-10"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-4">
          <Zap className="w-3 h-3" />
          Terms Workbench Gateway v1.0
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
          Accelerate Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Vendor Onboarding</span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 font-medium max-w-2xl mx-auto">
          A secure, automated commercial and legal gateway for dropship vendors. 
          Bridge the gap between initial contact and Workbench integration.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link 
            href="/internal-login"
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold shadow-2xl shadow-blue-600/40 transition-all flex items-center justify-center gap-2 group"
          >
            Enter Admin Dashboard
            <LayoutDashboard className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link 
            href="/login"
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-2xl font-bold border border-slate-700 transition-all flex items-center justify-center gap-2"
          >
            Vendor Sign In
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Hidden Seed Button for Dev */}
        <div className="pt-4 flex flex-col items-center gap-2">
          <button 
            onClick={handleSeed}
            disabled={isSeeding}
            className="text-[10px] text-slate-700 hover:text-slate-500 font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-colors opacity-20 hover:opacity-100"
          >
            <Database className="w-3 h-3" />
            {isSeeding ? 'Seeding...' : 'Initialize System Data'}
          </button>
          {seedStatus && (
            <p className={`text-[10px] font-bold uppercase tracking-widest ${seedStatus.includes('Error') || seedStatus.includes('Failed') ? 'text-rose-500' : 'text-emerald-500'}`}>
              {seedStatus}
            </p>
          )}
        </div>

        <div className="pt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          {[
            { icon: ShieldCheck, title: "Secure Access", desc: "Token-based vendor authentication with 48h expiry." },
            { icon: Zap, title: "Rapid Quotes", desc: "Automated commercial term generation and acceptance." },
            { icon: Users, title: "WB Ready", desc: "Seamless handoff to the Workbench team upon completion." }
          ].map((feature, idx) => (
            <div key={idx} className="space-y-3 p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
                <feature.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-200">{feature.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="absolute bottom-8 text-slate-600 text-[10px] font-bold uppercase tracking-widest">
        &copy; 2026 Terms Workbench Gateway • Shiekh Shoes Operations
      </div>
    </div>
  );
}
