'use client';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Sparklines, SparklinesLine, SparklinesSpots } from 'react-sparklines';
import clsx from 'clsx';
import { Badge } from './Badge';
import type { Trend } from '../../lib/api';

interface Props {
  trend: Trend;
  rank?: number;
}

export function TrendCard({ trend, rank }: Props) {
  const growth = trend.growth_rate;
  const isUp   = growth > 2;
  const isDown = growth < -2;

  const GrowthIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const growthColor = isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-400';
  const growthBadge = isUp ? 'success' : isDown ? 'danger' : 'neutral';

  const tags   = trend.metadata?.tags   ?? [];
  const colors = trend.metadata?.colors ?? [];

  const historyScores = trend.history?.map(h => h.popularity_score * 100) ?? [];

  return (
    <Link href={`/trends/${trend.id}`}>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 card-hover cursor-pointer h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {rank !== undefined && (
              <span className="flex-shrink-0 w-6 h-6 rounded-md bg-gray-800 text-gray-500 text-xs font-bold flex items-center justify-center">
                {rank}
              </span>
            )}
            <h3 className="font-semibold text-white text-sm truncate">{trend.name}</h3>
          </div>
          <Badge variant={growthBadge} dot>
            <GrowthIcon className="w-2.5 h-2.5" />
            {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
          </Badge>
        </div>

        {/* Sparkline */}
        {historyScores.length > 1 && (
          <div className="mb-4 h-10">
            <Sparklines data={historyScores} height={40}>
              <SparklinesLine
                color={isUp ? '#4ade80' : isDown ? '#f87171' : '#6366f1'}
                style={{ strokeWidth: 1.5, fill: 'none' }}
              />
              <SparklinesSpots size={2} style={{ fill: isUp ? '#4ade80' : isDown ? '#f87171' : '#6366f1' }} />
            </Sparklines>
          </div>
        )}

        {/* Popularity bar */}
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-gray-500 mb-1.5">
            <span>Popularity</span>
            <span className="font-medium text-gray-400">{(trend.popularity_score * 100).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-1000',
                trend.popularity_score > 0.8 ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                trend.popularity_score > 0.5 ? 'bg-gradient-to-r from-indigo-500 to-purple-500' :
                'bg-gradient-to-r from-blue-500 to-indigo-500'
              )}
              style={{ width: `${trend.popularity_score * 100}%` }}
            />
          </div>
        </div>

        {/* Colors + tags */}
        <div className="mt-auto space-y-2">
          {colors.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-600">Palette</span>
              <div className="flex gap-1">
                {colors.slice(0, 6).map((color, i) => (
                  <div
                    key={i}
                    title={color}
                    className="w-4 h-4 rounded-sm border border-gray-700"
                    style={{ backgroundColor: color.startsWith('#') ? color : colorNameToHex(color) }}
                  />
                ))}
              </div>
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map(tag => (
                <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-gray-800 text-gray-500 rounded">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function TrendCardSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton h-4 w-12 rounded-full" />
      </div>
      <div className="skeleton h-10 w-full rounded mb-4" />
      <div className="skeleton h-1.5 w-full rounded-full mb-4" />
      <div className="flex gap-1">
        {[1,2,3].map(i => <div key={i} className="skeleton h-3 w-12 rounded" />)}
      </div>
    </div>
  );
}

function colorNameToHex(name: string): string {
  const map: Record<string, string> = {
    white: '#ffffff', black: '#000000', grey: '#808080', gray: '#808080',
    navy: '#001f5b', brown: '#7b4f2e', burgundy: '#800020', sage: '#87ae73',
    cream: '#fffdd0', dusty_rose: '#dcae96', hot_pink: '#ff69b4',
    silver: '#c0c0c0', baby_blue: '#89cff0', olive: '#808000',
    orange: '#ff8c00', blue: '#0057b8', red: '#cc0000', green: '#008000',
  };
  return map[name.toLowerCase().replace(/\s+/g, '_')] ?? '#6b7280';
}
