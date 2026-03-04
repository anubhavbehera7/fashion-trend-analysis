import clsx from 'clsx';

interface Props {
  children: React.ReactNode;
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'purple';
  size?: 'sm' | 'md';
  dot?: boolean;
}

const variants = {
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  danger:  'bg-red-500/10 text-red-400 border-red-500/20',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  info:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  neutral: 'bg-gray-700/50 text-gray-400 border-gray-600/30',
  purple:  'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

const dotColors = {
  success: 'bg-green-400',
  danger:  'bg-red-400',
  warning: 'bg-yellow-400',
  info:    'bg-blue-400',
  neutral: 'bg-gray-400',
  purple:  'bg-purple-400',
};

export function Badge({ children, variant = 'neutral', size = 'sm', dot = false }: Props) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 rounded-full border font-medium',
      variants[variant],
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
    )}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
}
