import { useState, type FormEvent } from 'react';
import {
  X,
  Send,
  MessageSquare,
  Mail,
  Phone,
  FileText,
  Workflow,
  Trash2,
} from 'lucide-react';
import {
  FUNNEL_STAGES,
  formatCurrencyBRL,
  formatPhoneDisplay,
  interpolateTemplate,
} from '../utils/crmLogic';
import { TagBadge } from './TagBadge';
import type {
  FollowUpFlow,
  FunnelStageId,
  InteractionChannel,
  InteractionEvent,
  Lead,
  LeadTag,
  WhatsAppTemplate,
} from '../types/crm';

interface LeadDrawerProps {
  lead: Lead | null;
  tags: LeadTag[];
  interactions: InteractionEvent[];
  templates: WhatsAppTemplate[];
  workflows: FollowUpFlow[];
  whatsappConnected: boolean;
  onClose: () => void;
  onUpdateLead: (
    leadId: string,
    updates: Partial<Pick<Lead, 'stage' | 'tagIds' | 'value'>>,
  ) => Promise<void>;
  onDeleteLead: (leadId: string) => Promise<void>;
  onAddInteraction: (payload: {
    leadId: string;
    channel: InteractionChannel;
    summary: string;
    content: string;
  }) => Promise<void>;
  onDispatchWhatsApp: (
    leadIds: string[],
    messageTemplate: string,
    summaryLabel?: string,
  ) => Promise<void>;
  onExecuteWorkflowForLead: (workflowId: string, leadId: string) => Promise<void>;
  onOpenWhatsAppChat: (leadId: string) => void;
}

const CHANNEL_LABELS: Record<InteractionChannel, string> = {
  whatsapp: 'WhatsApp Web',
  email: 'E-mail Marketing',
  nota: 'Anotação',
  ligacao: 'Ligação',
  api: 'Automação API',
  funil: 'Funil',
};

