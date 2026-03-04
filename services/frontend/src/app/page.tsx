'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { api, type Trend } from '../lib/api';
import { StatsGrid } from '../components/ui/StatsGrid';
import { AnalyticsDashboard } from '../components/charts/AnalyticsDashboard';
import { TrendCard, TrendCardSkeleton } from '../components/ui/TrendCard';

export default function HomePage() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.trends.list({ limit: 6, sortBy: 'popularity_score', order: 'desc' })
      .then((res) => setTrends((res as { data: Trend[] }).data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-purple-400 uppercase tracking-widest">Live Dashboard</span>
        </div>
        <h1 className="text-3xl font-bold text-white">
          Fashion Trend{' '}
          <span className="gradient-text">Intelligence</span>
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Real-time trend detection powered by computer vision and ML clustering
        </p>
      </div>

      {/* Stats */}
      <StatsGrid />

      {/* Charts */}
      <AnalyticsDashboard />

      {/* Top Trends */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Top Trending Now</h2>
          <Link
            href="/trends"
            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <TrendCardSkeleton key={i} />)}
          </div>
        ) : trends.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
            <TrendingUp className="w-8 h-8 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-4">
              No trends detected yet. Upload fashion images to get started.
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Upload Images
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trends.map((trend, i) => (
              <TrendCard key={trend.id} trend={trend} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
