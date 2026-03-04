'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, TrendingUp, Upload, Search,
  Activity, Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import clsx from 'clsx';

const nav = [
  { href: '/',        icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/trends',  icon: TrendingUp,      label: 'Trends'    },
  { href: '/upload',  icon: Upload,          label: 'Upload'    },
  { href: '/search',  icon: Search,          label: 'Search'    },
];

export function Sidebar() {
  const pathname = usePathname();
  const [health, setHealth] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
    const interval = setInterval(() => {
      api.health().then(setHealth).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="fixed inset-y-0 left-0 w-60 flex flex-col bg-gray-900 border-r border-gray-800 z-30">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
          <Zap className="w-4 h-4 text-white" fill="white" />
        </div>
        <div>
          <div className="text-sm font-bold text-white leading-tight">FashionAI</div>
          <div className="text-[10px] text-gray-500 leading-tight">Trend Analysis</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              <Icon className={clsx('w-4 h-4', active ? 'text-purple-400' : '')} />
              {label}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Service Status */}
      <div className="px-4 py-4 border-t border-gray-800">
        <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">
          Services
        </div>
        <div className="space-y-1.5">
          {[
            { key: 'api', label: 'API Gateway' },
            { key: 'ml',  label: 'ML Analysis' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={clsx(
                  'w-1.5 h-1.5 rounded-full',
                  health[key] === undefined ? 'bg-gray-600 animate-pulse' :
                  health[key] ? 'bg-green-400' : 'bg-red-400'
                )} />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
              <span className={clsx(
                'text-[10px] font-medium',
                health[key] === undefined ? 'text-gray-600' :
                health[key] ? 'text-green-500' : 'text-red-500'
              )}>
                {health[key] === undefined ? '...' : health[key] ? 'UP' : 'DOWN'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-800 flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-gray-600" />
        <span className="text-xs text-gray-600">v1.0.0 · Production</span>
      </div>
    </aside>
  );
}
