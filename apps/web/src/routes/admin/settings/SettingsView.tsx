import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Shield,
  History,
  Tag,
  Clock,
  Layers,
  Percent,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Save,
  Search,
  Filter,
} from 'lucide-react';
import { api, ApiClientError } from '../../../api/client';
import { LoadingState, EmptyState, ErrorState } from '../../../components/shared/States';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { MoneyText } from '../../../components/shared/MoneyText';
import { DataTable, Column } from '../../../components/shared/DataTable';
import { useToast } from '../../../lib/toast';

type SettingsTab =
  | 'plans'
  | 'rules'
  | 'cancellation'
  | 'tax'
  | 'social'
  | 'crm'
  | 'roles'
  | 'audit';

export function SettingsView() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('plans');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface border border-border shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-primaryText">
            Club Configuration & Administration
          </h1>
          <p className="text-xs text-mutedText mt-1">
            Maintain dynamic business policies, pricing rules, tax structures, RBAC matrices, and immutable audit logs.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border/80 px-2 gap-1 overflow-x-auto pb-1">
        {[
          { id: 'plans', label: 'Membership Plans', icon: <Layers className="w-3.5 h-3.5" /> },
          { id: 'rules', label: 'Price Rules Engine', icon: <Tag className="w-3.5 h-3.5" /> },
          { id: 'cancellation', label: 'Cancellation Policy', icon: <Clock className="w-3.5 h-3.5" /> },
          { id: 'tax', label: 'Tax Rates (GST)', icon: <Percent className="w-3.5 h-3.5" /> },
          { id: 'social', label: 'Social Windows', icon: <Clock className="w-3.5 h-3.5" /> },
          { id: 'crm', label: 'CRM Stages', icon: <Layers className="w-3.5 h-3.5" /> },
          { id: 'roles', label: 'Roles & RBAC', icon: <Shield className="w-3.5 h-3.5" /> },
          { id: 'audit', label: 'Audit Trail', icon: <History className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as SettingsTab)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-accent-orange text-accent-orange bg-canvas/40 rounded-t-xl'
                : 'border-transparent text-mutedText hover:text-primaryText'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === 'plans' && <PlansSettings />}
        {activeTab === 'rules' && <PriceRulesSettings />}
        {activeTab === 'cancellation' && <CancellationPolicySettings />}
        {activeTab === 'tax' && <TaxRatesSettings />}
        {activeTab === 'social' && <SocialWindowsSettings />}
        {activeTab === 'crm' && <CrmStagesSettings />}
        {activeTab === 'roles' && <RolesMatrixSettings />}
        {activeTab === 'audit' && <AuditLogSettings />}
      </div>
    </div>
  );
}

