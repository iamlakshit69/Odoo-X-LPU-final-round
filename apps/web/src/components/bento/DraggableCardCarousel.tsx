import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { MoneyText } from '../shared/MoneyText';
import type { Plan } from '@club/contract';

interface DraggableCardCarouselProps {
  plans: Plan[];
  selectedPlanId?: string;
  onSelectPlan?: (plan: Plan) => void;
}

export function DraggableCardCarousel({
  plans,
  selectedPlanId,
  onSelectPlan,
}: DraggableCardCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;
    const amount = direction === 'left' ? -320 : 320;
    containerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <div className="relative group">
      {/* DRAG cursor / indicator badge */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-mutedText flex items-center gap-2">
          Select Membership Plan
          <span className="px-2 py-0.5 rounded-md bg-surface-muted text-[10px] text-mutedText border border-border">
            DRAG TO SCROLL
          </span>
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="p-1.5 rounded-full border border-border bg-surface hover:bg-canvas text-primaryText transition-colors shadow-sm"
            aria-label="Previous plans"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="p-1.5 rounded-full border border-border bg-surface hover:bg-canvas text-primaryText transition-colors shadow-sm"
            aria-label="Next plans"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className={`flex gap-4 overflow-x-auto pb-4 pt-1 px-1 scroll-smooth select-none cursor-grab active:cursor-grabbing snap-x snap-mandatory scrollbar-none`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id || selectedPlanId === plan.code;

          return (
            <div
              key={plan.id}
              onClick={() => onSelectPlan?.(plan)}
              className={`flex-shrink-0 w-80 rounded-[24px] border p-6 transition-all duration-200 snap-center cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-accent-orange bg-surface ring-2 ring-accent-orange/30 shadow-lg'
                  : 'border-border bg-surface hover:border-border/80 hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-accent-lime/20 text-lime-900 dark:text-lime-300 border border-accent-lime/40">
                    {plan.code} Tier
                  </span>
                  {isSelected && (
                    <span className="w-6 h-6 rounded-full bg-accent-orange text-white flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                </div>

                <h4 className="text-xl font-bold text-primaryText mb-1">{plan.name}</h4>
                <div className="flex items-baseline gap-1 my-3">
                  <MoneyText
                    paise={plan.pricePaise}
                    className="text-2xl font-black text-primaryText"
                  />
                  <span className="text-xs text-mutedText">/ {plan.durationDays} days</span>
                </div>

                <div className="space-y-2 mt-4 pt-4 border-t border-border/60 text-xs text-mutedText">
                  <div className="flex justify-between">
                    <span>Daily Booking Limit</span>
                    <span className="font-semibold text-primaryText">
                      {plan.dailyBookingLimit} sessions/day
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Advance Booking</span>
                    <span className="font-semibold text-primaryText">
                      {plan.advanceBookingDays} days prior
                    </span>
                  </div>
                  {plan.entitlements && (
                    <>
                      <div className="flex justify-between">
                        <span>Court Discount</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {plan.entitlements.courtRate}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Shop & Bar</span>
                        <span className="font-semibold text-primaryText">
                          {plan.entitlements.shopDiscountBps / 100}% off
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-3">
                <button
                  type="button"
                  className={`w-full py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    isSelected
                      ? 'bg-accent-orange text-white shadow-md'
                      : 'bg-canvas hover:bg-surface-muted text-primaryText border border-border'
                  }`}
                >
                  {isSelected ? 'Plan Selected' : 'Choose Plan'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
