'use client';
import { type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface Props {
  label: string;
  value: number | string;
  sub?: string;
  icon: LucideIcon;
  color: 'purple' | 'blue' | 'green' | 'orange';
  prefix?: string;
  suffix?: string;
  animate?: boolean;
}

const colorMap = {
  purple: { icon: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', glow: 'shadow-purple-500/10' },
  blue:   { icon: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   glow: 'shadow-blue-500/10'   },
  green:  { icon: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  glow: 'shadow-green-500/10'  },
  orange: { icon: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', glow: 'shadow-orange-500/10' },
};

function useCountUp(target: number, duration = 1200) {
  const [current, setCurrent] = useState(0);
  const frame = useRef<number>(0);

  useEffect(() => {
    if (target === 0) { setCurrent(0); return; }
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(ease * target));
      if (progress < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return current;
}

export function StatCard({ label, value, sub, icon: Icon, color, prefix = '', suffix = '', animate = true }: Props) {
  const c = colorMap[color];
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
  const animated = useCountUp(animate ? numericValue : 0);
  const displayValue = animate && typeof value === 'number'
    ? `${prefix}${animated.toLocaleString()}${suffix}`
    : `${prefix}${typeof value === 'number' ? value.toLocaleString() : value}${suffix}`;

  return (
    <div className={clsx(
      'relative bg-gray-900 rounded-xl p-5 border card-hover overflow-hidden',
      c.border,
      `shadow-lg ${c.glow}`
    )}>
      {/* Background glow */}
      <div className={clsx('absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 blur-2xl', c.bg)} />

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="mt-2 text-2xl font-bold text-white">{displayValue}</p>
          {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
        </div>
        <div className={clsx('p-2.5 rounded-lg', c.bg)}>
          <Icon className={clsx('w-5 h-5', c.icon)} />
        </div>
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-7 w-16 rounded mt-3" />
          <div className="skeleton h-2.5 w-20 rounded mt-2" />
        </div>
        <div className="skeleton w-10 h-10 rounded-lg" />
      </div>
    </div>
  );
}
