'use client';
import { useState } from 'react';
import { Upload, CheckCircle, XCircle, ArrowRight, Cpu, Database, TrendingUp, Layers } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import clsx from 'clsx';

const SOURCES = [
  { value: 'manual',    label: 'Manual' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'blog',      label: 'Fashion Blog' },
];

const HOW_IT_WORKS = [
  { icon: Upload,     label: 'Submit',   desc: 'URL is queued via API Gateway' },
  { icon: Cpu,        label: 'Extract',  desc: 'C++ processor extracts 512D feature vector (SIFT + ORB + HSV)' },
  { icon: Database,   label: 'Index',    desc: 'Vector stored in Qdrant for similarity search' },
  { icon: Layers,     label: 'Cluster',  desc: 'ML clusters similar images with DBSCAN' },
  { icon: TrendingUp, label: 'Trend',    desc: 'Velocity and growth rate updated on dashboard' },
];

export default function UploadPage() {
  const [url, setUrl]       = useState('');
  const [source, setSource] = useState('manual');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setStatus('loading');
    try {
      const res = await api.images.upload(url.trim(), source) as { message?: string };
      setStatus('success');
      setMessage(res.message || 'Image queued for processing');
      setUrl('');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  return (
    <div className="max-w-2xl space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Upload className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-purple-400 uppercase tracking-widest">Image Pipeline</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Upload Fashion Image</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Submit an image URL for feature extraction and trend clustering
        </p>
      </div>

      {/* Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* URL input */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Image URL
            </label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com/fashion-photo.jpg"
              required
              className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/20 transition-all"
            />
          </div>

          {/* Source selector */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Source
            </label>
            <div className="flex gap-2 flex-wrap">
              {SOURCES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSource(s.value)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    source === s.value
                      ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {status === 'loading' ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing…
              </>
            ) : (
              <>Submit for Analysis <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        {/* Feedback */}
        {status === 'success' && (
          <div className="mt-4 flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-green-400 font-medium">{message}</p>
              <p className="text-xs text-gray-500 mt-0.5">Feature extraction runs in the background — check the dashboard in a few seconds.</p>
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="mt-4 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{message}</p>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-5">How It Works</h2>
        <div className="space-y-4">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <step.icon className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-purple-400">{i + 1}.</span>
                  <span className="text-sm font-medium text-white">{step.label}</span>
                  {i === 0 && <Badge variant="info">Start</Badge>}
                  {i === HOW_IT_WORKS.length - 1 && <Badge variant="success">End</Badge>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
