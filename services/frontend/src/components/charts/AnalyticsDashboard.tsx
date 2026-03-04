'use client';
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { Flame, BarChart2 } from 'lucide-react';
import { api, type VelocityData } from '../../lib/api';
import { Badge } from '../ui/Badge';

const PURPLE = '#a855f7';
const BLUE   = '#3b82f6';
const GREEN  = '#22c55e';

function TooltipBox({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-white mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-gray-400">{p.name}:</span>
          <span className="text-white font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<VelocityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.analytics.velocity()
      .then((res) => setData(res.trends ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="skeleton h-72 rounded-xl" />
        <div className="skeleton h-72 rounded-xl" />
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <BarChart2 className="w-8 h-8 text-gray-700 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">
          {error ? `Analytics unavailable: ${error}` : 'No trend data yet — upload images to get started'}
        </p>
      </div>
    );
  }

  const chart = data.slice(0, 8).map((t) => ({
    name: t.trend_name?.length > 10 ? t.trend_name.slice(0, 10) + '…' : t.trend_name,
    score: Math.round(t.current_score * 100),
    vel7: parseFloat(t.velocity_7d.toFixed(1)),
    vel30: parseFloat(t.velocity_30d.toFixed(1)),
    emerging: t.is_emerging,
  }));

  const emerging = data.filter(t => t.is_emerging);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popularity */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Trend Popularity Scores
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(168,85,247,0.05)' }} />
              <Bar dataKey="score" name="Popularity %" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {chart.map((entry, i) => (
                  <Cell key={i} fill={entry.emerging ? GREEN : PURPLE} fillOpacity={entry.emerging ? 1 : 0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Velocity */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Trend Velocity (% change)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TooltipBox />} cursor={{ fill: 'rgba(59,130,246,0.05)' }} />
              <Legend
                wrapperStyle={{ color: '#6b7280', fontSize: 11, paddingTop: 8 }}
                iconType="circle" iconSize={6}
              />
              <Bar dataKey="vel7" name="7-day %" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar dataKey="vel30" name="30-day %" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Emerging trends */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-4 h-4 text-orange-400" />
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Emerging Trends
          </h3>
          {emerging.length > 0 && (
            <Badge variant="success">{emerging.length} active</Badge>
          )}
        </div>
        {emerging.length === 0 ? (
          <p className="text-gray-600 text-sm">No emerging trends detected this week</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {emerging.map(t => (
              <div key={t.trend_id} className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm text-white font-medium">{t.trend_name}</span>
                <Badge variant="success">+{t.velocity_7d.toFixed(1)}%/wk</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
