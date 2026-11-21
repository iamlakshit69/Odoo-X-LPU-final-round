import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { MoneyText } from '../shared/MoneyText';

// Original stylized SVG emblem and player silhouette art (No brand logos or real athletes)
const SPORT_ART: Record<string, { emblem: React.ReactNode; player: React.ReactNode; gradient: string }> = {
  tennis: {
    gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
    emblem: (
      <svg viewBox="0 0 100 100" className="w-16 h-16 text-accent-orange fill-current opacity-80">
        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" />
        <path d="M 20 20 C 50 40 50 60 20 80" fill="none" stroke="currentColor" strokeWidth="5" />
        <path d="M 80 20 C 50 40 50 60 80 80" fill="none" stroke="currentColor" strokeWidth="5" />
      </svg>
    ),
    player: (
      <svg viewBox="0 0 200 200" className="w-full h-full text-accent-orange/70 fill-current">
        <circle cx="95" cy="45" r="14" />
        <path d="M 90 62 L 75 110 L 55 160 L 68 165 L 85 120 L 105 165 L 120 160 L 98 105 L 108 75 L 135 90 L 150 78 L 125 58 Z" />
        <line x1="140" y1="85" x2="175" y2="40" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
        <ellipse cx="180" cy="35" rx="14" ry="10" transform="rotate(-30 180 35)" fill="none" stroke="currentColor" strokeWidth="4" />
      </svg>
    ),
  },
  padel: {
    gradient: 'from-blue-500/20 via-cyan-500/10 to-transparent',
    emblem: (
      <svg viewBox="0 0 100 100" className="w-16 h-16 text-cyan-500 fill-current opacity-80">
        <rect x="20" y="15" width="60" height="70" rx="30" fill="none" stroke="currentColor" strokeWidth="6" />
        <line x1="50" y1="75" x2="50" y2="95" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
        <circle cx="40" cy="35" r="3" />
        <circle cx="50" cy="35" r="3" />
        <circle cx="60" cy="35" r="3" />
        <circle cx="45" cy="45" r="3" />
        <circle cx="55" cy="45" r="3" />
      </svg>
    ),
    player: (
      <svg viewBox="0 0 200 200" className="w-full h-full text-cyan-500/70 fill-current">
        <circle cx="85" cy="40" r="14" />
        <path d="M 80 58 L 60 95 L 45 155 L 60 158 L 74 108 L 95 155 L 110 150 L 90 95 L 105 70 L 125 78 L 135 68 L 110 54 Z" />
        <line x1="125" y1="75" x2="145" y2="45" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
        <ellipse cx="152" cy="38" rx="12" ry="9" transform="rotate(-40 152 38)" fill="none" stroke="currentColor" strokeWidth="4" />
      </svg>
    ),
  },
  badminton: {
    gradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    emblem: (
      <svg viewBox="0 0 100 100" className="w-16 h-16 text-emerald-500 fill-current opacity-80">
        <path d="M 35 25 L 65 25 L 55 65 L 45 65 Z" fill="none" stroke="currentColor" strokeWidth="5" />
        <ellipse cx="50" cy="74" rx="10" ry="8" fill="currentColor" />
        <line x1="38" y1="35" x2="62" y2="35" stroke="currentColor" strokeWidth="3" />
        <line x1="42" y1="48" x2="58" y2="48" stroke="currentColor" strokeWidth="3" />
      </svg>
    ),
    player: (
      <svg viewBox="0 0 200 200" className="w-full h-full text-emerald-500/70 fill-current">
        <circle cx="105" cy="45" r="13" />
        <path d="M 100 62 L 85 105 L 75 160 L 90 162 L 98 115 L 120 160 L 132 155 L 112 100 L 125 75 L 145 60 L 138 50 L 115 58 Z" />
        <line x1="140" y1="55" x2="170" y2="25" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <circle cx="178" cy="18" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
      </svg>
    ),
  },
  cricket: {
    gradient: 'from-purple-500/20 via-indigo-500/10 to-transparent',
    emblem: (
      <svg viewBox="0 0 100 100" className="w-16 h-16 text-indigo-500 fill-current opacity-80">
        <line x1="35" y1="20" x2="35" y2="85" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <line x1="50" y1="20" x2="50" y2="85" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <line x1="65" y1="20" x2="65" y2="85" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <line x1="28" y1="18" x2="72" y2="18" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </svg>
    ),
    player: (
      <svg viewBox="0 0 200 200" className="w-full h-full text-indigo-500/70 fill-current">
        <circle cx="90" cy="45" r="14" />
        <path d="M 85 62 L 72 105 L 60 160 L 74 162 L 84 115 L 102 160 L 116 156 L 98 100 L 112 75 L 130 95 L 140 85 L 110 60 Z" />
        <rect x="125" y="80" width="12" height="60" rx="3" transform="rotate(-35 125 80)" fill="currentColor" />
      </svg>
    ),
  },
};

