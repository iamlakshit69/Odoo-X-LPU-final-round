import React from 'react';
import { formatPaise } from '../../lib/utils';

interface MoneyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  paise: number | null | undefined;
  className?: string;
  showZeroAsFree?: boolean;
}

export function MoneyText({ paise, className = '', showZeroAsFree = false, ...props }: MoneyTextProps) {
  if (showZeroAsFree && paise === 0) {
    return (
      <span className={`inline-flex items-center font-medium text-emerald-600 dark:text-emerald-400 ${className}`} {...props}>
        FREE
      </span>
    );
  }

  const isNegative = typeof paise === 'number' && paise < 0;

  return (
    <span
      className={`font-mono font-medium ${isNegative ? 'text-red-500' : ''} ${className}`}
      {...props}
    >
      {formatPaise(paise)}
    </span>
  );
}
