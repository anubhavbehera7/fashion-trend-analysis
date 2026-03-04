'use client';
import { useState } from 'react';
import { Search, ImageIcon, ExternalLink } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import clsx from 'clsx';

interface SimilarImage {
  id: number;
  url: string;
  score: number;
  trend_id?: number;
  trend_name?: string;
}

export default function SearchPage() {
  const [imageId, setImageId]     = useState('');
  const [results, setResults]     = useState<SimilarImage[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [searched, setSearched]   = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(imageId);
    if (isNaN(id)) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const res = await fetch(`${API_BASE}/api/images/${id}/similar?limit=12`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResults((data.data ?? data) as SimilarImage[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Search className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-purple-400 uppercase tracking-widest">Similarity Search</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Find Similar Images</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Enter an image ID to search for visually similar fashion items using vector embeddings
        </p>
      </div>

      {/* Search form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="number"
              value={imageId}
              onChange={e => setImageId(e.target.value)}
              placeholder="Enter image ID (e.g. 42)"
              required
              min={1}
              className="w-full pl-9 pr-4 py-3 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/20 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </form>
      </div>

      {/* Results */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {searched && !loading && !error && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">
              Similar Images
            </h2>
            <Badge variant="neutral">{results.length} results</Badge>
          </div>

          {results.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <Search className="w-8 h-8 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No similar images found for ID {imageId}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {results.map((img) => (
                <div
                  key={img.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 card-hover"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-xs font-mono text-gray-500">#{img.id}</span>
                    <Badge
                      variant={img.score > 0.9 ? 'success' : img.score > 0.7 ? 'info' : 'neutral'}
                    >
                      {(img.score * 100).toFixed(0)}% match
                    </Badge>
                  </div>

                  {img.url && (
                    <div className="aspect-square bg-gray-800 rounded-lg mb-3 overflow-hidden">
                      <img
                        src={img.url}
                        alt={`Image ${img.id}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {img.trend_name && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-600">Trend</span>
                        <span className="text-xs text-purple-400 font-medium truncate">{img.trend_name}</span>
                      </div>
                    )}
                    {img.url && (
                      <a
                        href={img.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={clsx(
                          'flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-400 transition-colors truncate'
                        )}
                      >
                        <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate">{img.url.slice(0, 30)}…</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info section */}
      {!searched && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-3">How Similarity Search Works</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Each image is embedded into a 512-dimensional feature vector combining SIFT keypoints,
            ORB descriptors, and HSV color histograms. The vector is L2-normalized and stored in{' '}
            <span className="text-purple-400">Qdrant</span> using HNSW indexing. Cosine similarity
            is computed in real-time to find the nearest neighbors.
          </p>
        </div>
      )}
    </div>
  );
}