// 1. Membership Plans
function PlansSettings() {
  const { data: plans, isLoading, error } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.members.listPlans(),
  });

  if (isLoading) return <LoadingState message="Loading membership plans..." />;
  if (error) return <ErrorState title="Failed to load plans" message={(error as any)?.message} />;

  return (
    <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-bold text-primaryText">Configured Membership Plans</h3>
        <p className="text-[11px] text-mutedText">
          Entitlements, daily booking limits, and advance booking windows.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {(plans || []).map((plan: any) => (
          <div
            key={plan.id}
            className="p-5 rounded-2xl bg-canvas border border-border flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-sm text-primaryText">{plan.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent-orange/15 text-accent-orange border border-accent-orange/30">
                  {plan.code}
                </span>
              </div>

              <div className="text-xl font-black text-primaryText mb-3">
                <MoneyText paise={plan.pricePaise} />
                <span className="text-xs text-mutedText font-normal"> / year</span>
              </div>

              <div className="space-y-1.5 text-xs text-mutedText border-t border-border/60 pt-3">
                <div className="flex justify-between">
                  <span>Daily Booking Limit:</span>
                  <span className="font-bold text-primaryText">{plan.dailyBookingLimit} slots/day</span>
                </div>
                <div className="flex justify-between">
                  <span>Advance Booking:</span>
                  <span className="font-bold text-primaryText">{plan.advanceBookingDays} days</span>
                </div>
                <div className="flex justify-between">
                  <span>Validity Duration:</span>
                  <span className="font-bold text-primaryText">{plan.durationDays} days</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 text-[10px] text-mutedText flex items-center justify-between">
              <span>Status: Active</span>
              <span className="text-accent-orange font-semibold">Managed Plan</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 2. Price Rules Settings
function PriceRulesSettings() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [appliesTo, setAppliesTo] = useState('court');
  const [tier, setTier] = useState<string>('gold');
  const [effect, setEffect] = useState('fixed_price');
  const [value, setValue] = useState(0);
  const [priority, setPriority] = useState(10);

  const { data: rulesData, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-price-rules'],
    queryFn: () => api.admin.getPriceRules({ limit: 100 }),
  });

  const createRuleMutation = useMutation({
    mutationFn: () =>
      api.admin.createPriceRule({
        name: name.trim(),
        appliesTo,
        tier: tier || null,
        effect,
        value: Number(value),
        priority: Number(priority),
        active: true,
      }),
    onSuccess: () => {
      showToast('success', 'Price Rule Created', 'Active immediately in pricing engine.');
      setShowAddModal(false);
      setName('');
      refetch();
    },
    onError: (err: any) => {
      showToast('error', 'Error', err.message);
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => api.admin.deletePriceRule(id),
    onSuccess: () => {
      showToast('success', 'Rule Deleted', 'Pricing engine updated.');
      refetch();
    },
  });

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Rule Name',
      render: (row) => <span className="font-bold text-primaryText">{row.name}</span>,
    },
    {
      key: 'appliesTo',
      header: 'Category',
      render: (row) => (
        <span className="capitalize px-2 py-0.5 rounded-md bg-canvas border border-border text-[11px] font-semibold">
          {row.appliesTo}
        </span>
      ),
    },
    {
      key: 'tier',
      header: 'Tier',
      render: (row) => (
        <span className="uppercase text-[10px] font-bold text-accent-orange">
          {row.tier || 'Any'}
        </span>
      ),
    },
    {
      key: 'effect',
      header: 'Discount / Effect',
      render: (row) => (
        <span className="text-primaryText font-medium text-xs">
          {row.effect === 'fixed_price'
            ? `Fixed: ₹${(row.value / 100).toFixed(2)}`
            : row.effect === 'percent_off'
            ? `${row.value / 100}% off`
            : `₹${(row.value / 100).toFixed(2)} off`}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => <span className="text-mutedText font-mono">{row.priority}</span>,
    },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => (
        <button
          onClick={() => deleteRuleMutation.mutate(row.id)}
          className="p-1 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
          title="Delete Rule"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-primaryText">Pricing Engine Rules</h3>
          <p className="text-[11px] text-mutedText">
            Tier discounts, peak/off-peak surcharges, and membership benefits.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-2xl bg-accent-orange text-white hover:bg-accent-orange/90 shadow-md"
        >
          <Plus className="w-3.5 h-3.5" /> Add Rule
        </button>
      </div>

      {isLoading ? (
        <LoadingState message="Loading price rules..." />
      ) : error ? (
        <ErrorState title="Error" message={(error as any)?.message} onRetry={() => refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={rulesData?.items || []}
          searchKey="name"
          searchPlaceholder="Search price rules..."
          emptyTitle="No pricing rules configured"
        />
      )}

      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-surface border border-border shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-primaryText">Create Pricing Engine Rule</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-mutedText block mb-1">Rule Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Gold Court 100% Free"
                  className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-mutedText block mb-1">Applies To</label>
                  <select
                    value={appliesTo}
                    onChange={(e) => setAppliesTo(e.target.value)}
                    className="w-full p-2 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                  >
                    <option value="court">Court</option>
                    <option value="shop">Shop</option>
                    <option value="bar">Bar</option>
                    <option value="social">Social</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-mutedText block mb-1">Tier</label>
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value)}
                    className="w-full p-2 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                  >
                    <option value="gold">Gold</option>
                    <option value="silver">Silver</option>
                    <option value="junior">Junior</option>
                    <option value="walkin">Walk-in</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-mutedText block mb-1">Effect</label>
                  <select
                    value={effect}
                    onChange={(e) => setEffect(e.target.value)}
                    className="w-full p-2 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                  >
                    <option value="fixed_price">Fixed Price (Paise)</option>
                    <option value="percent_off">Percent Off (Bps)</option>
                    <option value="amount_off">Amount Off (Paise)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-mutedText block mb-1">
                    Value {effect === 'percent_off' ? '(Bps, 1000 = 10%)' : '(Paise, 10000 = ₹100)'}
                  </label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                    className="w-full p-2 text-xs rounded-xl bg-canvas border border-border text-primaryText font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-mutedText block mb-1">Priority</label>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full p-2 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-canvas border border-border text-mutedText"
              >
                Cancel
              </button>
              <button
                disabled={createRuleMutation.isPending || !name.trim()}
                onClick={() => createRuleMutation.mutate()}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90"
              >
                {createRuleMutation.isPending ? 'Creating...' : 'Save Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 3. Cancellation Policy Settings
function CancellationPolicySettings() {
  const { showToast } = useToast();
  const [policyRows, setPolicyRows] = useState<Array<{ hours_before: number; refund_pct: number }>>([]);
  const [hours, setHours] = useState(24);
  const [pct, setPct] = useState(100);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['settings', 'booking.cancellation_policy'],
    queryFn: async () => {
      const res = await api.admin.getSetting('booking.cancellation_policy');
      return res?.value || [];
    },
  });

  React.useEffect(() => {
    if (data && Array.isArray(data)) {
      setPolicyRows(data);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (updated: Array<{ hours_before: number; refund_pct: number }>) =>
      api.admin.updateSetting('booking.cancellation_policy', updated, 'Court cancellation refund tiers'),
    onSuccess: () => {
      showToast('success', 'Policy Updated', 'Cancellation rules saved.');
      refetch();
    },
    onError: (err: any) => {
      showToast('error', 'Error', err.message);
    },
  });

  const handleAddRow = () => {
    const updated = [...policyRows, { hours_before: Number(hours), refund_pct: Number(pct) }].sort(
      (a, b) => b.hours_before - a.hours_before
    );
    setPolicyRows(updated);
    saveMutation.mutate(updated);
  };

  const handleRemoveRow = (idx: number) => {
    const updated = policyRows.filter((_, i) => i !== idx);
    setPolicyRows(updated);
    saveMutation.mutate(updated);
  };

  if (isLoading) return <LoadingState message="Loading cancellation policy..." />;

  return (
    <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-bold text-primaryText">Court Cancellation & Refund Policy</h3>
        <p className="text-[11px] text-mutedText">
          Evaluated descending by hours prior to session start; matching tier issues negative payment refund.
        </p>
      </div>

      <div className="flex items-end gap-3 p-4 rounded-2xl bg-canvas border border-border">
        <div>
          <label className="text-[10px] text-mutedText block mb-1">Hours Before Start</label>
          <input
            type="number"
            min="0"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="w-32 p-2 text-xs rounded-xl bg-surface border border-border text-primaryText font-bold"
          />
        </div>
        <div>
          <label className="text-[10px] text-mutedText block mb-1">Refund Percentage (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="w-32 p-2 text-xs rounded-xl bg-surface border border-border text-primaryText font-bold"
          />
        </div>
        <button
          onClick={handleAddRow}
          className="px-4 py-2 text-xs font-bold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90"
        >
          Add Policy Tier
        </button>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-canvas border-b border-border text-mutedText uppercase font-semibold">
            <tr>
              <th className="px-4 py-2.5">Hours Prior to Session</th>
              <th className="px-4 py-2.5">Refund Entitlement</th>
              <th className="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {policyRows.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-2.5 font-bold text-primaryText">≥ {r.hours_before} hours</td>
                <td className="px-4 py-2.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  {r.refund_pct}% Refund
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => handleRemoveRow(i)}
                    className="p-1 rounded-lg text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 4. Tax Rates Settings
function TaxRatesSettings() {
  const { showToast } = useToast();
  const [selectedRate, setSelectedRate] = useState<any | null>(null);
  const [newBps, setNewBps] = useState(1800);

  const { data: taxRates, isLoading, error, refetch } = useQuery({
    queryKey: ['tax-rates'],
    queryFn: () => api.admin.getTaxRates(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, rateBps }: { id: string; rateBps: number }) =>
      api.admin.updateTaxRate(id, { rateBps }),
    onSuccess: () => {
      showToast('success', 'Tax Rate Updated', 'Applied across billing engine.');
      setSelectedRate(null);
      refetch();
    },
    onError: (err: any) => {
      showToast('error', 'Error', err.message);
    },
  });

  if (isLoading) return <LoadingState message="Loading GST tax categories..." />;
  if (error) return <ErrorState title="Error" message={(error as any)?.message} />;

  return (
    <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-bold text-primaryText">Goods & Services Tax (GST) Slabs</h3>
        <p className="text-[11px] text-mutedText">
          Intra-state GST split equally between CGST and SGST down to integer paise.
        </p>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-canvas border-b border-border text-mutedText uppercase font-semibold">
            <tr>
              <th className="px-4 py-2.5">Category</th>
              <th className="px-4 py-2.5">Rate (Bps)</th>
              <th className="px-4 py-2.5">Effective Tax Rate</th>
              <th className="px-4 py-2.5">Description</th>
              <th className="px-4 py-2.5 text-right">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {(taxRates || []).map((t: any) => (
              <tr key={t.id}>
                <td className="px-4 py-2.5 font-bold uppercase text-primaryText">{t.category}</td>
                <td className="px-4 py-2.5 text-mutedText font-mono">{t.rateBps} bps</td>
                <td className="px-4 py-2.5 font-black text-accent-orange">{(t.rateBps / 100).toFixed(1)}% GST</td>
                <td className="px-4 py-2.5 text-mutedText">{t.description || 'Standard rate'}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => {
                      setSelectedRate(t);
                      setNewBps(t.rateBps);
                    }}
                    className="p-1 rounded-lg text-primaryText hover:bg-canvas"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-surface border border-border shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-primaryText">Edit GST Rate: {selectedRate.category}</h3>
            <div>
              <label className="text-[10px] text-mutedText block mb-1">Rate in Basis Points (1800 = 18%)</label>
              <input
                type="number"
                value={newBps}
                onChange={(e) => setNewBps(Number(e.target.value))}
                className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText font-bold"
              />
              <span className="text-[11px] text-accent-orange font-semibold block mt-1">
                Effective: {(newBps / 100).toFixed(1)}% GST
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedRate(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-canvas border border-border text-mutedText"
              >
                Cancel
              </button>
              <button
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ id: selectedRate.id, rateBps: newBps })}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90"
              >
                Save Rate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 5. Social Windows Settings
function SocialWindowsSettings() {
  const { showToast } = useToast();
  const [windows, setWindows] = useState<any[]>([]);
  const [weekday, setWeekday] = useState(5); // Friday
  const [from, setFrom] = useState('18:00');
  const [to, setTo] = useState('21:00');
  const [capacity, setCapacity] = useState(16);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['settings', 'social.windows'],
    queryFn: async () => {
      const res = await api.admin.getSetting('social.windows');
      return res?.value || [];
    },
  });

  React.useEffect(() => {
    if (data && Array.isArray(data)) setWindows(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (updated: any[]) =>
      api.admin.updateSetting('social.windows', updated, 'Recurring weekly social play windows'),
    onSuccess: () => {
      showToast('success', 'Windows Saved', 'Updated social schedule.');
      refetch();
    },
  });

  const handleAdd = () => {
    const updated = [...windows, { weekday: Number(weekday), from, to, capacity: Number(capacity) }];
    setWindows(updated);
    saveMutation.mutate(updated);
  };

  const handleRemove = (idx: number) => {
    const updated = windows.filter((_, i) => i !== idx);
    setWindows(updated);
    saveMutation.mutate(updated);
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (isLoading) return <LoadingState message="Loading social play windows..." />;

  return (
    <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-bold text-primaryText">Weekly Social Play Sessions</h3>
        <p className="text-[11px] text-mutedText">
          Recurring mixer sessions blocking the court with capped signup capacities.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 p-4 rounded-2xl bg-canvas border border-border">
        <div>
          <label className="text-[10px] text-mutedText block mb-1">Day of Week</label>
          <select
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
            className="p-2 text-xs rounded-xl bg-surface border border-border text-primaryText font-semibold"
          >
            {dayNames.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-mutedText block mb-1">From Time</label>
          <input
            type="time"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="p-2 text-xs rounded-xl bg-surface border border-border text-primaryText"
          />
        </div>
        <div>
          <label className="text-[10px] text-mutedText block mb-1">To Time</label>
          <input
            type="time"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="p-2 text-xs rounded-xl bg-surface border border-border text-primaryText"
          />
        </div>
        <div>
          <label className="text-[10px] text-mutedText block mb-1">Max Capacity</label>
          <input
            type="number"
            min="1"
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="w-24 p-2 text-xs rounded-xl bg-surface border border-border text-primaryText"
          />
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 text-xs font-bold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90"
        >
          Add Session Window
        </button>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-canvas border-b border-border text-mutedText uppercase font-semibold">
            <tr>
              <th className="px-4 py-2.5">Weekday</th>
              <th className="px-4 py-2.5">Window Timing</th>
              <th className="px-4 py-2.5">Capacity</th>
              <th className="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {windows.map((w, i) => (
              <tr key={i}>
                <td className="px-4 py-2.5 font-bold text-primaryText">{dayNames[w.weekday]}</td>
                <td className="px-4 py-2.5 text-primaryText">
                  {w.from} - {w.to}
                </td>
                <td className="px-4 py-2.5 text-mutedText">{w.capacity} players max</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => handleRemove(i)} className="p-1 rounded-lg text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 6. CRM Stages Settings
function CrmStagesSettings() {
  const { showToast } = useToast();
  const [stages, setStages] = useState<string[]>([]);
  const [newStage, setNewStage] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['settings', 'crm.stages'],
    queryFn: async () => {
      const res = await api.admin.getSetting('crm.stages');
      return res?.value || [];
    },
  });

  React.useEffect(() => {
    if (data && Array.isArray(data)) setStages(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (updated: string[]) =>
      api.admin.updateSetting('crm.stages', updated, 'Sales pipeline stages'),
    onSuccess: () => {
      showToast('success', 'Stages Saved', 'Pipeline configuration updated.');
      refetch();
    },
  });

  const handleAdd = () => {
    if (!newStage.trim()) return;
    const clean = newStage.toLowerCase().trim().replace(/\s+/g, '_');
    if (stages.includes(clean)) return;
    const updated = [...stages, clean];
    setStages(updated);
    setNewStage('');
    saveMutation.mutate(updated);
  };

  const handleRemove = (stg: string) => {
    const updated = stages.filter((s) => s !== stg);
    setStages(updated);
    saveMutation.mutate(updated);
  };

  if (isLoading) return <LoadingState message="Loading CRM stages..." />;

  return (
    <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-bold text-primaryText">CRM Pipeline Stages</h3>
        <p className="text-[11px] text-mutedText">
          Configured sales funnel stages driving the Kanban board.
        </p>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <input
          type="text"
          value={newStage}
          onChange={(e) => setNewStage(e.target.value)}
          placeholder="New stage (e.g. trial_completed)"
          className="flex-1 p-2 text-xs rounded-xl bg-canvas border border-border text-primaryText"
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2 text-xs font-bold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90"
        >
          Add Stage
        </button>
      </div>

      <div className="space-y-2 pt-2 max-w-md">
        {stages.map((stg, i) => (
          <div
            key={stg}
            className="flex items-center justify-between p-3 rounded-2xl bg-canvas border border-border text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-surface border border-border flex items-center justify-center font-bold text-[10px] text-mutedText">
                {i + 1}
              </span>
              <span className="font-bold text-primaryText capitalize">{stg.replace('_', ' ')}</span>
            </div>
            <button
              onClick={() => handleRemove(stg)}
              className="p-1 rounded-lg text-red-500 hover:bg-red-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// 7. Roles & Permissions Matrix Settings
function RolesMatrixSettings() {
  const { showToast } = useToast();
  const [selectedRole, setSelectedRole] = useState<any | null>(null);
  const [permIds, setPermIds] = useState<Set<string>>(new Set());

  const { data: roles, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => api.admin.getRoles(),
  });

  // Collect all unique permissions across all roles
  const allPermissions = React.useMemo(() => {
    const map = new Map<string, { id: string; code: string; description?: string }>();
    (roles || []).forEach((r: any) => {
      (r.permissions || []).forEach((p: any) => {
        if (!map.has(p.code)) {
          map.set(p.code, p);
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [roles]);

  React.useEffect(() => {
    if (selectedRole) {
      const set = new Set<string>((selectedRole.permissions || []).map((p: any) => p.id));
      setPermIds(set);
    }
  }, [selectedRole]);

  const updateRolePermsMutation = useMutation({
    mutationFn: () =>
      api.admin.updateRolePermissions(selectedRole.id, Array.from(permIds)),
    onSuccess: () => {
      showToast('success', 'Permissions Updated', `Permissions saved for role ${selectedRole.name}`);
      setSelectedRole(null);
      refetch();
    },
    onError: (err: any) => {
      showToast('error', 'Error', err.message);
    },
  });

  const togglePerm = (id: string) => {
    setPermIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) return <LoadingState message="Loading RBAC matrix..." />;
  if (error) return <ErrorState title="Error" message={(error as any)?.message} />;

  return (
    <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-bold text-primaryText">RBAC Roles & Permissions Matrix</h3>
        <p className="text-[11px] text-mutedText">
          Fine-grained permission assignments per role. Owner has full bypass by design.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
        {(roles || []).map((r: any) => (
          <div
            key={r.id}
            className="p-5 rounded-2xl bg-canvas border border-border space-y-3 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-primaryText">{r.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-surface text-accent-orange border border-border">
                  {r.code}
                </span>
              </div>
              <p className="text-[11px] text-mutedText">
                {r.permissions?.length || 0} active permissions assigned
              </p>
            </div>

            <button
              onClick={() => setSelectedRole(r)}
              className="w-full py-1.5 text-xs font-bold rounded-xl bg-surface border border-border hover:bg-canvas text-primaryText transition-colors"
            >
              Configure Permissions
            </button>
          </div>
        ))}
      </div>

      {/* Permissions Modal */}
      {selectedRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 sm:p-8 rounded-3xl bg-surface border border-border shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-primaryText">
                  Permissions: {selectedRole.name} ({selectedRole.code})
                </h3>
                <p className="text-xs text-mutedText">Toggle granted permissions for this role.</p>
              </div>
              <button
                onClick={() => setSelectedRole(null)}
                className="p-1 rounded-full text-mutedText hover:text-primaryText"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
              {allPermissions.map((p) => {
                const checked = permIds.has(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none transition-colors text-xs ${
                      checked
                        ? 'bg-accent-orange/10 border-accent-orange/40 text-primaryText'
                        : 'bg-canvas border-border/70 text-mutedText hover:border-border'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePerm(p.id)}
                      className="mt-0.5 rounded text-accent-orange focus:ring-accent-orange"
                    />
                    <div>
                      <span className="font-semibold block font-mono text-[11px]">{p.code}</span>
                      {p.description && (
                        <span className="text-[10px] opacity-80">{p.description}</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
              <button
                onClick={() => setSelectedRole(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-canvas border border-border text-mutedText"
              >
                Cancel
              </button>
              <button
                disabled={updateRolePermsMutation.isPending}
                onClick={() => updateRolePermsMutation.mutate()}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90"
              >
                {updateRolePermsMutation.isPending ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 8. Audit Log Settings
function AuditLogSettings() {
  const [resourceFilter, setResourceFilter] = useState('');

  const { data: auditData, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-audit', resourceFilter],
    queryFn: () => api.admin.getAuditLogs({ resource: resourceFilter || undefined, limit: 100 }),
  });

  const columns: Column<any>[] = [
    {
      key: 'at',
      header: 'Timestamp',
      render: (row) => (
        <span className="text-mutedText font-mono text-[11px]">
          {new Date(row.at).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => (
        <span className="font-semibold text-primaryText uppercase text-[10px] px-2 py-0.5 rounded-md bg-canvas border border-border">
          {row.action}
        </span>
      ),
    },
    {
      key: 'resource',
      header: 'Resource',
      render: (row) => (
        <span className="font-bold text-accent-orange capitalize">{row.resource}</span>
      ),
    },
    {
      key: 'recordId',
      header: 'Record ID',
      render: (row) => (
        <span className="text-mutedText font-mono text-[10px]">{row.recordId?.slice(0, 8)}</span>
      ),
    },
    {
      key: 'actorUserId',
      header: 'Actor',
      render: (row) => (
        <span className="text-mutedText text-[11px]">{row.actorUserId?.slice(0, 8) || 'System'}</span>
      ),
    },
  ];

  return (
    <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-primaryText">Append-Only Audit Trail</h3>
          <p className="text-[11px] text-mutedText">
            Cryptographic ledger of state mutations across core, booking, commerce and finance.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-canvas border border-border text-primaryText hover:bg-surface"
        >
          Refresh Log
        </button>
      </div>

      {isLoading ? (
        <LoadingState message="Querying audit trail..." />
      ) : error ? (
        <ErrorState title="Error" message={(error as any)?.message} onRetry={() => refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={auditData?.items || []}
          searchKey="action"
          searchPlaceholder="Filter audit records..."
          emptyTitle="No audit records"
        />
      )}
    </div>
  );
}
