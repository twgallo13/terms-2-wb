'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Tag, 
  FileText, 
  ClipboardCheck, 
  Files, 
  ArrowRightLeft, 
  BarChart3, 
  Settings, 
  LogOut,
  Bell,
  Search,
  Menu,
  X
} from 'lucide-react';
import { cn } from './ui/Primitives';
import { logout, auth, getUserProfile } from '@/lib/auth-service';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Vendors', href: '/vendors', icon: Users },
  { label: 'Brands', href: '/brands', icon: Tag },
  { label: 'Quotes', href: '/quotes', icon: FileText },
  { label: 'Agreements', href: '/agreements', icon: ClipboardCheck },
  { label: 'Documents', href: '/documents', icon: Files },
  { label: 'WB Handoffs', href: '/wb-handoffs', icon: ArrowRightLeft },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function AppShell({ children, rightRail }: { children: React.ReactNode; rightRail?: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(true);
  const [userProfile, setUserProfile] = React.useState<any>(null);
  const router = useRouter();

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/internal-login');
        return;
      }

      if (!user.emailVerified) {
        router.push('/internal-login');
        return;
      }

      try {
        const profile = await getUserProfile(user.uid);
        if (!profile || !profile.isInternal) {
          // If not internal, they might be a vendor or unauthorized
          router.push('/login');
          return;
        }
        setUserProfile(profile);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching user profile:', error);
        router.push('/internal-login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await logout();
      router.push('/internal-login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={cn(
        "bg-slate-900 text-slate-300 w-64 flex-shrink-0 flex flex-col transition-all duration-300 border-r border-slate-800",
        !isSidebarOpen && "-ml-64"
      )}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-800/50">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">T</div>
          <span className="font-bold text-white tracking-tight">TWG Admin</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                  isActive 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                    : "hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className={cn("w-4 h-4", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-300")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/50">
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="bg-white h-16 border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search vendors, brands, or agreements..." 
                className="pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-slate-200 focus:ring-0 rounded-full text-sm w-80 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 relative transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-200 mx-1"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 leading-none">{userProfile?.displayName || 'User'}</p>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-1">{userProfile?.role?.replace('_', ' ') || 'Administrator'}</p>
              </div>
              <div className="w-9 h-9 bg-slate-200 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-slate-600 font-bold overflow-hidden">
                {userProfile?.displayName?.split(' ').map((n: string) => n[0]).join('') || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Content Scroll Area */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className={cn(
            "max-w-7xl mx-auto flex gap-8",
            rightRail ? "flex-col lg:flex-row" : "flex-col"
          )}>
            <div className="flex-1 min-w-0">
              {children}
            </div>
            
            {rightRail && (
              <aside className="w-full lg:w-80 flex-shrink-0 space-y-6">
                {rightRail}
              </aside>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