export function SportSpotlightRotator() {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch court types and courts dynamically from API
  const { data: courtTypes = [] } = useQuery({
    queryKey: ['court-types'],
    queryFn: () => api.courts.listCourtTypes(),
    retry: 1,
  });

  const { data: courts = [] } = useQuery({
    queryKey: ['courts-list'],
    queryFn: () => api.courts.listCourts(),
    retry: 1,
  });

  // Calculate court count per court type code
  const courtCounts = React.useMemo(() => {
    const map: Record<string, number> = {};
    courts.forEach((c) => {
      const typeCode = c.courtTypeCode || 'general';
      map[typeCode] = (map[typeCode] || 0) + 1;
    });
    return map;
  }, [courts]);

  const items = courtTypes.length > 0
    ? courtTypes
    : [
        { id: '1', code: 'tennis', name: 'Tennis Courts', basePricePerHourPaise: 150000 },
        { id: '2', code: 'padel', name: 'Padel Arenas', basePricePerHourPaise: 200000 },
        { id: '3', code: 'badminton', name: 'Badminton Halls', basePricePerHourPaise: 100000 },
        { id: '4', code: 'cricket', name: 'Cricket Practice Nets', basePricePerHourPaise: 120000 },
      ];

  useEffect(() => {
    if (items.length <= 1) return;

    const interval = setInterval(() => {
      if (!isPaused && document.visibilityState === 'visible') {
        setIndex((prev) => (prev + 1) % items.length);
      }
    }, 3500);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setIsPaused(true);
      } else {
        setIsPaused(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [items.length, isPaused]);

  const current = items[index] || items[0];
  const artKey = (current.code || 'tennis').toLowerCase();
  const art = SPORT_ART[artKey] || SPORT_ART.tennis;
  const count = courtCounts[current.code] || (artKey === 'tennis' ? 3 : artKey === 'padel' ? 2 : 2);

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative overflow-hidden rounded-[24px] border border-border bg-surface p-6 shadow-md transition-all duration-500 min-h-[260px] flex flex-col justify-between"
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${art.gradient} opacity-50 pointer-events-none transition-all duration-700`}
      />

      {/* Background illustration */}
      <div className="absolute right-2 -bottom-4 w-44 h-44 opacity-20 pointer-events-none transition-transform duration-700 ease-out">
        {art.player}
      </div>

      <div className="relative z-10 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-canvas border border-border shadow-inner">
            {art.emblem}
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-accent-orange">
              Sport Spotlight
            </span>
            <h3 className="text-2xl font-black tracking-tight text-primaryText transition-opacity duration-300">
              {current.name}
            </h3>
          </div>
        </div>

        <div className="text-right">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-accent-lime/20 text-lime-900 dark:text-lime-300 border border-accent-lime/40">
            {count} {count === 1 ? 'Court' : 'Courts'} Available
          </span>
        </div>
      </div>

      <div className="relative z-10 mt-6 flex items-end justify-between pt-4 border-t border-border/60">
        <div>
          <p className="text-xs text-mutedText">Starting rack rate</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <MoneyText
              paise={current.basePricePerHourPaise}
              className="text-2xl font-extrabold text-primaryText"
            />
            <span className="text-xs text-mutedText">/ hour</span>
          </div>
        </div>

        {/* Carousel indicators */}
        <div className="flex items-center gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? 'w-6 bg-accent-orange' : 'w-2 bg-border hover:bg-mutedText'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
