import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { MoneyText } from '../../../components/shared/MoneyText';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { LoadingState, EmptyState } from '../../../components/shared/States';
import { useToast } from '../../../lib/toast';
import { formatPaise } from '../../../lib/utils';
import type { ProductWithVariants, ProductVariant, Member } from '@club/contract';
import {
  ShoppingBag,
  Search,
  User,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Receipt,
  CheckCircle,
  X,
  AlertCircle,
} from 'lucide-react';

interface CartItem {
  variantId: string;
  productId: string;
  name: string;
  optionLabel: string;
  sku: string;
  basePricePaise: number;
  quotedUnitPricePaise: number;
  qty: number;
}

export function ShopPos() {
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi'>('card');
  const [tenderModalOpen, setTenderModalOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<any | null>(null);

  // Fetch shop products with variants
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products-list', categoryFilter],
    queryFn: () =>
      api.shop.getProducts({
        category: categoryFilter === 'all' ? undefined : categoryFilter,
      }),
  });

  // Fetch member search results
  const { data: memberResults } = useQuery({
    queryKey: ['members-pos', memberSearch],
    queryFn: () => api.members.list({ q: memberSearch, limit: 5 }),
    enabled: memberSearch.trim().length >= 2,
  });

  const products: ProductWithVariants[] = productsData?.items || [];

  // Add item to cart with server-quoted line price
  const addToCart = async (product: ProductWithVariants, variant: ProductVariant) => {
    const existingIndex = cart.findIndex((i) => i.variantId === variant.id);
    const priceToQuote = variant.pricePaise || product.basePricePaise;

    let quotedPrice = priceToQuote;

    // Fetch quote from pricing engine if member selected
    if (selectedMember) {
      try {
        const quote = await api.pricing.quote({
          kind: 'shop',
          scopeRef: product.category,
          basePricePaise: priceToQuote,
          qty: 1,
          memberId: selectedMember.id,
          channel: 'counter',
          at: new Date(),
        });
        quotedPrice = quote.unitPaise;
      } catch {
        quotedPrice = priceToQuote;
      }
    }

    if (existingIndex > -1) {
      setCart((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex ? { ...item, qty: item.qty + 1 } : item
        )
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          variantId: variant.id,
          productId: product.id,
          name: product.name,
          optionLabel: variant.optionLabel,
          sku: variant.sku,
          basePricePaise: priceToQuote,
          quotedUnitPricePaise: quotedPrice,
          qty: 1,
        },
      ]);
    }
    showToast('info', 'Added to Cart', `${product.name} (${variant.optionLabel})`);
  };

  const updateQty = (variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.variantId === variantId) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (variantId: string) => {
    setCart((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  // Re-quote cart when member changes
  const applyMemberDiscount = async (member: Member | null) => {
    setSelectedMember(member);
    if (!member) {
      setCart((prev) =>
        prev.map((i) => ({ ...i, quotedUnitPricePaise: i.basePricePaise }))
      );
      return;
    }

    // Recalculate line prices from API
    try {
      const updated = await Promise.all(
        cart.map(async (item) => {
          const product = products.find((p) => p.id === item.productId);
          const quote = await api.pricing.quote({
            kind: 'shop',
            scopeRef: product?.category || 'apparel',
            basePricePaise: item.basePricePaise,
            qty: 1,
            memberId: member.id,
            channel: 'counter',
            at: new Date(),
          });
          return { ...item, quotedUnitPricePaise: quote.unitPaise };
        })
      );
      setCart(updated);
      showToast('success', 'Member Applied', `Applied ${member.currentPlan || 'member'} tier rates.`);
    } catch {
      // fallback
    }
  };

  // Cart total derived purely from line sums
  const cartTotalPaise = cart.reduce(
    (acc, item) => acc + item.quotedUnitPricePaise * item.qty,
    0
  );

  // Submit order mutation
  const submitOrderMutation = useMutation({
    mutationFn: () =>
      api.shop.createOrder({
        items: cart.map((i) => ({ variantId: i.variantId, qty: i.qty })),
        fulfilment: 'counter',
        memberId: selectedMember?.id,
        channel: 'counter',
      }),
    onSuccess: (order) => {
      setReceiptOrder(order);
      setTenderModalOpen(false);
      setCart([]);
      queryClient.invalidateQueries({ queryKey: ['products-list'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      showToast('success', 'Order Complete', 'Sale recorded and receipt generated.');
    },
    onError: (err) => {
      showError(err, 'Failed to process order.');
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="rounded-[24px] border border-border bg-surface p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-accent-orange">
            Commerce POS
          </span>
          <h1 className="text-2xl font-black text-primaryText">Pro Shop Counter</h1>
          <p className="text-xs text-mutedText mt-0.5">
            Equipment, apparel, strings, and balls with automatic member tier rates.
          </p>
        </div>

        {/* Member Lookup Bar */}
        <div className="relative min-w-[280px]">
          {selectedMember ? (
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <span className="font-bold text-primaryText">{selectedMember.fullName}</span>
                  <span className="text-[10px] text-mutedText block">
                    {selectedMember.currentPlan} Tier
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => applyMemberDiscount(null)}
                className="text-red-500 hover:underline text-[11px] font-semibold"
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mutedText" />
              <input
                type="text"
                placeholder="Scan / lookup member phone or name..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:outline-none focus:ring-1 focus:ring-accent-orange"
              />
              {memberResults?.items && memberResults.items.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-surface shadow-xl z-30 divide-y divide-border/60">
                  {memberResults.items.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        applyMemberDiscount(m);
                        setMemberSearch('');
                      }}
                      className="p-2.5 hover:bg-canvas cursor-pointer text-xs flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-primaryText">{m.fullName}</span>
                        <span className="text-mutedText text-[10px] ml-2">{m.phone}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-accent-lime/20 text-lime-900 dark:text-lime-300">
                        {m.currentPlan || 'Member'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Products + Cart Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Products Grid (2 Cols on lg) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {(['all', 'racket', 'ball', 'shoe', 'apparel', 'accessory'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  categoryFilter === cat
                    ? 'bg-accent-orange text-white shadow-sm'
                    : 'bg-surface border border-border text-mutedText hover:text-primaryText'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {isLoadingProducts ? (
            <LoadingState message="Loading catalog items..." />
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="rounded-[24px] border border-border bg-surface p-5 shadow-sm flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-mutedText bg-canvas px-2 py-0.5 rounded-md border border-border">
                        {p.category}
                      </span>
                      <MoneyText
                        paise={p.basePricePaise}
                        className="text-base font-extrabold text-primaryText"
                      />
                    </div>
                    <h3 className="font-black text-base text-primaryText mt-2">{p.name}</h3>
                    {p.description && (
                      <p className="text-xs text-mutedText line-clamp-2 mt-0.5">{p.description}</p>
                    )}
                  </div>

                  {/* Variant Selection List */}
                  <div className="space-y-1.5 pt-3 border-t border-border/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-mutedText block">
                      Choose Variant
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {p.variants?.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => addToCart(p, v)}
                          className="px-2.5 py-1.5 rounded-xl border border-border bg-canvas hover:border-accent-orange hover:bg-surface text-left transition-all group"
                        >
                          <span className="font-bold text-xs text-primaryText group-hover:text-accent-orange block truncate">
                            {v.optionLabel}
                          </span>
                          <span className="text-[10px] font-mono text-mutedText">
                            {v.sku}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No Products Found" description="Try selecting another category." />
          )}
        </div>

        {/* Cart Sidebar */}
        <div className="lg:col-span-1">
          <div className="rounded-[24px] border border-border bg-surface p-6 shadow-md space-y-4 sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-accent-orange" />
                <h3 className="text-lg font-black text-primaryText">Current Cart</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-canvas border border-border">
                {cart.reduce((a, b) => a + b.qty, 0)} items
              </span>
            </div>

            {/* Cart Items List */}
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <div
                    key={item.variantId}
                    className="p-3 rounded-2xl bg-canvas border border-border flex items-center justify-between text-xs gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-primaryText truncate block">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-mutedText font-mono">
                        {item.optionLabel} • {formatPaise(item.quotedUnitPricePaise)} each
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQty(item.variantId, -1)}
                        className="w-6 h-6 rounded-lg bg-surface border border-border flex items-center justify-center hover:bg-canvas"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold font-mono px-1">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.variantId, 1)}
                        className="w-6 h-6 rounded-lg bg-surface border border-border flex items-center justify-center hover:bg-canvas"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.variantId)}
                        className="p-1 text-mutedText hover:text-red-500 ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-mutedText italic text-center py-6">
                  Cart is empty. Click a product variant to add.
                </p>
              )}
            </div>

            {/* Total & Checkout */}
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-mutedText">Total Payable</span>
                <MoneyText
                  paise={cartTotalPaise}
                  className="text-2xl font-black text-accent-orange"
                />
              </div>

              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => setTenderModalOpen(true)}
                className="w-full py-3 rounded-xl bg-accent-orange hover:bg-accent-orange/90 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>Tender & Complete Sale</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tender Modal */}
      {tenderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[24px] border border-border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-border">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-accent-orange">
                  Payment Collection
                </span>
                <h3 className="text-xl font-black text-primaryText">Select Tender</h3>
              </div>
              <button
                onClick={() => setTenderModalOpen(false)}
                className="p-1 rounded-lg text-mutedText hover:text-primaryText"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-canvas border border-border text-center">
              <span className="text-xs text-mutedText block">Total Sale Amount</span>
              <MoneyText
                paise={cartTotalPaise}
                className="text-3xl font-black text-accent-orange block mt-1"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-mutedText">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {(['card', 'upi', 'cash'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold uppercase transition-all ${
                      paymentMethod === m
                        ? 'bg-accent-orange text-white shadow-md'
                        : 'bg-canvas border border-border text-mutedText hover:text-primaryText'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={submitOrderMutation.isPending}
              onClick={() => submitOrderMutation.mutate()}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 mt-2"
            >
              <Receipt className="w-4 h-4" />
              <span>{submitOrderMutation.isPending ? 'Processing...' : 'Confirm & Print Receipt'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-[24px] border border-border bg-surface p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-xl font-black text-primaryText">Sale Complete!</h3>
              <p className="text-xs text-mutedText font-mono mt-0.5">Order #{receiptOrder.id?.slice(0, 8)}</p>
            </div>

            <div className="p-4 rounded-2xl bg-canvas border border-border space-y-2 text-xs text-left">
              <div className="flex justify-between">
                <span className="text-mutedText">Fulfilment</span>
                <span className="font-semibold text-primaryText uppercase">{receiptOrder.fulfilment}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mutedText">Status</span>
                <StatusBadge status={receiptOrder.status} />
              </div>
              {receiptOrder.invoiceId && (
                <div className="flex justify-between">
                  <span className="text-mutedText">Invoice</span>
                  <span className="font-mono text-primaryText">{receiptOrder.invoiceId.slice(0, 8)}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setReceiptOrder(null)}
              className="w-full py-2.5 rounded-xl bg-accent-orange text-white font-bold text-xs uppercase tracking-wider shadow-md"
            >
              New Sale
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
