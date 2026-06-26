import clsx from 'clsx';

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx('rounded px-2 py-0.5 text-xs font-semibold uppercase', {
        'bg-slate-700 text-slate-100': status === 'pending',
        'bg-amber-600/80 text-amber-100': status === 'in_progress',
        'bg-emerald-700 text-emerald-100': status === 'completed',
      })}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
