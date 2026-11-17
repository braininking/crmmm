import { X } from 'lucide-react';
import type { LeadTag } from '../types/crm';

const TAG_STYLES: Record<LeadTag['color'], string> = {
  teal: 'bg-teal-50 text-teal-800 border-teal-200',
  indigo: 'bg-sky-50 text-sky-800 border-sky-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  rose: 'bg-rose-50 text-rose-800 border-rose-200',
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

interface TagBadgeProps {
  tag: LeadTag;
  onRemove?: () => void;
}

export function TagBadge({ tag, onRemove }: TagBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium leading-tight whitespace-nowrap shrink-0 ${TAG_STYLES[tag.color]}`}
    >
      <span>{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remover etiqueta ${tag.name}`}
          className="hover:opacity-75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 rounded-xs"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