export function LeadDrawer({
  lead,
  tags,
  interactions,
  templates,
  workflows,
  whatsappConnected,
  onClose,
  onUpdateLead,
  onDeleteLead,
  onAddInteraction,
  onDispatchWhatsApp,
  onExecuteWorkflowForLead,
  onOpenWhatsAppChat,
}: LeadDrawerProps) {
  const [noteContent, setNoteContent] = useState('');
  const [noteChannel, setNoteChannel] = useState<'nota' | 'ligacao' | 'email'>('nota');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates[0]?.id ?? '',
  );
  const [wppMessage, setWppMessage] = useState(
    templates[0]?.body ??
      'Olá {{primeiro_nome}}, tudo bem? Gostaria de alinhar os próximos passos com a {{empresa}}.',
  );
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(
    workflows[0]?.id ?? '',
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  );

  if (!lead) return null;

  const leadInteractions = interactions
    .filter((i) => i.leadId === lead.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const leadTags = tags.filter((t) => lead.tagIds.includes(t.id));
  const unassignedTags = tags.filter((t) => !lead.tagIds.includes(t.id));
  const previewWppText = interpolateTemplate(wppMessage, lead);

  async function handleToggleTag(tagId: string) {
    if (!lead) return;
    const exists = lead.tagIds.includes(tagId);
    const nextTagIds = exists
      ? lead.tagIds.filter((id) => id !== tagId)
      : [...lead.tagIds, tagId];
    await onUpdateLead(lead.id, { tagIds: nextTagIds });
  }

  async function handleSendWhatsApp(e: FormEvent) {
    e.preventDefault();
    if (!lead || !wppMessage.trim()) return;
    setFeedback(null);
    setBusyAction('whatsapp');
    try {
      await onDispatchWhatsApp(
        [lead.id],
        wppMessage.trim(),
        'Mensagem direta pelo painel do contato',
      );
      setFeedback({
        type: 'ok',
        text: 'Mensagem disparada via WhatsApp Web e registrada no histórico.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Falha ao enviar mensagem.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLogNote(e: FormEvent) {
    e.preventDefault();
    if (!lead || !noteContent.trim()) return;
    setFeedback(null);
    setBusyAction('note');
    try {
      await onAddInteraction({
        leadId: lead.id,
        channel: noteChannel,
        summary:
          noteChannel === 'ligacao'
            ? 'Ligação registrada'
            : noteChannel === 'email'
              ? 'E-mail comercial enviado'
              : 'Anotação interna',
        content: noteContent.trim(),
      });
      setNoteContent('');
      setFeedback({ type: 'ok', text: 'Interação registrada no histórico.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao registrar interação.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleTriggerFlow() {
    if (!lead || !selectedWorkflowId) return;
    setFeedback(null);
    setBusyAction('workflow');
    try {
      await onExecuteWorkflowForLead(selectedWorkflowId, lead.id);
      setFeedback({
        type: 'ok',
        text: 'Fluxo de follow-up executado com sucesso para este contato.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao executar fluxo.',
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-lead-title"
    >
      <div
        className="flex-1"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="w-full max-w-2xl bg-white h-full border-l border-slate-200 flex flex-col shadow-2xl overflow-hidden">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-white">
          <div className="min-w-0">
            <h2
              id="drawer-lead-title"
              className="font-display text-lg font-bold text-slate-900 truncate"
            >
              {lead.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
              <span>{lead.company}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {formatPhoneDisplay(lead.phone)}
              </span>
              {lead.email && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{lead.email}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                await onDeleteLead(lead.id);
                onClose();
              }}
              aria-label={`Excluir contato ${lead.name}`}
              className="p-2 text-slate-400 hover:text-rose-600 rounded-md"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar detalhes do contato"
              className="p-2 text-slate-500 hover:text-slate-900 rounded-md"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {feedback && (
            <div
              role="status"
              className={`rounded-md border px-3 py-2 text-sm ${
                feedback.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Stage, Value & Tags */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5 border-b border-slate-100">
            <div>
              <label
                htmlFor="drawer-stage-select"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Etapa do Funil
              </label>
              <select
                id="drawer-stage-select"
                value={lead.stage}
                onChange={(e) =>
                  onUpdateLead(lead.id, {
                    stage: e.target.value as FunnelStageId,
                  })
                }
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              >
                {FUNNEL_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
                <option value="perdido">Perdido</option>
              </select>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-600 mb-1">
                Valor da Oportunidade
              </span>
              <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums py-1">
                {formatCurrencyBRL(lead.value)}
              </p>
            </div>

            <div className="sm:col-span-2">
              <span className="block text-xs font-medium text-slate-600 mb-1.5">
                Etiquetas Personalizadas
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {leadTags.map((tag) => (
                  <TagBadge
                    key={tag.id}
                    tag={tag}
                    onRemove={() => handleToggleTag(tag.id)}
                  />
                ))}
                {unassignedTags.length > 0 && (
                  <select
                    aria-label="Adicionar etiqueta ao contato"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) handleToggleTag(e.target.value);
                    }}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-teal-700 focus:outline-none"
                  >
                    <option value="">+ Etiqueta</option>
                    {unassignedTags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </section>

          {/* Direct WhatsApp Web Dispatch */}
          <section className="space-y-3 pb-5 border-b border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-900 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                <span>Disparo Direto via WhatsApp Web</span>
              </h3>
              <span className="text-xs text-slate-500">
                {whatsappConnected ? 'Sessão conectada' : 'Sessão desconectada'}
              </span>
            </div>

            <form onSubmit={handleSendWhatsApp} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="drawer-wpp-template" className="sr-only">
                  Modelo de mensagem WhatsApp
                </label>
                <select
                  id="drawer-wpp-template"
                  value={selectedTemplateId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedTemplateId(id);
                    const found = templates.find((t) => t.id === id);
                    if (found) setWppMessage(found.body);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-teal-700 focus:outline-none"
                >
                  <option value="">Mensagem personalizada</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      Modelo: {t.name}
                    </option>
                  ))}
                </select>

                <span className="text-xs text-slate-500">
                  Variáveis: <code className="text-slate-700">{'{{primeiro_nome}}'}</code>,{' '}
                  <code className="text-slate-700">{'{{empresa}}'}</code>,{' '}
                  <code className="text-slate-700">{'{{valor}}'}</code>
                </span>
              </div>

              <textarea
                rows={3}
                aria-label="Mensagem para WhatsApp Web"
                value={wppMessage}
                onChange={(e) => setWppMessage(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />

              <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-medium text-slate-700">Prévia: </span>
                {previewWppText}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onOpenWhatsAppChat(lead.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800 hover:underline"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Abrir no Chat WhatsApp Integrado</span>
                </button>

                <button
                  type="submit"
                  disabled={busyAction === 'whatsapp' || !wppMessage.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>
                    {busyAction === 'whatsapp'
                      ? 'Enviando...'
                      : 'Disparar pelo Fluxo'}
                  </span>
                </button>
              </div>
            </form>
          </section>

          {/* Enroll / Execute Follow-up Workflow */}
          <section className="space-y-2 pb-5 border-b border-slate-100">
            <h3 className="font-display text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Workflow className="h-4 w-4 text-teal-700" />
              <span>Fluxo Inteligente de Follow-up</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Selecionar fluxo de follow-up"
                value={selectedWorkflowId}
                onChange={(e) => setSelectedWorkflowId(e.target.value)}
                className="flex-1 min-w-[200px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-700 focus:outline-none"
              >
                {workflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>
                    {wf.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busyAction === 'workflow' || !selectedWorkflowId}
                onClick={handleTriggerFlow}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-md whitespace-nowrap"
              >
                {busyAction === 'workflow' ? 'Executando...' : 'Executar Fluxo Agora'}
              </button>
            </div>
          </section>

          {/* Add Note / Interaction */}
          <section className="space-y-3 pb-5 border-b border-slate-100">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Registrar Nova Interação
            </h3>
            <form onSubmit={handleLogNote} className="space-y-2.5">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md w-fit">
                {(
                  [
                    { id: 'nota', label: 'Anotação' },
                    { id: 'ligacao', label: 'Ligação' },
                    { id: 'email', label: 'E-mail' },
                  ] as const
                ).map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setNoteChannel(ch.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                      noteChannel === ch.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Descreva o resumo do contato, objeção ou próximo passo..."
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busyAction === 'note' || !noteContent.trim()}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-medium rounded-md whitespace-nowrap"
                >
                  Registrar
                </button>
              </div>
            </form>
          </section>

          {/* Centralized Interaction History Timeline */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Histórico de Interações Centralizado
              </h3>
              <span className="text-xs text-slate-500 tabular-nums">
                {leadInteractions.length} eventos
              </span>
            </div>

            {leadInteractions.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-md">
                Nenhuma interação registrada ainda para este contato.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
                {leadInteractions.map((evt) => (
                  <div key={evt.id} className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-800 flex items-center gap-1.5">
                        {evt.channel === 'whatsapp' && (
                          <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                        {evt.channel === 'email' && (
                          <Mail className="h-3.5 w-3.5 text-sky-600" />
                        )}
                        {evt.channel === 'ligacao' && (
                          <Phone className="h-3.5 w-3.5 text-amber-600" />
                        )}
                        {(evt.channel === 'nota' ||
                          evt.channel === 'api' ||
                          evt.channel === 'funil') && (
                          <FileText className="h-3.5 w-3.5 text-slate-500" />
                        )}
                        <span>{evt.summary}</span>
                      </span>
                      <span className="font-mono tabular-nums whitespace-nowrap">
                        {new Date(evt.createdAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {evt.content}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {CHANNEL_LABELS[evt.channel]} · {evt.author}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
