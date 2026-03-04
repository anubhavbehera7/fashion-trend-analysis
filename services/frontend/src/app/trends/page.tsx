'use client';
import { useEffect, useState, useCallback } from 'react';
import { Search, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { api, type Trend } from '../../lib/api';
import { TrendCard, TrendCardSkeleton } from '../../components/ui/TrendCard';
import { Badge } from '../../components/ui/Badge';
import clsx from 'clsx';

type SortOption = { label: string; sortBy: string; order: string };

const SORT_OPTIONS: SortOption[] = [
  { label: 'Most Popular',  sortBy: 'popularity_score', order: 'desc' },
  { label: 'Fastest Growth', sortBy: 'growth_rate',     order: 'desc' },
  { label: 'Newest',        sortBy: 'created_at',        order: 'desc' },
  { label: 'Oldest',        sortBy: 'created_at',        order: 'asc'  },
];

export default function TrendsPage() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [filtered, setFiltered] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortIdx, setSortIdx] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 18;

  const fetchTrends = useCallback(() => {
    setLoading(true);
    const sort = SORT_OPTIONS[sortIdx];
    api.trends.list({
      page,
      limit: PAGE_SIZE,
      sortBy: sort.sortBy,
      order: sort.order,
    })
      .then((res) => {
        const d = res as { data: Trend[]; pagination: Record<string, number> };
        setTrends(d.data ?? []);
        setTotal(d.pagination?.total ?? 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sortIdx, page]);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? trends.filter(t =>
            t.name.toLowerCase().includes(q) ||
            t.metadata?.tags?.some(tag => tag.toLowerCase().includes(q))
          )
        : trends
    );
  }, [search, trends]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Fashion Trends</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {total > 0 ? `${total} trends detected` : 'Analyzing trends…'}
          </p>
        </div>
        <Badge variant="purple">{SORT_OPTIONS[sortIdx].label}</Badge>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Filter by name or tag…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 rounded-lg p-1">
          <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500 ml-1.5" />
          {SORT_OPTIONS.map((opt, i) => (
            <button
              key={i}
              onClick={() => { setSortIdx(i); setPage(1); }}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                sortIdx === i
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <TrendCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <TrendingUp className="w-8 h-8 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {search ? `No trends matching "${search}"` : 'No trends detected yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((trend, i) => (
            <TrendCard
              key={trend.id}
              trend={trend}
              rank={(page - 1) * PAGE_SIZE + i + 1}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !search && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs bg-gray-900 border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-xs bg-gray-900 border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
