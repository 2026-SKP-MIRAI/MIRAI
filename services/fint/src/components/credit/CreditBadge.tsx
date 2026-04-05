interface CreditBadgeProps {
  coins: number;
}

export function CreditBadge({ coins }: CreditBadgeProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200">
      <span className="text-sm" aria-hidden="true">🪙</span>
      <span className="text-sm font-bold text-amber-900">{coins}</span>
    </div>
  );
}
