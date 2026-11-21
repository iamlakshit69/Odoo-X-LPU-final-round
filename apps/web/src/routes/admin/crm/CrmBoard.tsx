import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  Plus,
  Phone,
  Mail,
  Calendar,
  Clock,
  Send,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  ChevronRight,
  ArrowRight,
  X,
  MessageSquare,
} from 'lucide-react';
import { api, ApiClientError } from '../../../api/client';
import { LoadingState, EmptyState, ErrorState } from '../../../components/shared/States';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { MoneyText } from '../../../components/shared/MoneyText';
import { useToast } from '../../../lib/toast';

interface LeadItem {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  source: string;
  interest?: string | null;
  stage: string;
  assignedTo?: string | null;
  assignedToName?: string;
  lostReason?: string | null;
  convertedMemberId?: string | null;
  createdAt?: string;
}

function KanbanColumn({
  stage,
  title,
  leads,
  onSelectLead,
}: {
  stage: string;
  title: string;
  leads: LeadItem[];
  onSelectLead: (lead: LeadItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col flex-1 min-w-[280px] max-w-[340px] rounded-3xl p-3 border transition-colors duration-200 ${
        isOver
          ? 'bg-accent-orange/10 border-accent-orange shadow-lg'
          : 'bg-surface/90 border-border shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-orange" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-primaryText">
            {title}
          </h3>
        </div>
        <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-canvas text-mutedText border border-border">
          {leads.length}
        </span>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
        {leads.length === 0 ? (
          <div className="py-8 text-center text-xs text-mutedText/70 border border-dashed border-border/60 rounded-2xl">
            Drop leads here
          </div>
        ) : (
          leads.map((lead) => (
            <DraggableLeadCard key={lead.id} lead={lead} onSelect={() => onSelectLead(lead)} />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableLeadCard({
  lead,
  onSelect,
}: {
  lead: LeadItem;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      className={`p-3.5 rounded-2xl border transition-all cursor-grab active:cursor-grabbing select-none ${
        isDragging
          ? 'opacity-40 border-accent-orange shadow-2xl scale-105'
          : 'bg-canvas border-border/80 hover:border-accent-orange/60 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h4 className="font-bold text-xs text-primaryText leading-snug line-clamp-1">{lead.name}</h4>
        <StatusBadge status={lead.stage} className="text-[9px] px-1.5 py-0.2" />
      </div>

      <div className="space-y-1 text-[11px] text-mutedText mb-2.5">
        <div className="flex items-center gap-1.5 truncate">
          <Phone className="w-3 h-3 shrink-0 text-accent-orange" />
          <span>{lead.phone}</span>
        </div>
        {lead.email && (
          <div className="flex items-center gap-1.5 truncate">
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.interest && (
          <div className="text-[10px] font-medium text-primaryText/90 bg-surface px-2 py-0.5 rounded-md inline-block">
            Interest: {lead.interest}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px] text-mutedText">
        <span className="capitalize">{lead.source?.replace('_', ' ')}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="text-accent-orange font-semibold hover:underline flex items-center gap-0.5"
        >
          View <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export function CrmBoard({ onConvertSuccess }: { onConvertSuccess?: (memberId: string) => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [lostDialog, setLostDialog] = useState<{ leadId: string; open: boolean }>({
    leadId: '',
    open: false,
  });
  const [lostReason, setLostReason] = useState('');
  const [activeDragLead, setActiveDragLead] = useState<LeadItem | null>(null);

  // 1. Fetch CRM stages from Settings (never hardcoded)
  const { data: stagesSetting } = useQuery({
    queryKey: ['settings', 'crm.stages'],
    queryFn: async () => {
      try {
        const res = await api.admin.getSetting('crm.stages');
        return res?.value || ['new', 'contacted', 'quotation_sent', 'follow_up', 'converted', 'lost'];
      } catch {
        return ['new', 'contacted', 'quotation_sent', 'follow_up', 'converted', 'lost'];
      }
    },
  });

  const stages: string[] = Array.isArray(stagesSetting) ? stagesSetting : [
    'new',
    'contacted',
    'quotation_sent',
    'follow_up',
    'converted',
    'lost',
  ];

  // 2. Fetch Leads
  const { data: leadsData, isLoading, error, refetch } = useQuery({
    queryKey: ['leads'],
    queryFn: () => api.crm.listLeads({ limit: 100 }),
  });

  // 3. Stage update mutation with optimistic rollback
  const updateStageMutation = useMutation({
    mutationFn: async ({
      id,
      stage,
      lostReason,
    }: {
      id: string;
      stage: string;
      lostReason?: string | null;
    }) => {
      return api.crm.updateLead(id, { stage, lostReason });
    },
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previous = queryClient.getQueryData(['leads']);

      queryClient.setQueryData(['leads'], (old: any) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.map((item: LeadItem) =>
            item.id === id ? { ...item, stage } : item
          ),
        };
      });

      return { previous };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['leads'], context.previous);
      }
      const msg = err instanceof ApiClientError ? err.message : 'Failed to move lead stage';
      showToast('error', 'Stage Transition Error', msg);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (e: any) => {
    setActiveDragLead(e.active.data.current?.lead || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragLead(null);
    if (!over) return;

    const leadId = String(active.id);
    const targetStage = String(over.id);

    const currentLead = leadsData?.items.find((l: LeadItem) => l.id === leadId);
    if (!currentLead || currentLead.stage === targetStage) return;

    if (targetStage === 'lost') {
      // Show mandatory lost reason modal
      setLostDialog({ leadId, open: true });
      return;
    }

    updateStageMutation.mutate({ id: leadId, stage: targetStage });
  };

  const handleConfirmLost = () => {
    if (!lostReason.trim()) {
      showToast('warning', 'Reason Required', 'Please provide a valid reason for marking lost.');
      return;
    }

    updateStageMutation.mutate({
      id: lostDialog.leadId,
      stage: 'lost',
      lostReason: lostReason.trim(),
    });

    setLostDialog({ leadId: '', open: false });
    setLostReason('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface border border-border shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-primaryText">
            CRM Leads Pipeline
          </h1>
          <p className="text-xs text-mutedText mt-1">
            Drag leads across pipeline stages. Moving to Lost requires a stated reason.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-canvas border border-border text-primaryText hover:bg-surface transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading CRM pipeline..." />
      ) : error ? (
        <ErrorState
          title="Could not load leads"
          message={(error as any)?.message || 'Network error'}
          onRetry={() => refetch()}
        />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
            {stages.map((stg) => {
              const stageLeads = (leadsData?.items || []).filter((l: LeadItem) => l.stage === stg);
              const title = stg.replace('_', ' ').toUpperCase();
              return (
                <KanbanColumn
                  key={stg}
                  stage={stg}
                  title={title}
                  leads={stageLeads}
                  onSelectLead={(lead) => setSelectedLead(lead)}
                />
              );
            })}
          </div>

          <DragOverlay>
            {activeDragLead ? (
              <div className="p-3.5 rounded-2xl bg-canvas border-2 border-accent-orange shadow-2xl opacity-90 w-[260px]">
                <h4 className="font-bold text-xs text-primaryText">{activeDragLead.name}</h4>
                <p className="text-[11px] text-mutedText mt-1">{activeDragLead.phone}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Lost Reason Dialog */}
      {lostDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-surface border border-border shadow-2xl">
            <h3 className="text-base font-bold text-primaryText mb-2">Mark Lead as Lost</h3>
            <p className="text-xs text-mutedText mb-4">
              Per club policy, a lost reason is strictly required before marking an enquiry as lost.
            </p>

            <textarea
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. Relocated to another city, pricing too high, chose competing club..."
              rows={3}
              className="w-full p-3 rounded-2xl bg-canvas border border-border text-xs text-primaryText focus:outline-none focus:ring-1 focus:ring-accent-orange mb-4 resize-none"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setLostDialog({ leadId: '', open: false });
                  setLostReason('');
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-canvas border border-border text-mutedText hover:text-primaryText"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLost}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 shadow-sm"
              >
                Confirm Lost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lead Detail Drawer / Sheet */}
      {selectedLead && (
        <LeadDetailDrawer
          leadId={selectedLead.id}
          onClose={() => setSelectedLead(null)}
          onConverted={(memberId) => {
            setSelectedLead(null);
            onConvertSuccess?.(memberId);
          }}
        />
      )}
    </div>
  );
}

function LeadDetailDrawer({
  leadId,
  onClose,
  onConverted,
}: {
  leadId: string;
  onClose: () => void;
  onConverted: (memberId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'timeline' | 'quotes' | 'tasks'>('timeline');
  const [newNote, setNewNote] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState(() => new Date().toISOString().slice(0, 10));

  // Quote form state
  const [quoteLineDesc, setQuoteLineDesc] = useState('Annual Tennis & Club Membership');
  const [quoteLineQty, setQuoteLineQty] = useState(1);
  const [quoteLinePriceRupees, setQuoteLinePriceRupees] = useState(50000);

  // Convert state
  const [convertPlan, setConvertPlan] = useState<'gold' | 'silver' | 'junior'>('gold');
  const [showConvertModal, setShowConvertModal] = useState(false);

  // 1. Fetch Lead Details
  const { data: lead, isLoading, error, refetch } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => api.crm.getLead(leadId),
  });

  // Note mutation
  const addNoteMutation = useMutation({
    mutationFn: (body: string) => api.crm.addNote(leadId, body),
    onSuccess: () => {
      showToast('success', 'Note Added', 'Note logged in lead timeline.');
      setNewNote('');
      refetch();
    },
    onError: (err: any) => {
      showToast('error', 'Failed to add note', err.message);
    },
  });

  // Task mutation
  const addTaskMutation = useMutation({
    mutationFn: () => api.crm.addTask(leadId, { title: taskTitle, dueOn: taskDue }),
    onSuccess: () => {
      showToast('success', 'Task Scheduled', 'Follow-up task created.');
      setTaskTitle('');
      refetch();
    },
    onError: (err: any) => {
      showToast('error', 'Failed to add task', err.message);
    },
  });

  // Toggle task done
  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, done }: { taskId: string; done: boolean }) =>
      api.crm.updateTask(taskId, { done }),
    onSuccess: () => {
      refetch();
    },
  });

  // Create Quote mutation
  const createQuoteMutation = useMutation({
    mutationFn: () =>
      api.crm.createQuote(leadId, {
        lines: [
          {
            description: quoteLineDesc,
            qty: quoteLineQty,
            unitPricePaise: quoteLinePriceRupees * 100,
          },
        ],
      }),
    onSuccess: () => {
      showToast('success', 'Quote Created', 'Quotation drafted with server total.');
      refetch();
    },
    onError: (err: any) => {
      showToast('error', 'Failed to create quote', err.message);
    },
  });

  // Send Quote mutation
  const sendQuoteMutation = useMutation({
    mutationFn: (quoteId: string) => api.crm.sendQuote(quoteId),
    onSuccess: () => {
      showToast('success', 'Quote Sent', 'Email notification sent to customer.');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err: any) => {
      showToast('error', 'Failed to send quote', err.message);
    },
  });

  // Convert Lead mutation
  const convertMutation = useMutation({
    mutationFn: () =>
      api.crm.convertLead(leadId, {
        planCode: convertPlan,
      }),
    onSuccess: (res) => {
      showToast('success', 'Lead Converted!', `Member created with code ${res.memberCode}`);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      onConverted(res.memberId);
    },
    onError: (err: any) => {
      showToast('error', 'Conversion Failed', err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-surface border-l border-border p-6 shadow-2xl z-50 overflow-y-auto">
        <LoadingState message="Loading lead details..." />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-surface border-l border-border p-6 shadow-2xl z-50 overflow-y-auto">
        <ErrorState title="Error" message="Could not load lead" onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-surface border-l border-border shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-6 border-b border-border/80 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-black text-primaryText">{lead.name}</h2>
            <StatusBadge status={lead.stage} />
          </div>
          <div className="flex items-center gap-3 text-xs text-mutedText">
            <span className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-accent-orange" /> {lead.phone}
            </span>
            {lead.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> {lead.email}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-canvas text-mutedText hover:text-primaryText transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Convert Callout or Status */}
      {lead.stage === 'converted' ? (
        <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Already converted to member. ID: {lead.convertedMemberId}</span>
        </div>
      ) : (
        <div className="mx-6 mt-4 p-4 rounded-3xl bg-accent-orange/10 border border-accent-orange/30 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-primaryText">Ready to join?</h4>
            <p className="text-[11px] text-mutedText">Convert directly to a registered member with an invoice.</p>
          </div>
          <button
            onClick={() => setShowConvertModal(true)}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90 shadow-sm shrink-0 flex items-center gap-1"
          >
            <UserCheck className="w-3.5 h-3.5" /> Convert to Member
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border/80 px-6 mt-4">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'timeline'
              ? 'border-accent-orange text-accent-orange'
              : 'border-transparent text-mutedText hover:text-primaryText'
          }`}
        >
          Timeline ({lead.activities?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'tasks'
              ? 'border-accent-orange text-accent-orange'
              : 'border-transparent text-mutedText hover:text-primaryText'
          }`}
        >
          Tasks ({lead.tasks?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('quotes')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'quotes'
              ? 'border-accent-orange text-accent-orange'
              : 'border-transparent text-mutedText hover:text-primaryText'
          }`}
        >
          Quotes ({lead.quotes?.length || 0})
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            {/* Add note */}
            <div className="space-y-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Log a call, meeting note or discussion..."
                rows={2}
                className="w-full p-3 rounded-2xl bg-canvas border border-border text-xs text-primaryText focus:outline-none focus:ring-1 focus:ring-accent-orange resize-none"
              />
              <div className="flex justify-end">
                <button
                  disabled={!newNote.trim() || addNoteMutation.isPending}
                  onClick={() => addNoteMutation.mutate(newNote.trim())}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-primaryText text-canvas hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {addNoteMutation.isPending ? 'Logging...' : 'Add Note'}
                </button>
              </div>
            </div>

            {/* Activities list */}
            <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-border/60">
              {lead.activities?.length ? (
                lead.activities.map((act: any) => (
                  <div key={act.id} className="relative flex items-start gap-3 pl-1">
                    <div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center text-accent-orange shrink-0 z-10 shadow-xs">
                      <MessageSquare className="w-3 h-3" />
                    </div>
                    <div className="flex-1 p-3 rounded-2xl bg-canvas border border-border text-xs">
                      <div className="flex items-center justify-between text-[10px] text-mutedText mb-1">
                        <span className="font-semibold uppercase tracking-wider text-primaryText">
                          {act.type.replace('_', ' ')}
                        </span>
                        <span>{new Date(act.at).toLocaleString()}</span>
                      </div>
                      <p className="text-primaryText">{act.body}</p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="No activities yet" description="Start by adding notes or tasks." />
              )}
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {/* Create Task */}
            <div className="p-4 rounded-3xl bg-canvas border border-border space-y-3">
              <h4 className="text-xs font-bold text-primaryText">Schedule Follow-up Task</h4>
              <div className="space-y-2">
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title (e.g. Call regarding Gold membership demo)..."
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-border text-primaryText"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-xl bg-surface border border-border text-primaryText"
                  />
                  <button
                    disabled={!taskTitle.trim() || addTaskMutation.isPending}
                    onClick={() => addTaskMutation.mutate()}
                    className="ml-auto px-4 py-1.5 text-xs font-bold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90 disabled:opacity-40"
                  >
                    Add Task
                  </button>
                </div>
              </div>
            </div>

            {/* Tasks list */}
            <div className="space-y-2">
              {lead.tasks?.length ? (
                lead.tasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-canvas border border-border text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(task.doneAt)}
                        onChange={(e) =>
                          updateTaskMutation.mutate({ taskId: task.id, done: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-accent-orange focus:ring-accent-orange"
                      />
                      <div>
                        <span
                          className={`font-semibold ${
                            task.doneAt ? 'line-through text-mutedText' : 'text-primaryText'
                          }`}
                        >
                          {task.title}
                        </span>
                        <div className="text-[10px] text-mutedText flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" /> Due {task.dueOn}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="No tasks scheduled" description="Add tasks to stay on track." />
              )}
            </div>
          </div>
        )}

        {activeTab === 'quotes' && (
          <div className="space-y-4">
            {/* Quote Builder */}
            <div className="p-4 rounded-3xl bg-canvas border border-border space-y-3">
              <h4 className="text-xs font-bold text-primaryText">Draft New Quote</h4>
              <p className="text-[11px] text-mutedText">
                Server calculates exact totals and snapshots item lines.
              </p>

              <div className="space-y-2">
                <input
                  type="text"
                  value={quoteLineDesc}
                  onChange={(e) => setQuoteLineDesc(e.target.value)}
                  placeholder="Line description"
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-border text-primaryText"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-mutedText mb-0.5 block">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={quoteLineQty}
                      onChange={(e) => setQuoteLineQty(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-border text-primaryText"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-mutedText mb-0.5 block">Unit Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={quoteLinePriceRupees}
                      onChange={(e) => setQuoteLinePriceRupees(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-border text-primaryText"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    disabled={createQuoteMutation.isPending}
                    onClick={() => createQuoteMutation.mutate()}
                    className="px-4 py-1.5 text-xs font-bold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90"
                  >
                    {createQuoteMutation.isPending ? 'Generating...' : 'Create Quote'}
                  </button>
                </div>
              </div>
            </div>

            {/* Existing Quotes */}
            <div className="space-y-3">
              {lead.quotes?.length ? (
                lead.quotes.map((quote: any) => (
                  <div
                    key={quote.id}
                    className="p-4 rounded-3xl bg-canvas border border-border space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primaryText">{quote.number}</span>
                      <StatusBadge status={quote.status} />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-mutedText">Total Quote:</span>
                      <span className="font-black text-sm text-primaryText">
                        <MoneyText paise={quote.totalPaise} />
                      </span>
                    </div>

                    {quote.lines?.length > 0 && (
                      <div className="text-[11px] text-mutedText border-t border-border/40 pt-2 space-y-1">
                        {quote.lines.map((l: any, i: number) => (
                          <div key={i} className="flex justify-between">
                            <span>
                              {l.description} x{l.qty}
                            </span>
                            <MoneyText paise={l.totalPaise ?? l.unitPricePaise * l.qty} />
                          </div>
                        ))}
                      </div>
                    )}

                    {quote.status === 'draft' && (
                      <div className="pt-2 flex justify-end">
                        <button
                          disabled={sendQuoteMutation.isPending}
                          onClick={() => sendQuoteMutation.mutate(quote.id)}
                          className="px-3 py-1 text-xs font-semibold rounded-xl bg-primaryText text-canvas hover:opacity-90 flex items-center gap-1.5"
                        >
                          <Send className="w-3 h-3" /> Send Quote
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <EmptyState title="No quotes drafted" description="Create a quote for this lead." />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Convert to Member Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-surface border border-border shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-primaryText">Convert to Member</h3>
            <p className="text-xs text-mutedText">
              This will create a registered member profile, issue their initial membership plan, and
              generate an invoice for payment.
            </p>

            <div>
              <label className="text-xs font-semibold text-primaryText block mb-1">
                Choose Plan
              </label>
              <select
                value={convertPlan}
                onChange={(e) => setConvertPlan(e.target.value as any)}
                className="w-full p-2.5 rounded-xl bg-canvas border border-border text-xs text-primaryText font-medium"
              >
                <option value="gold">Gold Plan (₹50,000 / yr)</option>
                <option value="silver">Silver Plan (₹25,000 / yr)</option>
                <option value="junior">Junior Plan (₹12,000 / yr)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConvertModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-canvas border border-border text-mutedText"
              >
                Cancel
              </button>
              <button
                disabled={convertMutation.isPending}
                onClick={() => convertMutation.mutate()}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90"
              >
                {convertMutation.isPending ? 'Converting...' : 'Confirm Conversion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
