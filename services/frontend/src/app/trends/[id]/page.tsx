'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus,
  Calendar, Hash, Palette,
} from 'lucide-react';
import { Sparklines, SparklinesLine, SparklinesSpots, SparklinesReferenceLine } from 'react-sparklines';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api, type Trend } from '../../../lib/api';
import { Badge } from '../../../components/ui/Badge';

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

export default function TrendDetailPage() {
  const params  = useParams();
  const id      = parseInt(params.id as string);
  const [trend, setTrend]   = useState<Trend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.trends.get(id)
      .then(setTrend)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-32 rounded-xl" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  if (error || !trend) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
        <p className="text-gray-500">
          {error ?? 'Trend not found'}
        </p>
        <Link href="/trends" className="mt-4 inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to trends
        </Link>
      </div>
    );
  }

  const growth    = trend.growth_rate;
  const isUp      = growth > 2;
  const isDown    = growth < -2;
  const GrowthIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const growthVariant = isUp ? 'success' : isDown ? 'danger' : 'neutral';

  const historyScores = trend.history?.map(h => h.popularity_score * 100) ?? [];
  const historyChartData = trend.history?.map(h => ({
    date: new Date(h.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    score: Math.round(h.popularity_score * 100),
    images: h.image_count,
  })) ?? [];

  const sparkColor = isUp ? '#4ade80' : isDown ? '#f87171' : '#818cf8';
  const tags   = trend.metadata?.tags   ?? [];
  const colors = trend.metadata?.colors ?? [];

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* Back */}
      <Link
        href="/trends"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to trends
      </Link>

      {/* Hero card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Trend #{trend.id} · Cluster {trend.cluster_id}</p>
            <h1 className="text-2xl font-bold text-white">{trend.name}</h1>
          </div>
          <Badge variant={growthVariant} dot>
            <GrowthIcon className="w-3 h-3" />
            {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
          </Badge>
        </div>

        {/* Popularity bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Popularity score</span>
            <span className="font-medium text-gray-300">{(trend.popularity_score * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000"
              style={{ width: `${trend.popularity_score * 100}%` }}
            />
          </div>
        </div>

        {/* Sparkline */}
        {historyScores.length > 1 && (
          <div className="mb-6">
            <p className="text-xs text-gray-500 mb-2">History</p>
            <Sparklines data={historyScores} height={50}>
              <SparklinesLine color={sparkColor} style={{ strokeWidth: 2, fill: 'none' }} />
              <SparklinesSpots size={3} style={{ fill: sparkColor }} />
              <SparklinesReferenceLine type="mean" style={{ stroke: '#374151', strokeDasharray: '4 4' }} />
            </Sparklines>
          </div>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm border-t border-gray-800 pt-4">
          <div className="flex items-center gap-2 text-gray-400">
            <Calendar className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-xs">
              Created {new Date(trend.created_at).toLocaleDateString('en', { dateStyle: 'medium' })}
            </span>
          </div>
          {tags.length > 0 && (
            <div className="flex items-center gap-2">
              <Hash className="w-3.5 h-3.5 text-gray-600" />
              <div className="flex flex-wrap gap-1">
                {tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 text-[10px] bg-gray-800 text-gray-400 rounded">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {colors.length > 0 && (
            <div className="flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-gray-600" />
              <div className="flex gap-1.5">
                {colors.slice(0, 8).map((c, i) => (
                  <div
                    key={i}
                    title={c}
                    className="w-5 h-5 rounded border border-gray-700"
                    style={{ backgroundColor: c.startsWith('#') ? c : colorNameToHex(c) }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full history chart */}
      {historyChartData.length > 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Popularity Over Time
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={historyChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }}
                labelStyle={{ color: '#f9fafb' }}
              />
              <Line
                type="monotone"
                dataKey="score"
                name="Popularity %"
                stroke={sparkColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: sparkColor }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
