'use client';
import { useEffect, useState } from 'react';
import { ImageIcon, TrendingUp, Zap, Activity } from 'lucide-react';
import { api, type AnalyticsOverview } from '../../lib/api';
import { StatCard, StatCardSkeleton } from './StatCard';

export function StatsGrid() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.analytics.overview()
      .then(setOverview)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Images"
        value={overview?.images.total ?? 0}
        sub={`${(overview?.images.processed ?? 0).toLocaleString()} processed`}
        icon={ImageIcon}
        color="blue"
      />
      <StatCard
        label="Active Trends"
        value={overview?.trends.total ?? 0}
        sub={`Avg score: ${overview?.trends.avgPopularity?.toFixed(2) ?? '—'}`}
        icon={TrendingUp}
        color="purple"
      />
      <StatCard
        label="Fastest Growth"
        value={overview?.trends.maxGrowthRate ?? 0}
        sub="Max weekly growth rate"
        icon={Zap}
        color="green"
        prefix="+"
        suffix="%"
      />
      <StatCard
        label="Images Today"
        value={overview?.activity.imagesLast24h ?? 0}
        sub="Last 24 hours"
        icon={Activity}
        color="orange"
      />
    </div>
  );
}
