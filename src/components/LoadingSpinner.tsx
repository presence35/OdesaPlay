import { Loader2, type LucideIcon } from 'lucide-react';

export default function LoadingSpinner({
  icon: Icon = Loader2,
  text = 'Loading...',
  className = '',
}: {
  icon?: LucideIcon;
  text?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center py-20 ${className}`}>
      <div className="animate-pulse flex flex-col items-center">
        <Icon className="w-12 h-12 text-[var(--text-subtle)] mb-4 animate-spin" />
        <p className="text-[var(--text-subtle)] font-bold uppercase tracking-widest text-sm">{text}</p>
      </div>
    </div>
  );
}
