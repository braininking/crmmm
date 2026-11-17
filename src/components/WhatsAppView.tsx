import { useEffect, useRef, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  RefreshCw,
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  CheckCheck,
  Power,
  Search,
  MessageSquare,
  Layers,
  QrCode,
  UserCheck,
  Reply,
} from 'lucide-react';
import {
  FUNNEL_STAGES,
  formatCurrencyBRL,
  formatPhoneDisplay,
  getStageLabel,
  interpolateTemplate,
} from '../utils/crmLogic';
import { TagBadge } from './TagBadge';
import type {
  CrmState,
  FunnelStageId,
  Lead,
  WhatsAppTemplate,
} from '../types/crm';

interface WhatsAppViewProps {
  state: CrmState;
  activeLeadId: string | null;
  onSelectActiveLead: (leadId: string) => void;
  onOpenLeadDetails: (lead: Lead) => void;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onRefreshQr: () => Promise<void>;
  onCreateTemplate: (payload: {
    name: string;
    category: WhatsAppTemplate['category'];
    body: string;
  }) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onDispatchBatch: (
    leadIds: string[],
    messageTemplate: string,
    summaryLabel?: string,
  ) => Promise<{
    dispatched: { leadId: string; leadName: string; phone: string; message: string }[];
  }>;
  onRecordInboundReply: (leadId: string, content: string) => Promise<void>;
}

type WhatsAppSubTab = 'chat' | 'disparo' | 'conexao';

