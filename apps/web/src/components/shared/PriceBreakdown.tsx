import React from 'react';
import { MoneyText } from './MoneyText';
import { Tag, Receipt } from 'lucide-react';

export interface BreakdownLine {
  ruleId?: string;
  label: string;
  deltaPaise: number;
}

interface PriceBreakdownProps {
  basePaise?: number;
  totalPaise: number;
  breakdown?: BreakdownLine[] | null;
  tier?: string;
  className?: string;
}

export function PriceBreakdown({
  basePaise,
  totalPaise,
  breakdown,
  tier,
  className = '',
}: PriceBreakdownProps) {
  return (
    <div className={`p-4 rounded-xl border border-border bg-surface-muted/50 space-y-3 ${className}`}>
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-accent-orange" />
          <span className="text-xs font-semibold uppercase tracking-wider text-mutedText">
            Pricing Breakdown (Engine Quote)
          </span>
        </div>
        {tier && (
          <span className="text-xs uppercase px-2 py-0.5 font-bold rounded-full bg-accent-lime/20 text-lime-900 dark:text-lime-300">
            {tier} Tier
          </span>
        )}
      </div>

      {basePaise !== undefined && (
        <div className="flex justify-between items-center text-sm text-mutedText">
          <span>Base Hourly Rate</span>
          <MoneyText paise={basePaise} />
        </div>
      )}

      {breakdown && breakdown.length > 0 ? (
        <div className="space-y-1.5">
          {breakdown.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5 text-mutedText">
                <Tag className="w-3 h-3 text-accent-orange" />
                {item.label}
              </span>
              <MoneyText paise={item.deltaPaise} className="font-medium" />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-mutedText italic">Standard rack rate applied</div>
      )}

      <div className="pt-2 border-t border-border flex justify-between items-baseline">
        <span className="text-sm font-bold text-primaryText">Final Total</span>
        <MoneyText paise={totalPaise} className="text-lg font-bold text-accent-orange" />
      </div>
    </div>
  );
}