export function WhatsAppView({
  state,
  activeLeadId,
  onSelectActiveLead,
  onOpenLeadDetails,
  onConnect,
  onDisconnect,
  onRefreshQr,
  onCreateTemplate,
  onDeleteTemplate,
  onDispatchBatch,
  onRecordInboundReply,
}: WhatsAppViewProps) {
  const [subTab, setSubTab] = useState<WhatsAppSubTab>('chat');
  const [chatSearch, setChatSearch] = useState('');
  const [composerText, setComposerText] = useState('');
  const [chatTemplateId, setChatTemplateId] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState('');
  const [showInboundForm, setShowInboundForm] = useState(false);
  const [inboundReplyText, setInboundReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Batch Dispatcher state
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [targetMode, setTargetMode] = useState<'stage' | 'tag'>('stage');
  const [targetStage, setTargetStage] = useState<FunnelStageId>('prospeccao');
  const [targetTagId, setTargetTagId] = useState<string>(state.tags[0]?.id ?? '');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    state.templates[0]?.id ?? '',
  );
  const [messageBody, setMessageBody] = useState<string>(
    state.templates[0]?.body ?? '',
  );
  const [cadence, setCadence] = useState('15s');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResults, setDispatchResults] = useState<
    { leadId: string; leadName: string; phone: string; message: string }[]
  >([]);
  const [dispatchError, setDispatchError] = useState('');

  // Template builder state
  const [newTplName, setNewTplName] = useState('');
  const [newTplCategory, setNewTplCategory] =
    useState<WhatsAppTemplate['category']>('follow_up');
  const [newTplBody, setNewTplBody] = useState('');

  useEffect(() => {
    if (!state.whatsapp.connected) {
      const qrPayload = `vertice-crm://whatsapp-pair/${state.whatsapp.pairingToken}`;
      QRCode.toDataURL(qrPayload, { width: 200, margin: 1 })
        .then((url) => setQrDataUrl(url))
        .catch(() => setQrDataUrl(''));
    }
  }, [state.whatsapp.connected, state.whatsapp.pairingToken]);

  const resolvedLeadId =
    activeLeadId && state.leads.some((l) => l.id === activeLeadId)
      ? activeLeadId
      : state.leads[0]?.id ?? null;

  const activeLead =
    state.leads.find((l) => l.id === resolvedLeadId) ?? null;

  const filteredContacts = state.leads.filter((lead) => {
    const q = chatSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      lead.name.toLowerCase().includes(q) ||
      lead.company.toLowerCase().includes(q) ||
      lead.phone.includes(q)
    );
  });

  const activeChatMessages = activeLead
    ? state.interactions
        .filter((i) => i.leadId === activeLead.id && i.channel === 'whatsapp')
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )
    : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeLead?.id, activeChatMessages.length]);

  const matchingLeads = state.leads.filter((lead) => {
    if (!lead.phone) return false;
    if (targetMode === 'stage') return lead.stage === targetStage;
    return lead.tagIds.includes(targetTagId);
  });

  const samplePreview =
    matchingLeads[0] && messageBody
      ? interpolateTemplate(messageBody, matchingLeads[0])
      : messageBody;

  async function handleSendSingleChat(e: FormEvent) {
    e.preventDefault();
    if (!activeLead || !composerText.trim()) return;
    setChatError('');
    setSendingChat(true);
    try {
      await onDispatchBatch(
        [activeLead.id],
        composerText.trim(),
        'Mensagem enviada no WhatsApp Web integrado',
      );
      setComposerText('');
      setChatTemplateId('');
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : 'Erro ao enviar mensagem.',
      );
    } finally {
      setSendingChat(false);
    }
  }

  async function handleSubmitInboundReply(e: FormEvent) {
    e.preventDefault();
    if (!activeLead || !inboundReplyText.trim()) return;
    await onRecordInboundReply(activeLead.id, inboundReplyText.trim());
    setInboundReplyText('');
    setShowInboundForm(false);
  }

  async function handleBatchDispatch(e: FormEvent) {
    e.preventDefault();
    setDispatchError('');
    if (matchingLeads.length === 0) {
      setDispatchError('Nenhum contato com WhatsApp encontrado para esse segmento.');
      return;
    }
    if (!messageBody.trim()) {
      setDispatchError('Escreva ou selecione um modelo de mensagem.');
      return;
    }

    setDispatching(true);
    try {
      const res = await onDispatchBatch(
        matchingLeads.map((l) => l.id),
        messageBody.trim(),
        `Disparo em fluxo (${cadence})`,
      );
      setDispatchResults(res.dispatched);
    } catch (err) {
      setDispatchError(
        err instanceof Error ? err.message : 'Erro ao disparar mensagens.',
      );
    } finally {
      setDispatching(false);
    }
  }

  async function handleAddTemplate(e: FormEvent) {
    e.preventDefault();
    if (!newTplName.trim() || !newTplBody.trim()) return;
    await onCreateTemplate({
      name: newTplName.trim(),
      category: newTplCategory,
      body: newTplBody.trim(),
    });
    setNewTplName('');
    setNewTplBody('');
  }

  function openConversationInsideCrm(leadId: string) {
    onSelectActiveLead(leadId);
    setSubTab('chat');
  }

  return (
    <div className="space-y-5">
      {/* Header + Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            WhatsApp Web Integrado
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Converse, acompanhe respostas e dispare fluxos automáticos diretamente dentro do CRM.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
          <button
            type="button"
            onClick={() => setSubTab('chat')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap ${
              subTab === 'chat'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5 text-emerald-700" />
            <span>Conversas</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('disparo')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap ${
              subTab === 'disparo'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5 text-teal-700" />
            <span>Disparo em Fluxo</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('conexao')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap ${
              subTab === 'conexao'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="h-3.5 w-3.5 text-slate-600" />
            <span>Conexão e Modelos</span>
          </button>
        </div>
      </div>

      {/* Sub-tab 1: Embedded WhatsApp Web Chat Workspace */}
      {subTab === 'chat' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
          {/* Left: Conversations List */}
          <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col">
            <div className="p-3.5 border-b border-slate-100 space-y-2.5 bg-slate-50/70">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">
                  {state.whatsapp.connected
                    ? `Conectado · ${state.whatsapp.phoneNumber}`
                    : 'Sessão desconectada'}
                </span>
                {!state.whatsapp.connected && (
                  <button
                    type="button"
                    onClick={() => setSubTab('conexao')}
                    className="font-medium text-teal-800 hover:underline"
                  >
                    Parear QR
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  aria-label="Buscar conversa no WhatsApp Web"
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Buscar contato ou empresa..."
                  className="w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[520px]">
              {filteredContacts.map((lead) => {
                const wppEvents = state.interactions
                  .filter((i) => i.leadId === lead.id && i.channel === 'whatsapp')
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime(),
                  );
                const lastMsg = wppEvents[0];
                const isSelected = activeLead?.id === lead.id;

                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => onSelectActiveLead(lead.id)}
                    className={`w-full text-left px-4 py-3 transition-colors flex flex-col gap-1 ${
                      isSelected ? 'bg-teal-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {lead.name}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                        {lastMsg
                          ? new Date(lastMsg.createdAt).toLocaleTimeString(
                              'pt-BR',
                              { hour: '2-digit', minute: '2-digit' },
                            )
                          : getStageLabel(lead.stage)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {lastMsg
                        ? lastMsg.content
                        : `${lead.company} · ${formatPhoneDisplay(lead.phone)}`}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right: Active Embedded Chat Window */}
          <section className="lg:col-span-8 flex flex-col bg-slate-50/60">
            {!activeLead ? (
              <div className="flex-1 flex items-center justify-center p-8 text-sm text-slate-500">
                Selecione um contato na lista ao lado para iniciar o atendimento pelo WhatsApp Web integrado.
              </div>
            ) : (
              <>
                {/* Chat Top Bar */}
                <div className="bg-white border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-sm font-bold text-slate-900 truncate">
                        {activeLead.name}
                      </h2>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs font-medium text-teal-800">
                        {getStageLabel(activeLead.stage)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span>{activeLead.company}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatPhoneDisplay(activeLead.phone)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrencyBRL(activeLead.value)}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {state.tags
                      .filter((t) => activeLead.tagIds.includes(t.id))
                      .slice(0, 2)
                      .map((t) => (
                        <TagBadge key={t.id} tag={t} />
                      ))}
                    <button
                      type="button"
                      onClick={() => setShowInboundForm((v) => !v)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    >
                      <Reply className="h-3.5 w-3.5" />
                      <span>Registrar Resposta</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenLeadDetails(activeLead)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                    >
                      <UserCheck className="h-3.5 w-3.5 text-teal-700" />
                      <span>Ficha do Lead</span>
                    </button>
                  </div>
                </div>

                {/* Optional Inbound Reply Input */}
                {showInboundForm && (
                  <form
                    onSubmit={handleSubmitInboundReply}
                    className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      aria-label="Registrar mensagem recebida do contato"
                      value={inboundReplyText}
                      onChange={(e) => setInboundReplyText(e.target.value)}
                      placeholder={`Registrar resposta recebida de ${activeLead.name}...`}
                      className="flex-1 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md whitespace-nowrap"
                    >
                      Adicionar ao Chat
                    </button>
                  </form>
                )}

                {/* Disconnected warning inside chat */}
                {!state.whatsapp.connected && (
                  <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-900">
                    <span>
                      WhatsApp Web desconectado. Conecte sua sessão para disparar novas mensagens.
                    </span>
                    <button
                      type="button"
                      onClick={() => setSubTab('conexao')}
                      className="font-semibold underline whitespace-nowrap"
                    >
                      Conectar agora
                    </button>
                  </div>
                )}

                {/* Messages Stream */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3 max-h-[400px]">
                  {activeChatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-2">
                      <MessageSquare className="h-8 w-8 text-slate-300" />
                      <p className="text-sm font-medium text-slate-700">
                        Nenhuma mensagem trocada ainda com {activeLead.name}
                      </p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        Selecione um modelo abaixo ou digite sua mensagem para iniciar o atendimento aqui mesmo no CRM.
                      </p>
                    </div>
                  ) : (
                    activeChatMessages.map((msg) => {
                      const isOutbound = msg.direction !== 'inbound';
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${
                            isOutbound ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[78%] rounded-lg px-4 py-2.5 border text-sm space-y-1 ${
                              isOutbound
                                ? 'bg-emerald-50 border-emerald-200 text-slate-900'
                                : 'bg-white border-slate-200 text-slate-900'
                            }`}
                          >
                            <p className="leading-relaxed whitespace-pre-wrap">
                              {msg.content}
                            </p>
                            <div className="flex items-center justify-end gap-1.5 text-[11px] text-slate-500 font-mono tabular-nums">
                              <span>{msg.author}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {new Date(msg.createdAt).toLocaleTimeString(
                                  'pt-BR',
                                  { hour: '2-digit', minute: '2-digit' },
                                )}
                              </span>
                              {isOutbound && (
                                <CheckCheck
                                  className="h-3.5 w-3.5 text-emerald-700"
                                  aria-label="Entregue"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Composer */}
                <form
                  onSubmit={handleSendSingleChat}
                  className="bg-white border-t border-slate-200 p-4 space-y-2.5"
                >
                  {chatError && (
                    <p role="alert" className="text-xs text-rose-700">
                      {chatError}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <select
                      aria-label="Inserir modelo na conversa"
                      value={chatTemplateId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setChatTemplateId(id);
                        const tpl = state.templates.find((t) => t.id === id);
                        if (tpl) {
                          setComposerText(interpolateTemplate(tpl.body, activeLead));
                        }
                      }}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:border-teal-700 focus:outline-none"
                    >
                      <option value="">Inserir modelo rápido...</option>
                      {state.templates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </option>
                      ))}
                    </select>

                    <span className="text-[11px] text-slate-400">
                      Aceita {'{{primeiro_nome}}'}, {'{{empresa}}'}, {'{{valor}}'}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      aria-label={`Mensagem WhatsApp para ${activeLead.name}`}
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      placeholder={`Escrever mensagem no WhatsApp para ${activeLead.name}...`}
                      className="flex-1 rounded-md border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={sendingChat || !composerText.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-medium rounded-md whitespace-nowrap"
                    >
                      <Send className="h-4 w-4" />
                      <span>{sendingChat ? 'Enviando...' : 'Enviar'}</span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      )}

      {/* Sub-tab 2: Automated Batch Dispatch */}
      {subTab === 'disparo' && (
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Disparo Automático Personalizado por Fluxo
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Segmente contatos por etapa ou etiqueta, personalize variáveis dinâmicas e dispare em lote dentro do CRM.
            </p>
          </div>

          {dispatchError && (
            <div
              role="alert"
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900"
            >
              {dispatchError}
            </div>
          )}

          <form onSubmit={handleBatchDispatch} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Segmentar Por
                </label>
                <select
                  value={targetMode}
                  onChange={(e) =>
                    setTargetMode(e.target.value as 'stage' | 'tag')
                  }
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  <option value="stage">Etapa do Funil</option>
                  <option value="tag">Etiqueta de Lead</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {targetMode === 'stage' ? 'Etapa Alvo' : 'Etiqueta Alvo'}
                </label>
                {targetMode === 'stage' ? (
                  <select
                    value={targetStage}
                    onChange={(e) =>
                      setTargetStage(e.target.value as FunnelStageId)
                    }
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    {FUNNEL_STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={targetTagId}
                    onChange={(e) => setTargetTagId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    {state.tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Intervalo Anti-bloqueio
                </label>
                <select
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  <option value="15s">15s entre envios</option>
                  <option value="30s">30s entre envios</option>
                  <option value="45s">45s entre envios</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="wpp-batch-template"
                  className="text-xs font-medium text-slate-600"
                >
                  Modelo de Mensagem
                </label>
                <span className="text-xs text-slate-500 tabular-nums">
                  Destinatários elegíveis:{' '}
                  <strong className="text-slate-900">{matchingLeads.length}</strong>
                </span>
              </div>
              <select
                id="wpp-batch-template"
                value={selectedTemplateId}
                onChange={(e) => {
                  setSelectedTemplateId(e.target.value);
                  const found = state.templates.find(
                    (t) => t.id === e.target.value,
                  );
                  if (found) setMessageBody(found.body);
                }}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 mb-2"
              >
                {state.templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>

              <textarea
                rows={3}
                aria-label="Texto do disparo em massa"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            {samplePreview && (
              <div className="rounded-md bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">
                  Prévia personalizada ({matchingLeads[0]?.name ?? 'Exemplo'}):{' '}
                </span>
                {samplePreview}
              </div>
            )}

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={dispatching || matchingLeads.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-medium rounded-md"
              >
                <Send className="h-4 w-4" />
                <span>
                  {dispatching
                    ? 'Disparando fila...'
                    : `Disparar para ${matchingLeads.length} Contatos`}
                </span>
              </button>
            </div>
          </form>

          {dispatchResults.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {dispatchResults.length} mensagens enviadas e registradas no histórico:
                </span>
              </p>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-md max-h-60 overflow-y-auto">
                {dispatchResults.map((item) => (
                  <div
                    key={item.leadId}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {item.leadName}{' '}
                        <span className="font-mono text-slate-500 font-normal">
                          ({formatPhoneDisplay(item.phone)})
                        </span>
                      </p>
                      <p className="text-slate-600 truncate">{item.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openConversationInsideCrm(item.leadId)}
                      className="text-teal-800 hover:underline whitespace-nowrap shrink-0 font-medium"
                    >
                      Abrir no Chat
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Sub-tab 3: Session Pairing & Message Templates */}
      {subTab === 'conexao' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-emerald-700" />
                <span>Sessão WhatsApp Web</span>
              </h2>
              <span
                className={`text-xs font-medium ${
                  state.whatsapp.connected ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {state.whatsapp.connected ? 'Conectado' : 'Aguardando QR'}
              </span>
            </div>

            {state.whatsapp.connected ? (
              <div className="space-y-4">
                <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 space-y-1.5">
                  <p className="text-sm font-semibold text-emerald-950">
                    {state.whatsapp.deviceName}
                  </p>
                  <p className="font-mono text-xs text-emerald-800 tabular-nums">
                    {state.whatsapp.phoneNumber}
                  </p>
                  <p className="text-xs text-emerald-700 tabular-nums">
                    Bateria {state.whatsapp.batteryLevel}% · Sincronizado às{' '}
                    {new Date(state.whatsapp.lastSyncAt).toLocaleTimeString(
                      'pt-BR',
                      { hour: '2-digit', minute: '2-digit' },
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 rounded-md p-3">
                  <div>
                    <p className="text-[11px] text-slate-500">Enviadas</p>
                    <p className="font-mono text-base font-semibold text-slate-900 tabular-nums">
                      {state.whatsapp.totalSent}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Entregues</p>
                    <p className="font-mono text-base font-semibold text-emerald-700 tabular-nums">
                      {state.whatsapp.totalDelivered}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Respostas</p>
                    <p className="font-mono text-base font-semibold text-teal-700 tabular-nums">
                      {state.whatsapp.totalReplied}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setSubTab('chat')}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Ir para Conversas no CRM</span>
                  </button>
                  <button
                    type="button"
                    onClick={onDisconnect}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-medium rounded-md"
                  >
                    <Power className="h-3.5 w-3.5" />
                    <span>Desconectar Sessão</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="inline-block p-3 bg-white border border-slate-200 rounded-md">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR Code de pareamento WhatsApp Web"
                      className="h-44 w-44 mx-auto"
                    />
                  ) : (
                    <div className="h-44 w-44 bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                      Gerando QR Code...
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Abra o WhatsApp no celular em <strong>Aparelhos Conectados</strong> e escaneie o código acima.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onRefreshQr}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-md"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Novo QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={onConnect}
                    className="flex-1 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-md"
                  >
                    Confirmar Pareamento
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Modelos de Mensagem com Variáveis Dinâmicas
            </h2>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
              {state.templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-4 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {tpl.name}
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {tpl.body}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteTemplate(tpl.id)}
                    aria-label={`Excluir modelo ${tpl.name}`}
                    className="p-1.5 text-slate-400 hover:text-rose-600 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleAddTemplate}
              className="space-y-3 border border-slate-200 rounded-md p-4 bg-slate-50/50"
            >
              <h3 className="text-xs font-semibold text-slate-900">
                Novo Modelo WhatsApp
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={newTplName}
                  onChange={(e) => setNewTplName(e.target.value)}
                  placeholder="Nome do modelo"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
                <select
                  value={newTplCategory}
                  onChange={(e) =>
                    setNewTplCategory(
                      e.target.value as WhatsAppTemplate['category'],
                    )
                  }
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  <option value="boas_vindas">Boas-vindas</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="proposta">Proposta</option>
                  <option value="reativacao">Reativação</option>
                </select>
              </div>
              <textarea
                rows={3}
                value={newTplBody}
                onChange={(e) => setNewTplBody(e.target.value)}
                placeholder="Ex: Olá {{primeiro_nome}} da {{empresa}}..."
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Salvar Modelo</span>
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
